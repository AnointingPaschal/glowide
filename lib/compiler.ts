// ── GlowIDE Compiler — Circle SCP aligned, OpenZeppelin v5.0.2 ─────────────
// Arc Testnet: Chain 5042002 · USDC native gas (6 decimals) · evmVersion: paris
// Reference: https://developers.circle.com/contracts

export interface CompileInput {
  sourceCode: string;
  contractName?: string;
  optimizer?: { enabled: boolean; runs: number };
}

export interface CompileOutput {
  success: boolean;
  contractName?: string;
  allContracts?: string[];
  abi?: unknown[];
  bytecode?: string;
  deployedBytecode?: string | null;
  errors?: Array<{ type: string; message: string; formattedMessage?: string }>;
  warnings?: Array<{ type: string; message: string; formattedMessage?: string }>;
  metadata?: { compiler: { version: string }; optimizer: object; evmVersion: string };
}

export function detectLanguage(filename: string): string {
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";
  const map: Record<string, string> = {
    ts:"typescript", tsx:"typescript", js:"javascript", jsx:"javascript",
    sol:"solidity", py:"python", rs:"rust", go:"go", cpp:"cpp", c:"c",
    html:"html", css:"css", json:"json", md:"markdown", sh:"shell",
    yaml:"yaml", yml:"yaml", toml:"toml", java:"java", kt:"kotlin",
    swift:"swift", rb:"ruby", php:"php",
  };
  return map[ext] ?? "plaintext";
}

export function getFileIcon(filename: string): string {
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";
  const m: Record<string,string> = { ts:"ts", tsx:"tsx", js:"js", jsx:"jsx", sol:"sol", py:"py", html:"html", css:"css", json:"json", md:"md" };
  return m[ext] ?? "file";
}

