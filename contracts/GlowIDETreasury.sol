// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title GlowIDE Treasury
 * @notice Collects all platform fees: deployment, AI subscriptions, storage
 * @dev Deployed on Arc Testnet. Native currency is USDC (6 decimals).
 */
contract GlowIDETreasury {
    address public admin;
    address public pendingAdmin;

    uint256 public totalReceived;
    uint256 public totalWithdrawn;
    uint256 public transactionCount;

    struct TxRecord {
        address from;
        uint256 amount;
        string  feeType;
        uint256 timestamp;
    }
    TxRecord[] public transactions;

    event FeeReceived(address indexed from, uint256 amount, string feeType, uint256 indexed txId);
    event Withdrawn(address indexed to, uint256 amount);
    event AdminTransferInitiated(address indexed newAdmin);
    event AdminTransferred(address indexed oldAdmin, address indexed newAdmin);

    error NotAdmin();
    error NotPendingAdmin();
    error InsufficientBalance(uint256 requested, uint256 available);
    error TransferFailed();
    error ZeroAddress();

    modifier onlyAdmin() {
        if (msg.sender != admin) revert NotAdmin();
        _;
    }

    constructor(address _admin) {
        if (_admin == address(0)) revert ZeroAddress();
        admin = _admin;
    }

    // ── Receive fees ──────────────────────────────────────────────────────────
    receive() external payable {
        _record(msg.sender, msg.value, "generic");
    }

    function depositFee(string calldata feeType) external payable {
        _record(msg.sender, msg.value, feeType);
    }

    function _record(address from, uint256 amount, string memory feeType) internal {
        totalReceived += amount;
        transactionCount++;
        transactions.push(TxRecord({ from: from, amount: amount, feeType: feeType, timestamp: block.timestamp }));
        emit FeeReceived(from, amount, feeType, transactionCount - 1);
    }

    // ── Withdraw ──────────────────────────────────────────────────────────────
    function withdraw(address payable to, uint256 amount) external onlyAdmin {
        uint256 bal = address(this).balance;
        if (amount > bal) revert InsufficientBalance(amount, bal);
        if (to == address(0)) revert ZeroAddress();
        totalWithdrawn += amount;
        (bool ok,) = to.call{value: amount}("");
        if (!ok) revert TransferFailed();
        emit Withdrawn(to, amount);
    }

    function withdrawAll(address payable to) external onlyAdmin {
        uint256 bal = address(this).balance;
        if (to == address(0)) revert ZeroAddress();
        totalWithdrawn += bal;
        (bool ok,) = to.call{value: bal}("");
        if (!ok) revert TransferFailed();
        emit Withdrawn(to, bal);
    }

    // ── Admin transfer (2-step) ───────────────────────────────────────────────
    function initiateAdminTransfer(address newAdmin) external onlyAdmin {
        if (newAdmin == address(0)) revert ZeroAddress();
        pendingAdmin = newAdmin;
        emit AdminTransferInitiated(newAdmin);
    }

    function acceptAdminTransfer() external {
        if (msg.sender != pendingAdmin) revert NotPendingAdmin();
        emit AdminTransferred(admin, pendingAdmin);
        admin = pendingAdmin;
        pendingAdmin = address(0);
    }

    // ── Views ─────────────────────────────────────────────────────────────────
    function balance() external view returns (uint256) {
        return address(this).balance;
    }

    function getTransactions(uint256 offset, uint256 limit)
        external view returns (TxRecord[] memory records, uint256 total)
    {
        total = transactions.length;
        uint256 end = offset + limit > total ? total : offset + limit;
        records = new TxRecord[](end - offset);
        for (uint256 i = offset; i < end; i++) {
            records[i - offset] = transactions[i];
        }
    }

    function stats() external view returns (uint256 bal, uint256 received, uint256 withdrawn, uint256 txCount) {
        return (address(this).balance, totalReceived, totalWithdrawn, transactionCount);
    }
}
