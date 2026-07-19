// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * GlowYieldVault — ERC-4626-like yield vault.
 * Accepts USDC deposits, mints share tokens, distributes yield.
 * Yield is added by owner (protocol) from lending interest collected.
 */
interface IERC20 {
    function transferFrom(address, address, uint256) external returns (bool);
    function transfer(address, uint256) external returns (bool);
    function balanceOf(address) external view returns (uint256);
}

contract GlowYieldVault {
    string  public name;
    string  public symbol;
    uint8   public constant decimals = 18;
    address public asset;           // underlying token (USDC)
    address public owner;

    uint256 public totalShares;
    uint256 public totalAssets;
    mapping(address => uint256) public shares;

    event Deposit(address indexed user, uint256 assets, uint256 shares_);
    event Withdraw(address indexed user, uint256 assets, uint256 shares_);
    event YieldAdded(uint256 amount);

    constructor(string memory _name, string memory _symbol, address _asset) {
        name   = _name;
        symbol = _symbol;
        asset  = _asset;
        owner  = msg.sender;
    }

    modifier onlyOwner() { require(msg.sender == owner, "Not owner"); _; }

    // Convert assets to shares
    function previewDeposit(uint256 assets) public view returns (uint256) {
        return totalShares == 0 ? assets : (assets * totalShares) / totalAssets;
    }

    // Convert shares to assets
    function previewRedeem(uint256 shares_) public view returns (uint256) {
        return totalShares == 0 ? shares_ : (shares_ * totalAssets) / totalShares;
    }

    function deposit(uint256 assets) external returns (uint256 shares_) {
        require(assets > 0, "Zero deposit");
        require(IERC20(asset).transferFrom(msg.sender, address(this), assets), "Transfer failed");
        shares_      = previewDeposit(assets);
        shares[msg.sender] += shares_;
        totalShares  += shares_;
        totalAssets  += assets;
        emit Deposit(msg.sender, assets, shares_);
    }

    function withdraw(uint256 shares_) external returns (uint256 assets) {
        require(shares_ > 0, "Zero shares");
        require(shares[msg.sender] >= shares_, "Insufficient shares");
        assets = previewRedeem(shares_);
        shares[msg.sender] -= shares_;
        totalShares         -= shares_;
        totalAssets         -= assets;
        require(IERC20(asset).transfer(msg.sender, assets), "Transfer failed");
        emit Withdraw(msg.sender, assets, shares_);
    }

    // Owner adds yield (e.g. from lending interest)
    function addYield(uint256 amount) external onlyOwner {
        require(IERC20(asset).transferFrom(msg.sender, address(this), amount), "Transfer failed");
        totalAssets += amount;
        emit YieldAdded(amount);
    }

    function balanceOf(address user) external view returns (uint256) {
        return shares[user];
    }

    function totalSupply() external view returns (uint256) { return totalShares; }

    function setOwner(address _owner) external onlyOwner { owner = _owner; }
}