export async function compileContract(input: CompileInput): Promise<CompileOutput> {
  const res = await fetch("/api/contracts/compile", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  return res.json();
}

// ── OpenZeppelin v5.0.2 — breaking changes from v4 ─────────────────────────
// • Counters.sol REMOVED — use plain uint256
// • Ownable constructor now requires initialOwner address
// • _safeMint / _mint signatures unchanged
// • ERC721._update(to, tokenId, auth) replaces _beforeTokenTransfer
// • ERC1155._update(from, to, ids, values) replaces _beforeTokenTransfer
// • AccessControl unchanged
// • SafeERC20, ReentrancyGuard unchanged

export const CONTRACT_TEMPLATES = {

// ── ERC-20: Circle USDC-compatible token ──────────────────────────────────
erc20: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Pausable.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

/**
 * @title GlowToken  
 * @notice ERC-20 with mint, burn, pause, AccessControl — Circle SCP aligned.
 * @dev OpenZeppelin v5.0.2 compatible. Arc Testnet (USDC gas, 6 decimals).
 *
 * Circle SCP: deploy via POST /templates/{id}/deploy  blockchain: ARC-TESTNET
 */
contract GlowToken is ERC20, ERC20Burnable, ERC20Pausable, AccessControl {
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");

    uint256 public constant MAX_SUPPLY = 1_000_000_000 * 10 ** 18;

    event TokensMinted(address indexed to, uint256 amount);

    /**
     * @param name           Token name
     * @param symbol         Token symbol
     * @param defaultAdmin   Admin address — receives all roles (Circle SCP convention)
     * @param initialSupply  Tokens minted to defaultAdmin at deploy (in wei, 0 = none)
     */
    constructor(
        string memory name,
        string memory symbol,
        address defaultAdmin,
        uint256 initialSupply
    ) ERC20(name, symbol) {
        _grantRole(DEFAULT_ADMIN_ROLE, defaultAdmin);
        _grantRole(MINTER_ROLE, defaultAdmin);
        _grantRole(PAUSER_ROLE, defaultAdmin);
        if (initialSupply > 0) {
            require(initialSupply <= MAX_SUPPLY, "Exceeds max supply");
            _mint(defaultAdmin, initialSupply);
        }
    }

    function mint(address to, uint256 amount) external onlyRole(MINTER_ROLE) whenNotPaused {
        require(totalSupply() + amount <= MAX_SUPPLY, "Exceeds max supply");
        _mint(to, amount);
        emit TokensMinted(to, amount);
    }

    function pause()   external onlyRole(PAUSER_ROLE) { _pause(); }
    function unpause() external onlyRole(PAUSER_ROLE) { _unpause(); }

    // OZ v5: override required for ERC20Pausable
    function _update(address from, address to, uint256 value)
        internal override(ERC20, ERC20Pausable)
    { super._update(from, to, value); }
}
`,

// ── ERC-721: NFT — NO Counters (removed in OZ v5) ─────────────────────────
erc721: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Pausable.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

/**
 * @title GlowNFT
 * @notice ERC-721 with URIStorage, pause, royalties — Circle SCP aligned.
 * @dev OpenZeppelin v5.0.2. Counters removed; uses uint256 counter instead.
 *      Constructor follows Circle SCP template params.
 */
contract GlowNFT is ERC721, ERC721URIStorage, ERC721Pausable, AccessControl {
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");

    // Plain uint256 counter — Counters.sol was removed in OZ v5
    uint256 private _nextTokenId;

    address public primarySaleRecipient;
    address public royaltyRecipient;
    uint96  public royaltyBps;   // basis points (500 = 5%)
    uint256 public mintPrice;    // USDC micro-units
    uint256 public maxSupply;    // 0 = unlimited

    event Minted(address indexed to, uint256 indexed tokenId, string uri);
    event RoyaltyUpdated(address recipient, uint96 bps);

    /**
     * @param name                  Collection name
     * @param symbol                Collection symbol
     * @param defaultAdmin          Admin address (Circle SCP convention)
     * @param primarySaleRecipient_ Primary sale recipient
     * @param royaltyRecipient_     Royalty recipient
     * @param royaltyBps_           Royalty basis points (500 = 5%)
     * @param mintPrice_            Mint price in USDC micro-units (0 = free)
     * @param maxSupply_            Max supply (0 = unlimited)
     */
    constructor(
        string memory name,
        string memory symbol,
        address defaultAdmin,
        address primarySaleRecipient_,
        address royaltyRecipient_,
        uint96  royaltyBps_,
        uint256 mintPrice_,
        uint256 maxSupply_
    ) ERC721(name, symbol) {
        _grantRole(DEFAULT_ADMIN_ROLE, defaultAdmin);
        _grantRole(MINTER_ROLE, defaultAdmin);
        _grantRole(PAUSER_ROLE, defaultAdmin);
        primarySaleRecipient = primarySaleRecipient_;
        royaltyRecipient     = royaltyRecipient_;
        royaltyBps           = royaltyBps_;
        mintPrice            = mintPrice_;
        maxSupply            = maxSupply_;
    }

    function mintTo(address to, string calldata uri) external onlyRole(MINTER_ROLE) whenNotPaused {
        if (maxSupply > 0) require(_nextTokenId < maxSupply, "Max supply reached");
        uint256 tokenId = _nextTokenId++;
        _safeMint(to, tokenId);
        _setTokenURI(tokenId, uri);
        emit Minted(to, tokenId, uri);
    }

    function totalMinted() external view returns (uint256) { return _nextTokenId; }
    function pause()       external onlyRole(PAUSER_ROLE) { _pause(); }
    function unpause()     external onlyRole(PAUSER_ROLE) { _unpause(); }

    function setRoyalty(address recipient, uint96 bps) external onlyRole(DEFAULT_ADMIN_ROLE) {
        royaltyRecipient = recipient;
        royaltyBps = bps;
        emit RoyaltyUpdated(recipient, bps);
    }

    // ── OZ v5 overrides ─────────────────────────────────────────────────
    function tokenURI(uint256 id)
        public view override(ERC721, ERC721URIStorage) returns (string memory)
    { return super.tokenURI(id); }

    function supportsInterface(bytes4 id)
        public view override(ERC721, ERC721URIStorage, AccessControl) returns (bool)
    { return super.supportsInterface(id); }

    function _update(address to, uint256 id, address auth)
        internal override(ERC721, ERC721Pausable) returns (address)
    { return super._update(to, id, auth); }
}
`,

// ── ERC-1155: Multi-token — Circle SCP template aea21da6 ──────────────────
erc1155: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import "@openzeppelin/contracts/token/ERC1155/extensions/ERC1155Pausable.sol";
import "@openzeppelin/contracts/token/ERC1155/extensions/ERC1155Supply.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

/**
 * @title GlowMultiToken
 * @notice ERC-1155 matching Circle SCP template aea21da6-0aa2-4971-9a1a-5098842b1248
 * @dev mintTo(address,uint256,string,uint256) matches Circle SCP API signature.
 *      OpenZeppelin v5.0.2 — _update(from,to,ids,values) override.
 */
contract GlowMultiToken is ERC1155, ERC1155Pausable, ERC1155Supply, AccessControl {
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");

    string  public name;
    address public primarySaleRecipient;
    address public royaltyRecipient;
    uint96  public royaltyPercent;

    event TokenMinted(address indexed to, uint256 indexed id, uint256 amount);

    constructor(
        string memory name_,
        address defaultAdmin,
        address primarySaleRecipient_,
        address royaltyRecipient_,
        uint96  royaltyPercent_
    ) ERC1155("") {
        name                 = name_;
        primarySaleRecipient = primarySaleRecipient_;
        royaltyRecipient     = royaltyRecipient_;
        royaltyPercent       = royaltyPercent_;
        _grantRole(DEFAULT_ADMIN_ROLE, defaultAdmin);
        _grantRole(MINTER_ROLE, defaultAdmin);
        _grantRole(PAUSER_ROLE, defaultAdmin);
    }

    // Matches Circle SCP API: abiFunctionSignature "mintTo(address,uint256,string,uint256)"
    function mintTo(address to, uint256 id, string calldata uri_, uint256 amount)
        external onlyRole(MINTER_ROLE) whenNotPaused
    {
        _mint(to, id, amount, "");
        if (bytes(uri_).length > 0) emit URI(uri_, id);
        emit TokenMinted(to, id, amount);
    }

    function mintBatch(address to, uint256[] calldata ids, uint256[] calldata amounts)
        external onlyRole(MINTER_ROLE) whenNotPaused
    { _mintBatch(to, ids, amounts, ""); }

    function pause()   external onlyRole(PAUSER_ROLE) { _pause(); }
    function unpause() external onlyRole(PAUSER_ROLE) { _unpause(); }
    function setURI(string calldata newUri) external onlyRole(DEFAULT_ADMIN_ROLE) { _setURI(newUri); }

    // OZ v5: single _update covers all three bases
    function _update(address from, address to, uint256[] memory ids, uint256[] memory values)
        internal override(ERC1155, ERC1155Pausable, ERC1155Supply)
    { super._update(from, to, ids, values); }

    function supportsInterface(bytes4 id)
        public view override(ERC1155, AccessControl) returns (bool)
    { return super.supportsInterface(id); }
}
`,

// ── Simple Storage — no imports, compiles instantly ───────────────────────
simple: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title SimpleStorage
 * @notice No imports — compiles and deploys instantly on Arc Testnet.
 */
contract SimpleStorage {
    address public owner;
    uint256 private _value;
    string  private _message;

    event ValueChanged(uint256 newValue);
    event MessageChanged(string newMessage);

    error NotOwner();

    modifier onlyOwner() { if (msg.sender != owner) revert NotOwner(); _; }

    constructor(uint256 initialValue, string memory initialMessage) {
        owner    = msg.sender;
        _value   = initialValue;
        _message = initialMessage;
    }

    function setValue(uint256 v) external onlyOwner { _value = v; emit ValueChanged(v); }
    function setMessage(string calldata m) external onlyOwner { _message = m; emit MessageChanged(m); }
    function getValue()   external view returns (uint256) { return _value; }
    function getMessage() external view returns (string memory) { return _message; }
}
`,

// ── DeFi Staking — USDC staking on Arc Testnet ────────────────────────────
staking: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title GlowStaking
 * @notice Stake USDC (Arc Testnet native, 6 decimals), earn reward tokens.
 * @dev OpenZeppelin v5.0.2 — Ownable constructor requires initialOwner param.
 */
contract GlowStaking is ReentrancyGuard, Ownable {
    using SafeERC20 for IERC20;

    IERC20 public immutable stakingToken;
    IERC20 public immutable rewardToken;

    uint256 public rewardRate;
    uint256 public lastUpdateTime;
    uint256 public rewardPerTokenStored;
    uint256 public totalStaked;
    uint256 public constant LOCK_PERIOD = 7 days;

    struct UserInfo {
        uint256 balance;
        uint256 rewardPerTokenPaid;
        uint256 pendingRewards;
        uint256 lastStakeTime;
    }
    mapping(address => UserInfo) public users;

    event Staked(address indexed user, uint256 amount);
    event Withdrawn(address indexed user, uint256 amount);
    event RewardClaimed(address indexed user, uint256 reward);

    error ZeroAmount();
    error StillLocked(uint256 unlockAt);
    error NoRewards();

    // OZ v5: Ownable requires initialOwner in constructor
    constructor(address stakingToken_, address rewardToken_, uint256 rewardRate_, address initialOwner)
        Ownable(initialOwner)
    {
        stakingToken  = IERC20(stakingToken_);
        rewardToken   = IERC20(rewardToken_);
        rewardRate    = rewardRate_;
        lastUpdateTime = block.timestamp;
    }

    function rewardPerToken() public view returns (uint256) {
        if (totalStaked == 0) return rewardPerTokenStored;
        return rewardPerTokenStored + (block.timestamp - lastUpdateTime) * rewardRate * 1e18 / totalStaked;
    }

    function earned(address account) public view returns (uint256) {
        UserInfo memory u = users[account];
        return u.balance * (rewardPerToken() - u.rewardPerTokenPaid) / 1e18 + u.pendingRewards;
    }

    modifier updateReward(address account) {
        rewardPerTokenStored = rewardPerToken();
        lastUpdateTime = block.timestamp;
        if (account != address(0)) {
            users[account].pendingRewards = earned(account);
            users[account].rewardPerTokenPaid = rewardPerTokenStored;
        }
        _;
    }

    function stake(uint256 amount) external nonReentrant updateReward(msg.sender) {
        if (amount == 0) revert ZeroAmount();
        stakingToken.safeTransferFrom(msg.sender, address(this), amount);
        users[msg.sender].balance += amount;
        users[msg.sender].lastStakeTime = block.timestamp;
        totalStaked += amount;
        emit Staked(msg.sender, amount);
    }

    function withdraw(uint256 amount) external nonReentrant updateReward(msg.sender) {
        if (amount == 0) revert ZeroAmount();
        uint256 unlock = users[msg.sender].lastStakeTime + LOCK_PERIOD;
        if (block.timestamp < unlock) revert StillLocked(unlock);
        users[msg.sender].balance -= amount;
        totalStaked -= amount;
        stakingToken.safeTransfer(msg.sender, amount);
        emit Withdrawn(msg.sender, amount);
    }

    function claimReward() external nonReentrant updateReward(msg.sender) {
        uint256 reward = users[msg.sender].pendingRewards;
        if (reward == 0) revert NoRewards();
        users[msg.sender].pendingRewards = 0;
        rewardToken.safeTransfer(msg.sender, reward);
        emit RewardClaimed(msg.sender, reward);
    }

    function setRewardRate(uint256 newRate) external onlyOwner updateReward(address(0)) {
        rewardRate = newRate;
    }
}
`,

// ── GlowIDE Treasury — fee collection ─────────────────────────────────────
treasury: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title GlowIDETreasury
 * @notice Collects all GlowIDE platform fees on Arc Testnet.
 * @dev No Counters, no external tokens needed — pure native USDC (Arc gas token).
 */
contract GlowIDETreasury is ReentrancyGuard {
    address public admin;
    address public pendingAdmin;

    uint256 public totalReceived;
    uint256 public totalWithdrawn;
    uint256 public transactionCount;

    struct TxRecord { address from; uint256 amount; string feeType; uint256 timestamp; }
    TxRecord[] public transactions;

    event FeeReceived(address indexed from, uint256 amount, string feeType, uint256 txId);
    event Withdrawn(address indexed to, uint256 amount);
    event AdminTransferInitiated(address indexed candidate);
    event AdminTransferred(address indexed oldAdmin, address indexed newAdmin);

    error NotAdmin();
    error NotPendingAdmin();
    error Insufficient(uint256 need, uint256 have);
    error TransferFailed();
    error ZeroAddress();

    modifier onlyAdmin() { if (msg.sender != admin) revert NotAdmin(); _; }

    constructor(address admin_) {
        if (admin_ == address(0)) revert ZeroAddress();
        admin = admin_;
    }

    receive() external payable { _record(msg.sender, msg.value, "native"); }

    function depositFee(string calldata feeType) external payable {
        _record(msg.sender, msg.value, feeType);
    }

    function _record(address from, uint256 amount, string memory feeType) internal {
        totalReceived += amount;
        transactions.push(TxRecord(from, amount, feeType, block.timestamp));
        emit FeeReceived(from, amount, feeType, transactionCount++);
    }

    function withdraw(address payable to, uint256 amount) external onlyAdmin nonReentrant {
        if (amount > address(this).balance) revert Insufficient(amount, address(this).balance);
        if (to == address(0)) revert ZeroAddress();
        totalWithdrawn += amount;
        (bool ok,) = to.call{value: amount}("");
        if (!ok) revert TransferFailed();
        emit Withdrawn(to, amount);
    }

    function withdrawAll(address payable to) external onlyAdmin nonReentrant {
        uint256 bal = address(this).balance;
        if (to == address(0)) revert ZeroAddress();
        totalWithdrawn += bal;
        (bool ok,) = to.call{value: bal}("");
        if (!ok) revert TransferFailed();
        emit Withdrawn(to, bal);
    }

    function initiateAdminTransfer(address candidate) external onlyAdmin {
        if (candidate == address(0)) revert ZeroAddress();
        pendingAdmin = candidate;
        emit AdminTransferInitiated(candidate);
    }

    function acceptAdminTransfer() external {
        if (msg.sender != pendingAdmin) revert NotPendingAdmin();
        emit AdminTransferred(admin, pendingAdmin);
        admin = pendingAdmin;
        pendingAdmin = address(0);
    }

    function balance()  external view returns (uint256) { return address(this).balance; }
    function txCount()  external view returns (uint256) { return transactionCount; }
    function stats()    external view returns (uint256 bal, uint256 recv, uint256 wdrn, uint256 cnt) {
        return (address(this).balance, totalReceived, totalWithdrawn, transactionCount);
    }
}
`,

};
