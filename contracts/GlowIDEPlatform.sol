// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title GlowIDEPlatform
 * @notice On-chain registry for GlowIDE platform state.
 *         Tracks deployments, subscriptions, and fee payments.
 *         Circle SCP compatible — deployed on Arc Testnet.
 *
 * Circle SCP Interaction:
 *   - Deploy via: POST /templates/{id}/deploy (blockchain: ARC-TESTNET)
 *   - Query via:  POST /contracts/query (abiFunctionSignature: "getUser(address)")
 *   - Execute via: POST /developer/transactions/contractExecution
 *
 * @dev USDC decimals on Arc Testnet: 6
 */
contract GlowIDEPlatform is AccessControl, ReentrancyGuard {
    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");

    // ── Plan tiers ────────────────────────────────────────────────────────
    enum Plan { Free, Pro, Enterprise }

    struct UserRecord {
        Plan    plan;
        uint256 tokensUsed;
        uint256 deploymentsUsed;
        uint256 subscriptionExpiry;
        bool    active;
    }

    struct DeployRecord {
        address contractAddress;
        address deployer;
        string  contractName;
        uint256 timestamp;
        uint256 feePaid;      // USDC micro-units
        bool    verified;
    }

    // ── State ─────────────────────────────────────────────────────────────
    address public treasury;
    mapping(address => UserRecord)   public users;
    mapping(address => DeployRecord) public deployments;
    address[] public allDeployers;
    uint256   public totalDeployments;
    uint256   public totalFeesCollected; // USDC micro-units

    // Plan pricing in USDC micro-units (1 USDC = 1_000_000)
    uint256 public proPlanPrice        = 10_000_000;  // 10 USDC/month
    uint256 public enterprisePlanPrice = 100_000_000; // 100 USDC/month
    uint256 public deploymentFee       = 0;           // 0 USDC default
    bool    public feesEnabled         = false;

    // ── Events ────────────────────────────────────────────────────────────
    event UserSubscribed(address indexed user, Plan plan, uint256 expiry);
    event ContractDeployed(address indexed deployer, address indexed contractAddr, string name, uint256 fee);
    event ContractVerified(address indexed contractAddr);
    event FeeUpdated(uint256 deployFee, uint256 proPrice, uint256 enterprisePrice);

    // ── Errors ────────────────────────────────────────────────────────────
    error InsufficientFee(uint256 required, uint256 provided);
    error ZeroAddress();
    error NotActive();

    constructor(address defaultAdmin, address treasury_) {
        if (defaultAdmin == address(0) || treasury_ == address(0)) revert ZeroAddress();
        treasury = treasury_;
        _grantRole(DEFAULT_ADMIN_ROLE, defaultAdmin);
        _grantRole(OPERATOR_ROLE, defaultAdmin);
    }

    // ── User functions ────────────────────────────────────────────────────
    function subscribe(Plan plan) external payable nonReentrant {
        uint256 price = plan == Plan.Pro ? proPlanPrice : (plan == Plan.Enterprise ? enterprisePlanPrice : 0);
        if (price > 0 && feesEnabled) {
            if (msg.value < price) revert InsufficientFee(price, msg.value);
            totalFeesCollected += msg.value;
            (bool ok,) = treasury.call{value: msg.value}("");
            require(ok, "Treasury transfer failed");
        }
        uint256 expiry = block.timestamp + 30 days;
        users[msg.sender] = UserRecord({ plan:plan, tokensUsed:0, deploymentsUsed:0, subscriptionExpiry:expiry, active:true });
        emit UserSubscribed(msg.sender, plan, expiry);
    }

    // ── Operator functions ────────────────────────────────────────────────
    function recordDeployment(
        address deployer,
        address contractAddr,
        string calldata contractName,
        uint256 feePaid
    ) external onlyRole(OPERATOR_ROLE) {
        if (!users[deployer].active) {
            users[deployer] = UserRecord({ plan:Plan.Free, tokensUsed:0, deploymentsUsed:0, subscriptionExpiry:0, active:true });
            allDeployers.push(deployer);
        }
        deployments[contractAddr] = DeployRecord({ contractAddress:contractAddr, deployer:deployer, contractName:contractName, timestamp:block.timestamp, feePaid:feePaid, verified:false });
        users[deployer].deploymentsUsed++;
        totalDeployments++;
        totalFeesCollected += feePaid;
        emit ContractDeployed(deployer, contractAddr, contractName, feePaid);
    }

    function verifyContract(address contractAddr) external onlyRole(OPERATOR_ROLE) {
        deployments[contractAddr].verified = true;
        emit ContractVerified(contractAddr);
    }

    function recordTokenUsage(address user, uint256 tokens) external onlyRole(OPERATOR_ROLE) {
        if (!users[user].active) users[user] = UserRecord({ plan:Plan.Free, tokensUsed:0, deploymentsUsed:0, subscriptionExpiry:0, active:true });
        users[user].tokensUsed += tokens;
    }

    // ── Admin functions ───────────────────────────────────────────────────
    function setFees(uint256 _deployFee, uint256 _proPrice, uint256 _enterprisePrice, bool _enabled)
        external onlyRole(DEFAULT_ADMIN_ROLE)
    {
        deploymentFee       = _deployFee;
        proPlanPrice        = _proPrice;
        enterprisePlanPrice = _enterprisePrice;
        feesEnabled         = _enabled;
        emit FeeUpdated(_deployFee, _proPrice, _enterprisePrice);
    }

    function setTreasury(address newTreasury) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (newTreasury == address(0)) revert ZeroAddress();
        treasury = newTreasury;
    }

    // ── Views ─────────────────────────────────────────────────────────────
    function getUser(address user) external view returns (UserRecord memory) { return users[user]; }
    function getDeployment(address contractAddr) external view returns (DeployRecord memory) { return deployments[contractAddr]; }
    function platformStats() external view returns (uint256 deploys, uint256 fees, uint256 userCount) {
        return (totalDeployments, totalFeesCollected, allDeployers.length);
    }
}
