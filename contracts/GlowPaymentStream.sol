// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * GlowPaymentStream — ERC-4907-style streaming payments in USDC.
 * Streams USDC per second from payer to recipient.
 * Anyone can call `withdraw()` to pull accrued balance.
 */
interface IERC20 {
    function transferFrom(address, address, uint256) external returns (bool);
    function transfer(address, uint256) external returns (bool);
}

contract GlowPaymentStream {
    struct Stream {
        address payer;
        address recipient;
        address token;
        uint256 ratePerSecond;  // tokens per second (18-decimal adjusted)
        uint256 startTime;
        uint256 endTime;
        uint256 withdrawn;
        bool    active;
    }

    uint256 public nextStreamId;
    mapping(uint256 => Stream) public streams;
    mapping(address => uint256[]) public userStreams;

    event StreamCreated(uint256 indexed id, address payer, address recipient, address token, uint256 rate, uint256 duration);
    event Withdrawn(uint256 indexed id, address recipient, uint256 amount);
    event StreamCancelled(uint256 indexed id);

    function createStream(
        address recipient,
        address token,
        uint256 totalAmount,
        uint256 durationSeconds
    ) external returns (uint256 streamId) {
        require(durationSeconds > 0, "Duration must be > 0");
        require(totalAmount > 0, "Amount must be > 0");
        require(IERC20(token).transferFrom(msg.sender, address(this), totalAmount), "Transfer failed");

        streamId = nextStreamId++;
        streams[streamId] = Stream({
            payer:         msg.sender,
            recipient:     recipient,
            token:         token,
            ratePerSecond: totalAmount / durationSeconds,
            startTime:     block.timestamp,
            endTime:       block.timestamp + durationSeconds,
            withdrawn:     0,
            active:        true
        });
        userStreams[msg.sender].push(streamId);
        userStreams[recipient].push(streamId);
        emit StreamCreated(streamId, msg.sender, recipient, token, totalAmount / durationSeconds, durationSeconds);
    }

    function availableBalance(uint256 streamId) public view returns (uint256) {
        Stream storage s = streams[streamId];
        if (!s.active) return 0;
        uint256 elapsed = block.timestamp < s.endTime ? block.timestamp - s.startTime : s.endTime - s.startTime;
        uint256 earned  = elapsed * s.ratePerSecond;
        return earned > s.withdrawn ? earned - s.withdrawn : 0;
    }

    function withdraw(uint256 streamId) external {
        Stream storage s = streams[streamId];
        require(s.active, "Stream not active");
        require(msg.sender == s.recipient, "Not recipient");
        uint256 avail = availableBalance(streamId);
        require(avail > 0, "Nothing to withdraw");
        s.withdrawn += avail;
        require(IERC20(s.token).transfer(s.recipient, avail), "Transfer failed");
        emit Withdrawn(streamId, s.recipient, avail);
    }

    function cancel(uint256 streamId) external {
        Stream storage s = streams[streamId];
        require(s.active, "Not active");
        require(msg.sender == s.payer, "Not payer");
        // Pay out what recipient has earned so far
        uint256 avail = availableBalance(streamId);
        if (avail > 0) {
            s.withdrawn += avail;
            IERC20(s.token).transfer(s.recipient, avail);
        }
        // Refund remaining to payer
        uint256 remaining = (s.endTime - s.startTime) * s.ratePerSecond - s.withdrawn;
        if (remaining > 0) IERC20(s.token).transfer(s.payer, remaining);
        s.active = false;
        emit StreamCancelled(streamId);
    }

    function getUserStreams(address user) external view returns (uint256[] memory) {
        return userStreams[user];
    }
}
