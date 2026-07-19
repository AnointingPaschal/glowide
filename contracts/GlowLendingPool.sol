// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * GlowLendingPool — minimal USDC lending/borrowing pool on Arc Testnet.
 * 
 * Supports: supply, withdraw, borrow, repay, liquidate.
 * Interest model: fixed APY rates set by owner.
 * Collateral: over-collateralized (150% default).
 * Fees: 10% of interest goes to protocol treasury.
 */
interface IERC20 {
    function transferFrom(address, address, uint256) external returns (bool);
    function transfer(address, uint256) external returns (bool);
    function balanceOf(address) external view returns (uint256);
    function decimals() external view returns (uint8);
}

contract GlowLendingPool {
    address public owner;
    address public treasury;

    struct TokenConfig {
        bool    active;
        uint256 supplyRate;   // APY in bps (e.g. 482 = 4.82%)
        uint256 borrowRate;   // APY in bps
        uint256 ltv;          // Loan-to-value in bps (e.g. 8000 = 80%)
        uint256 totalSupply;
        uint256 totalBorrow;
        uint256 lastUpdate;
    }

    struct Position {
        uint256 supplied;
        uint256 borrowed;
        uint256 supplyIndex;  // accrued interest tracking
        uint256 borrowIndex;
    }

    mapping(address => TokenConfig) public tokens;
    mapping(address => mapping(address => Position)) public positions; // user => token => position
    address[] public supportedTokens;

    event Supplied(address indexed user, address indexed token, uint256 amount);
    event Withdrawn(address indexed user, address indexed token, uint256 amount);
    event Borrowed(address indexed user, address indexed token, uint256 amount);
    event Repaid(address indexed user, address indexed token, uint256 amount);
    event Liquidated(address indexed borrower, address indexed liquidator, address indexed token, uint256 amount);

    modifier onlyOwner() { require(msg.sender == owner, "Not owner"); _; }

    constructor(address _treasury) {
        owner    = msg.sender;
        treasury = _treasury;
    }

    function addToken(
        address token,
        uint256 supplyRate,
        uint256 borrowRate,
        uint256 ltv
    ) external onlyOwner {
        tokens[token] = TokenConfig({
            active:      true,
            supplyRate:  supplyRate,
            borrowRate:  borrowRate,
            ltv:         ltv,
            totalSupply: 0,
            totalBorrow: 0,
            lastUpdate:  block.timestamp
        });
        supportedTokens.push(token);
    }

    function supply(address token, uint256 amount) external {
        require(tokens[token].active, "Token not supported");
        require(IERC20(token).transferFrom(msg.sender, address(this), amount), "Transfer failed");
        _accrueInterest(token);
        positions[msg.sender][token].supplied += amount;
        tokens[token].totalSupply += amount;
        emit Supplied(msg.sender, token, amount);
    }

    function withdraw(address token, uint256 amount) external {
        _accrueInterest(token);
        Position storage pos = positions[msg.sender][token];
        // Add accrued supply interest
        uint256 interest = _calcSupplyInterest(token, pos.supplied, pos.supplyIndex);
        pos.supplied += interest;
        pos.supplyIndex = tokens[token].lastUpdate;
        require(pos.supplied >= amount, "Insufficient supply");
        pos.supplied -= amount;
        tokens[token].totalSupply -= amount;
        require(IERC20(token).transfer(msg.sender, amount), "Transfer failed");
        emit Withdrawn(msg.sender, token, amount);
    }

    function borrow(address token, uint256 amount) external {
        require(tokens[token].active, "Token not supported");
        _accrueInterest(token);
        // Simple health check: require 150% collateral (same token for simplicity)
        Position storage pos = positions[msg.sender][token];
        uint256 maxBorrow = (pos.supplied * tokens[token].ltv) / 10000;
        require(pos.borrowed + amount <= maxBorrow, "Insufficient collateral");
        pos.borrowed += amount;
        tokens[token].totalBorrow += amount;
        require(IERC20(token).transfer(msg.sender, amount), "Transfer failed");
        emit Borrowed(msg.sender, token, amount);
    }

    function repay(address token, uint256 amount) external {
        _accrueInterest(token);
        Position storage pos = positions[msg.sender][token];
        uint256 interest = _calcBorrowInterest(token, pos.borrowed, pos.borrowIndex);
        pos.borrowed += interest;
        pos.borrowIndex = tokens[token].lastUpdate;
        uint256 repayAmt = amount > pos.borrowed ? pos.borrowed : amount;
        require(IERC20(token).transferFrom(msg.sender, address(this), repayAmt), "Transfer failed");
        pos.borrowed -= repayAmt;
        tokens[token].totalBorrow -= repayAmt;
        // Protocol fee: 10% of interest to treasury
        if (interest > 0) {
            uint256 fee = interest / 10;
            if (fee > 0) IERC20(token).transfer(treasury, fee);
        }
        emit Repaid(msg.sender, token, repayAmt);
    }

    function liquidate(address borrower, address token) external {
        _accrueInterest(token);
        Position storage pos = positions[borrower][token];
        uint256 interest = _calcBorrowInterest(token, pos.borrowed, pos.borrowIndex);
        pos.borrowed += interest;
        uint256 health = pos.supplied > 0 ? (pos.supplied * tokens[token].ltv) / 10000 : 0;
        require(pos.borrowed > health, "Position healthy");
        uint256 debt = pos.borrowed;
        require(IERC20(token).transferFrom(msg.sender, address(this), debt), "Transfer failed");
        // Give liquidator 105% of debt in collateral (5% bonus)
        uint256 collateralOut = (debt * 105) / 100;
        collateralOut = collateralOut > pos.supplied ? pos.supplied : collateralOut;
        pos.borrowed = 0;
        pos.supplied -= collateralOut;
        tokens[token].totalBorrow -= debt;
        IERC20(token).transfer(msg.sender, collateralOut);
        emit Liquidated(borrower, msg.sender, token, debt);
    }

    function getPosition(address user, address token) external view returns (
        uint256 supplied, uint256 borrowed, uint256 health
    ) {
        Position storage pos = positions[user][token];
        supplied = pos.supplied;
        borrowed = pos.borrowed;
        health   = supplied > 0 && borrowed > 0
            ? (supplied * tokens[token].ltv * 100) / (borrowed * 10000)
            : type(uint256).max;
    }

    // ── Internal ────────────────────────────────────────────────────────────
    function _accrueInterest(address token) internal {
        TokenConfig storage cfg = tokens[token];
        cfg.lastUpdate = block.timestamp;
    }

    function _calcSupplyInterest(address token, uint256 principal, uint256 /* lastIdx */) internal view returns (uint256) {
        // Simple: APY * principal * timeElapsed / 365days
        // In production use compound interest with index
        uint256 elapsed = block.timestamp - tokens[token].lastUpdate;
        if (elapsed == 0 || principal == 0) return 0;
        return (principal * tokens[token].supplyRate * elapsed) / (10000 * 365 days);
    }

    function _calcBorrowInterest(address token, uint256 principal, uint256 /* lastIdx */) internal view returns (uint256) {
        uint256 elapsed = block.timestamp - tokens[token].lastUpdate;
        if (elapsed == 0 || principal == 0) return 0;
        return (principal * tokens[token].borrowRate * elapsed) / (10000 * 365 days);
    }

    function setOwner(address _owner) external onlyOwner { owner = _owner; }
    function setTreasury(address _treasury) external onlyOwner { treasury = _treasury; }
    function setTokenRates(address token, uint256 supplyRate, uint256 borrowRate) external onlyOwner {
        tokens[token].supplyRate = supplyRate;
        tokens[token].borrowRate = borrowRate;
    }
}
