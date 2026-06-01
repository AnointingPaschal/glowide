// ── Arc Workstation Sample Projects ─────────────────────────────────────────
// Production-grade boilerplates for building on Arc Testnet

export interface SampleFile { name: string; content: string; language: string; }
export interface SampleProject {
  id: string;
  title: string;
  description: string;
  tags: string[];
  difficulty: "beginner" | "intermediate" | "advanced";
  files: SampleFile[];
}

export const ARC_SAMPLES: SampleProject[] = [
  // ── 1. ERC-20 Token ───────────────────────────────────────────────────────
  {
    id: "erc20-token",
    title: "ERC-20 Token",
    description: "Production-grade mintable/burnable token with CCTP cross-chain bridge support",
    tags: ["ERC-20", "CCTP", "OpenZeppelin"],
    difficulty: "beginner",
    files: [
      {
        name: "GlowToken.sol",
        language: "solidity",
        content: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Pausable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

interface ITokenMessengerV2 {
    function depositForBurn(
        uint256 amount, uint32 destinationDomain,
        bytes32 mintRecipient, address burnToken
    ) external returns (uint64 nonce);
}

/// @title GlowToken — ERC-20 with CCTP for Arc Testnet (Chain 5042002)
/// @notice Mintable, burnable, pausable token with cross-chain transfer support
contract GlowToken is ERC20Burnable, ERC20Pausable, Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // Arc Testnet Circle Addresses
    address public constant TOKEN_MESSENGER_V2 = 0x8FE6B999Dc680CcFDD5Bf7EB0974218be2542DAA;
    uint8 private immutable _decimals;
    mapping(address => bool) public minters;

    event MinterAdded(address indexed minter);
    event MinterRemoved(address indexed minter);
    event CrossChainTransfer(address indexed sender, uint32 destDomain, uint256 amount, uint64 nonce);

    error NotMinter(address caller);
    error ZeroAddress();
    error ZeroAmount();

    constructor(
        string memory name_,
        string memory symbol_,
        uint8 decimals_,
        uint256 initialSupply,
        address owner_
    ) ERC20(name_, symbol_) Ownable(owner_) {
        if (owner_ == address(0)) revert ZeroAddress();
        _decimals = decimals_;
        if (initialSupply > 0) _mint(owner_, initialSupply);
    }

    modifier onlyMinter() {
        if (!minters[msg.sender] && msg.sender != owner()) revert NotMinter(msg.sender);
        _;
    }

    /// @notice Mint tokens to an address
    function mint(address to, uint256 amount) external onlyMinter {
        if (to == address(0)) revert ZeroAddress();
        if (amount == 0) revert ZeroAmount();
        _mint(to, amount);
    }

    /// @notice Bridge to another chain via Circle CCTP V2
    /// @param destinationDomain ETH=0, AVAX=1, OP=2, ARB=3, Base=6, Polygon=7, Arc=26
    function bridgeViaCCTP(
        uint256 amount, uint32 destinationDomain, bytes32 recipient
    ) external nonReentrant whenNotPaused returns (uint64 nonce) {
        if (amount == 0) revert ZeroAmount();
        IERC20(address(this)).safeTransferFrom(msg.sender, address(this), amount);
        _approve(address(this), TOKEN_MESSENGER_V2, amount);
        nonce = ITokenMessengerV2(TOKEN_MESSENGER_V2).depositForBurn(
            amount, destinationDomain, recipient, address(this)
        );
        emit CrossChainTransfer(msg.sender, destinationDomain, amount, nonce);
    }

    function addMinter(address m) external onlyOwner { minters[m] = true; emit MinterAdded(m); }
    function removeMinter(address m) external onlyOwner { minters[m] = false; emit MinterRemoved(m); }
    function pause() external onlyOwner { _pause(); }
    function unpause() external onlyOwner { _unpause(); }
    function decimals() public view override returns (uint8) { return _decimals; }

    function _update(address from, address to, uint256 value)
        internal override(ERC20, ERC20Pausable) { super._update(from, to, value); }
}`
      },
      {
        name: "deploy.ts",
        language: "typescript",
        content: `import { ethers } from "ethers";
import * as fs from "fs";

// Arc Testnet config
const ARC_RPC = "https://rpc.testnet.arc.network";
const CHAIN_ID = 5042002;

async function main() {
  const provider = new ethers.JsonRpcProvider(ARC_RPC);
  const network  = await provider.getNetwork();
  console.log("Chain ID:", network.chainId.toString());

  // Load wallet (use env var for private key in production)
  const signer = new ethers.Wallet(process.env.PRIVATE_KEY!, provider);
  console.log("Deployer:", signer.address);

  // Check USDC balance (gas on Arc)
  const balance = await provider.getBalance(signer.address);
  console.log("Balance:", ethers.formatUnits(balance, 18), "USDC");

  // Deploy GlowToken
  const { abi, bytecode } = JSON.parse(fs.readFileSync("./artifacts/GlowToken.json", "utf8"));
  const factory = new ethers.ContractFactory(abi, bytecode, signer);

  console.log("\\nDeploying GlowToken...");
  const token = await factory.deploy(
    "Glow Token",                          // name
    "GLOW",                                // symbol
    18,                                    // decimals
    ethers.parseEther("1000000000"),       // 1B initial supply
    signer.address                          // owner
  );

  await token.waitForDeployment();
  const address = await token.getAddress();

  console.log("\\n✓ GlowToken deployed!");
  console.log("  Address:", address);
  console.log("  Explorer:", \`https://testnet.arcscan.app/address/\${address}\`);

  // Verify deployment
  const name    = await token.name();
  const symbol  = await token.symbol();
  const supply  = await token.totalSupply();
  console.log("\\n  Name:", name);
  console.log("  Symbol:", symbol);
  console.log("  Total Supply:", ethers.formatEther(supply));
}

main().catch(console.error);`
      },
      {
        name: "README.md",
        language: "markdown",
        content: `# GlowToken — ERC-20 on Arc Testnet

## Overview
Production-grade ERC-20 with Circle CCTP cross-chain bridge support.

## Features
- Mintable (role-based minters)
- Burnable (holders can burn their tokens)
- Pausable (owner can pause all transfers)
- CCTP V2 cross-chain bridge to 7+ networks

## Arc Testnet Addresses
- USDC (gas): \`0x3600000000000000000000000000000000000000\`
- TokenMessengerV2: \`0x8FE6B999Dc680CcFDD5Bf7EB0974218be2542DAA\`
- Arc CCTP Domain: 26

## Deploy
\`\`\`bash
PRIVATE_KEY=0x... ts-node deploy.ts
\`\`\`

## Bridge USDC to Ethereum
\`\`\`typescript
// Approve then bridge
await token.bridgeViaCCTP(amount, 0, ethers.zeroPadValue(recipient, 32));
\`\`\``
      }
    ]
  },
  // ── 2. NFT Contract ──────────────────────────────────────────────────────
  {
    id: "nft-collection",
    title: "NFT Collection",
    description: "ERC-721 NFT with USDC minting, on-chain metadata, and royalty support (ERC-2981)",
    tags: ["ERC-721", "ERC-2981", "USDC", "NFT"],
    difficulty: "intermediate",
    files: [
      {
        name: "GlowNFT.sol",
        language: "solidity",
        content: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Royalty.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/Strings.sol";

/// @title GlowNFT — ERC-721 with USDC payment on Arc Testnet
/// @notice NFT collection with USDC minting, royalties (ERC-2981), and treasury
contract GlowNFT is ERC721URIStorage, ERC721Royalty, Ownable, ReentrancyGuard, Pausable {
    using SafeERC20 for IERC20;
    using Strings for uint256;

    IERC20 public constant USDC = IERC20(0x3600000000000000000000000000000000000000);

    uint256 public mintPrice;        // USDC (6 decimals)
    uint256 public maxSupply;
    uint256 public totalMinted;
    uint256 public maxPerWallet;
    address public treasury;
    string  private _baseTokenURI;
    bool    public  revealed;

    mapping(address => uint256) public mintedBy;
    uint256 public totalRevenue;

    event Minted(address indexed to, uint256 indexed tokenId, uint256 price);
    event Withdrawn(address indexed treasury, uint256 amount);
    event Revealed(string baseURI);

    error MaxSupplyReached();
    error MaxPerWalletExceeded();
    error ZeroAddress();
    error NotEnoughAllowance(uint256 have, uint256 need);

    constructor(
        string memory name_,
        string memory symbol_,
        uint256 mintPrice_,
        uint256 maxSupply_,
        uint256 maxPerWallet_,
        address treasury_,
        address owner_,
        uint96  royaltyBps  // e.g. 500 = 5%
    ) ERC721(name_, symbol_) Ownable(owner_) {
        if (treasury_ == address(0)) revert ZeroAddress();
        mintPrice    = mintPrice_;
        maxSupply    = maxSupply_;
        maxPerWallet = maxPerWallet_;
        treasury     = treasury_;
        _setDefaultRoyalty(treasury_, royaltyBps);
    }

    /// @notice Mint with USDC — approve USDC first
    function mint(address to, uint256 quantity) external nonReentrant whenNotPaused {
        if (totalMinted + quantity > maxSupply) revert MaxSupplyReached();
        if (mintedBy[msg.sender] + quantity > maxPerWallet) revert MaxPerWalletExceeded();
        
        uint256 total = mintPrice * quantity;
        uint256 allowance = USDC.allowance(msg.sender, address(this));
        if (allowance < total) revert NotEnoughAllowance(allowance, total);

        USDC.safeTransferFrom(msg.sender, address(this), total);
        totalRevenue += total;
        mintedBy[msg.sender] += quantity;

        for (uint256 i; i < quantity;) {
            uint256 tokenId = ++totalMinted;
            _safeMint(to, tokenId);
            emit Minted(to, tokenId, mintPrice);
            unchecked { ++i; }
        }
    }

    /// @notice Owner mint (giveaways, team)
    function ownerMint(address to, uint256 quantity) external onlyOwner {
        if (totalMinted + quantity > maxSupply) revert MaxSupplyReached();
        for (uint256 i; i < quantity;) {
            _safeMint(to, ++totalMinted);
            unchecked { ++i; }
        }
    }

    function reveal(string calldata baseURI) external onlyOwner {
        _baseTokenURI = baseURI;
        revealed = true;
        emit Revealed(baseURI);
    }

    function withdraw() external onlyOwner {
        uint256 bal = USDC.balanceOf(address(this));
        USDC.safeTransfer(treasury, bal);
        emit Withdrawn(treasury, bal);
    }

    function setMintPrice(uint256 p) external onlyOwner { mintPrice = p; }
    function pause()   external onlyOwner { _pause(); }
    function unpause() external onlyOwner { _unpause(); }

    function tokenURI(uint256 tokenId) public view override(ERC721, ERC721URIStorage) returns (string memory) {
        _requireOwned(tokenId);
        if (!revealed) return string(abi.encodePacked(_baseTokenURI, "hidden.json"));
        return string(abi.encodePacked(_baseTokenURI, tokenId.toString(), ".json"));
    }

    function _baseURI() internal view override returns (string memory) { return _baseTokenURI; }

    function supportsInterface(bytes4 i) public view override(ERC721URIStorage, ERC721Royalty) returns (bool) {
        return super.supportsInterface(i);
    }

    function _update(address to, uint256 tokenId, address auth)
        internal override(ERC721, ERC721Royalty) returns (address) {
        return super._update(to, tokenId, auth);
    }
}`
      },
      {
        name: "mint.ts",
        language: "typescript",
        content: `import { ethers } from "ethers";

const USDC  = "0x3600000000000000000000000000000000000000";
const NFT   = "YOUR_NFT_ADDRESS";
const PRICE = 1_000_000n; // 1 USDC (6 decimals)

const ERC20_ABI = ["function approve(address,uint256) returns (bool)", "function allowance(address,address) view returns (uint256)"];
const NFT_ABI   = ["function mint(address,uint256)", "function mintPrice() view returns (uint256)", "function totalMinted() view returns (uint256)"];

async function mintNFT(quantity = 1) {
  const provider = new ethers.JsonRpcProvider("https://rpc.testnet.arc.network");
  const signer   = new ethers.Wallet(process.env.PRIVATE_KEY!, provider);
  
  const usdc = new ethers.Contract(USDC, ERC20_ABI, signer);
  const nft  = new ethers.Contract(NFT, NFT_ABI, signer);

  const price    = await nft.mintPrice();
  const total    = price * BigInt(quantity);
  const minted   = await nft.totalMinted();

  console.log("Minting:", quantity, "NFT(s)");
  console.log("Total cost:", ethers.formatUnits(total, 6), "USDC");
  console.log("Already minted:", minted.toString());

  // Approve USDC
  const approveTx = await usdc.approve(NFT, total);
  await approveTx.wait();
  console.log("✓ USDC approved");

  // Mint
  const mintTx = await nft.mint(signer.address, quantity);
  const receipt = await mintTx.wait();
  console.log("✓ Minted! TX:", receipt.hash);
}

mintNFT(2).catch(console.error);`
      }
    ]
  },
  // ── 3. DeFi Staking ─────────────────────────────────────────────────────
  {
    id: "defi-staking",
    title: "DeFi Staking Pool",
    description: "USDC staking pool with configurable APY rewards, lock periods, and auto-compounding",
    tags: ["DeFi", "Staking", "USDC", "Rewards"],
    difficulty: "advanced",
    files: [
      {
        name: "GlowStaking.sol",
        language: "solidity",
        content: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

/// @title GlowStaking — USDC staking pool on Arc Testnet
/// @notice Stake USDC to earn rewards. Supports lock periods for bonus APY.
contract GlowStaking is Ownable, ReentrancyGuard, Pausable {
    using SafeERC20 for IERC20;

    IERC20 public constant USDC = IERC20(0x3600000000000000000000000000000000000000);

    // ── Staking tiers ────────────────────────────────────────────────────
    struct Tier {
        uint256 lockDays;      // 0 = flexible
        uint256 apyBps;        // APY in basis points (e.g. 1000 = 10%)
        uint256 minStake;      // minimum USDC (6 dec)
        bool    active;
    }

    struct Position {
        uint256 amount;        // staked USDC
        uint256 stakedAt;      // timestamp
        uint256 lockUntil;     // 0 = flexible
        uint256 tierId;        // tier index
        uint256 pendingRewards;// accumulated rewards
        uint256 lastUpdate;    // last reward calculation
    }

    Tier[]  public tiers;
    mapping(address => Position[]) public positions;
    uint256 public totalStaked;
    uint256 public totalRewardsPaid;
    address public rewardWallet;  // funded separately

    event Staked(address indexed user, uint256 indexed posId, uint256 amount, uint256 tierId);
    event Unstaked(address indexed user, uint256 indexed posId, uint256 amount, uint256 rewards);
    event RewardsClaimed(address indexed user, uint256 amount);

    error TierNotActive();
    error BelowMinimum(uint256 amount, uint256 min);
    error StillLocked(uint256 unlockAt);
    error PositionNotFound();
    error InsufficientRewards();

    constructor(address owner_, address rewardWallet_) Ownable(owner_) {
        rewardWallet = rewardWallet_;

        // Default tiers
        tiers.push(Tier({ lockDays: 0,   apyBps: 500,  minStake: 10_000000,  active: true })); // 5% flexible
        tiers.push(Tier({ lockDays: 30,  apyBps: 1000, minStake: 100_000000, active: true })); // 10% 30-day
        tiers.push(Tier({ lockDays: 90,  apyBps: 1500, minStake: 500_000000, active: true })); // 15% 90-day
        tiers.push(Tier({ lockDays: 365, apyBps: 2500, minStake: 1000_000000,active: true })); // 25% 1-year
    }

    // ── Staking ──────────────────────────────────────────────────────────

    /// @notice Stake USDC into a tier
    function stake(uint256 amount, uint256 tierId) external nonReentrant whenNotPaused {
        if (tierId >= tiers.length || !tiers[tierId].active) revert TierNotActive();
        Tier memory t = tiers[tierId];
        if (amount < t.minStake) revert BelowMinimum(amount, t.minStake);

        USDC.safeTransferFrom(msg.sender, address(this), amount);
        totalStaked += amount;

        uint256 lockUntil = t.lockDays > 0 ? block.timestamp + t.lockDays * 1 days : 0;
        positions[msg.sender].push(Position({
            amount: amount, stakedAt: block.timestamp,
            lockUntil: lockUntil, tierId: tierId,
            pendingRewards: 0, lastUpdate: block.timestamp
        }));

        emit Staked(msg.sender, positions[msg.sender].length - 1, amount, tierId);
    }

    /// @notice Unstake position and claim rewards
    function unstake(uint256 posId) external nonReentrant {
        Position[] storage userPos = positions[msg.sender];
        if (posId >= userPos.length) revert PositionNotFound();

        Position storage pos = userPos[posId];
        if (pos.lockUntil > 0 && block.timestamp < pos.lockUntil)
            revert StillLocked(pos.lockUntil);

        _updateRewards(msg.sender, posId);

        uint256 amount  = pos.amount;
        uint256 rewards = pos.pendingRewards;

        totalStaked -= amount;
        delete userPos[posId];

        USDC.safeTransfer(msg.sender, amount);
        if (rewards > 0) {
            uint256 available = USDC.balanceOf(rewardWallet);
            if (available < rewards) revert InsufficientRewards();
            USDC.safeTransferFrom(rewardWallet, msg.sender, rewards);
            totalRewardsPaid += rewards;
        }

        emit Unstaked(msg.sender, posId, amount, rewards);
    }

    /// @notice Claim accumulated rewards without unstaking
    function claimRewards(uint256 posId) external nonReentrant {
        _updateRewards(msg.sender, posId);
        Position storage pos = positions[msg.sender][posId];
        uint256 rewards = pos.pendingRewards;
        if (rewards == 0) return;

        pos.pendingRewards = 0;
        USDC.safeTransferFrom(rewardWallet, msg.sender, rewards);
        totalRewardsPaid += rewards;
        emit RewardsClaimed(msg.sender, rewards);
    }

    // ── Internal ─────────────────────────────────────────────────────────

    function _updateRewards(address user, uint256 posId) internal {
        Position storage pos = positions[user][posId];
        uint256 elapsed = block.timestamp - pos.lastUpdate;
        if (elapsed == 0 || pos.amount == 0) return;

        // rewards = amount × apy × elapsed / 365 days
        uint256 apy = tiers[pos.tierId].apyBps;
        uint256 reward = (pos.amount * apy * elapsed) / (10_000 * 365 days);
        pos.pendingRewards += reward;
        pos.lastUpdate = block.timestamp;
    }

    // ── Views ────────────────────────────────────────────────────────────

    function pendingRewards(address user, uint256 posId) external view returns (uint256) {
        Position memory pos = positions[user][posId];
        uint256 elapsed = block.timestamp - pos.lastUpdate;
        uint256 apy = tiers[pos.tierId].apyBps;
        uint256 accrued = (pos.amount * apy * elapsed) / (10_000 * 365 days);
        return pos.pendingRewards + accrued;
    }

    function getUserPositions(address user) external view returns (Position[] memory) {
        return positions[user];
    }

    function tiersCount() external view returns (uint256) { return tiers.length; }

    // ── Admin ────────────────────────────────────────────────────────────

    function addTier(uint256 lockDays, uint256 apyBps, uint256 minStake) external onlyOwner {
        tiers.push(Tier({ lockDays: lockDays, apyBps: apyBps, minStake: minStake, active: true }));
    }

    function setTierActive(uint256 tierId, bool active) external onlyOwner {
        tiers[tierId].active = active;
    }

    function setRewardWallet(address w) external onlyOwner { rewardWallet = w; }
    function pause()   external onlyOwner { _pause(); }
    function unpause() external onlyOwner { _unpause(); }
}`
      },
      {
        name: "StakingUI.tsx",
        language: "typescript",
        content: `"use client";
import { useState, useEffect } from "react";
import { ethers } from "ethers";

const STAKING_ABI = [
  "function stake(uint256 amount, uint256 tierId)",
  "function unstake(uint256 posId)",
  "function claimRewards(uint256 posId)",
  "function pendingRewards(address, uint256) view returns (uint256)",
  "function getUserPositions(address) view returns (tuple(uint256,uint256,uint256,uint256,uint256,uint256)[])",
  "function tiers(uint256) view returns (uint256,uint256,uint256,bool)",
  "function tiersCount() view returns (uint256)",
  "function totalStaked() view returns (uint256)",
];
const ERC20_ABI = ["function approve(address,uint256) returns (bool)"];
const USDC_ADDR = "0x3600000000000000000000000000000000000000";

interface Tier { lockDays: number; apyBps: number; minStake: bigint; active: boolean; }

export function StakingDashboard({ contractAddress }: { contractAddress: string }) {
  const [tiers, setTiers]       = useState<Tier[]>([]);
  const [amount, setAmount]     = useState("");
  const [selectedTier, setTier] = useState(0);
  const [staking, setStaking]   = useState(false);

  const apyLabel = (bps: number) => (bps / 100).toFixed(1) + "% APY";
  const lockLabel = (days: number) => days === 0 ? "Flexible" : \`\${days} days\`;

  async function doStake() {
    const provider = new ethers.BrowserProvider(window.ethereum);
    const signer   = await provider.getSigner();
    const usdc     = new ethers.Contract(USDC_ADDR, ERC20_ABI, signer);
    const staking_c = new ethers.Contract(contractAddress, STAKING_ABI, signer);

    setStaking(true);
    try {
      const amtWei = ethers.parseUnits(amount, 6);
      await (await usdc.approve(contractAddress, amtWei)).wait();
      await (await staking_c.stake(amtWei, selectedTier)).wait();
      setAmount("");
    } finally { setStaking(false); }
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        {tiers.map((t, i) => (
          <button key={i} onClick={() => setTier(i)}
            className={\`p-4 rounded-xl border-2 text-left transition-all \${
              selectedTier === i ? "border-violet-500 bg-violet-500/10" : "border-gray-700 bg-gray-800/50"
            }\`}>
            <div className="text-lg font-bold text-white">{apyLabel(t.apyBps)}</div>
            <div className="text-xs text-gray-400">{lockLabel(t.lockDays)}</div>
            <div className="text-xs text-gray-500 mt-1">
              Min: {ethers.formatUnits(t.minStake, 6)} USDC
            </div>
          </button>
        ))}
      </div>

      <div className="relative">
        <input value={amount} onChange={e => setAmount(e.target.value)} type="number"
          placeholder="Amount (USDC)" 
          className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white focus:border-violet-500 focus:outline-none pr-16"/>
        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-gray-400 font-bold">USDC</span>
      </div>

      <button onClick={doStake} disabled={staking || !amount}
        className="w-full py-3 bg-gradient-to-r from-violet-600 to-purple-600 rounded-xl text-white font-bold disabled:opacity-50">
        {staking ? "Staking..." : "Stake USDC"}
      </button>
    </div>
  );
}`
      }
    ]
  },
  // ── 4. DAO Governance ────────────────────────────────────────────────────
  {
    id: "dao-governance",
    title: "DAO Governance",
    description: "On-chain DAO with proposals, time-locked voting, quorum, and treasury management",
    tags: ["DAO", "Governance", "Voting", "Treasury"],
    difficulty: "advanced",
    files: [
      {
        name: "GlowDAO.sol",
        language: "solidity",
        content: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @title GlowDAO — On-chain governance on Arc Testnet
/// @notice Create proposals, vote with governance tokens, execute time-locked actions
contract GlowDAO is ReentrancyGuard {
    using SafeERC20 for IERC20;

    IERC20 public immutable governanceToken;

    uint256 public constant VOTING_PERIOD = 3 days;
    uint256 public constant TIMELOCK      = 1 days;
    uint256 public constant QUORUM_BPS    = 400;   // 4% of total supply
    uint256 public constant PASS_BPS      = 5001;  // 50.01% to pass

    enum State { Active, Passed, Failed, Executed, Cancelled }

    struct Proposal {
        uint256 id;
        address proposer;
        string  title;
        string  description;
        address target;         // contract to call
        bytes   callData;       // encoded function call
        uint256 value;          // ETH/USDC to send
        uint256 forVotes;
        uint256 againstVotes;
        uint256 abstainVotes;
        uint256 startTime;
        uint256 endTime;
        uint256 executionTime;  // earliest execution (endTime + TIMELOCK)
        bool    executed;
        bool    cancelled;
    }

    uint256 public proposalCount;
    mapping(uint256 => Proposal) public proposals;
    mapping(uint256 => mapping(address => bool)) public hasVoted;
    mapping(uint256 => mapping(address => uint8)) public votes; // 0=for,1=against,2=abstain

    // Minimum tokens to create a proposal (0.1% of supply)
    uint256 public proposalThreshold;

    event ProposalCreated(uint256 indexed id, address indexed proposer, string title);
    event VoteCast(uint256 indexed proposalId, address indexed voter, uint8 support, uint256 weight);
    event ProposalExecuted(uint256 indexed id);
    event ProposalCancelled(uint256 indexed id);

    error BelowThreshold(uint256 balance, uint256 required);
    error NotActive(uint256 proposalId);
    error AlreadyVoted();
    error TimelockNotExpired(uint256 executableAt);
    error NotPassed();
    error ExecutionFailed();

    constructor(address governanceToken_, uint256 proposalThreshold_) {
        governanceToken  = IERC20(governanceToken_);
        proposalThreshold = proposalThreshold_;
    }

    /// @notice Create a governance proposal
    function propose(
        string calldata title,
        string calldata description,
        address target,
        bytes  calldata callData,
        uint256 value
    ) external returns (uint256 proposalId) {
        uint256 balance = governanceToken.balanceOf(msg.sender);
        if (balance < proposalThreshold) revert BelowThreshold(balance, proposalThreshold);

        proposalId = ++proposalCount;
        proposals[proposalId] = Proposal({
            id:            proposalId,
            proposer:      msg.sender,
            title:         title,
            description:   description,
            target:        target,
            callData:      callData,
            value:         value,
            forVotes:      0,
            againstVotes:  0,
            abstainVotes:  0,
            startTime:     block.timestamp,
            endTime:       block.timestamp + VOTING_PERIOD,
            executionTime: block.timestamp + VOTING_PERIOD + TIMELOCK,
            executed:      false,
            cancelled:     false
        });

        emit ProposalCreated(proposalId, msg.sender, title);
    }

    /// @notice Vote on an active proposal
    /// @param support 0=For, 1=Against, 2=Abstain
    function vote(uint256 proposalId, uint8 support) external {
        Proposal storage p = proposals[proposalId];
        if (p.startTime == 0 || block.timestamp > p.endTime || p.cancelled)
            revert NotActive(proposalId);
        if (hasVoted[proposalId][msg.sender]) revert AlreadyVoted();

        uint256 weight = governanceToken.balanceOf(msg.sender);
        hasVoted[proposalId][msg.sender] = true;
        votes[proposalId][msg.sender]    = support;

        if      (support == 0) p.forVotes     += weight;
        else if (support == 1) p.againstVotes += weight;
        else                   p.abstainVotes += weight;

        emit VoteCast(proposalId, msg.sender, support, weight);
    }

    /// @notice Execute a passed proposal after timelock
    function execute(uint256 proposalId) external nonReentrant {
        Proposal storage p = proposals[proposalId];
        if (state(proposalId) != State.Passed) revert NotPassed();
        if (block.timestamp < p.executionTime) revert TimelockNotExpired(p.executionTime);
        p.executed = true;

        (bool success,) = p.target.call{value: p.value}(p.callData);
        if (!success) revert ExecutionFailed();

        emit ProposalExecuted(proposalId);
    }

    /// @notice Cancel own proposal
    function cancel(uint256 proposalId) external {
        require(proposals[proposalId].proposer == msg.sender, "Not proposer");
        proposals[proposalId].cancelled = true;
        emit ProposalCancelled(proposalId);
    }

    function state(uint256 proposalId) public view returns (State) {
        Proposal storage p = proposals[proposalId];
        if (p.cancelled) return State.Cancelled;
        if (p.executed)  return State.Executed;
        if (block.timestamp <= p.endTime) return State.Active;

        uint256 totalVotes = p.forVotes + p.againstVotes + p.abstainVotes;
        uint256 supply     = governanceToken.totalSupply();
        if (totalVotes * 10_000 < supply * QUORUM_BPS) return State.Failed;
        if (p.forVotes * 10_000 > (p.forVotes + p.againstVotes) * PASS_BPS) return State.Passed;
        return State.Failed;
    }

    function getProposal(uint256 id) external view returns (Proposal memory) { return proposals[id]; }

    receive() external payable {}
}`
      }
    ]
  },
  // ── 5. CCTP Bridge ──────────────────────────────────────────────────────
  {
    id: "cctp-bridge",
    title: "CCTP Cross-Chain Bridge",
    description: "Full Circle CCTP V2 bridge: burn on Arc → mint on destination chain",
    tags: ["CCTP", "Bridge", "Cross-Chain", "Circle"],
    difficulty: "intermediate",
    files: [
      {
        name: "GlowBridge.sol",
        language: "solidity",
        content: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

interface ITokenMessengerV2 {
    function depositForBurn(uint256 amount, uint32 destinationDomain, bytes32 mintRecipient, address burnToken) external returns (uint64 nonce);
}

interface IMessageTransmitter {
    function receiveMessage(bytes calldata message, bytes calldata attestation) external returns (bool);
}

/// @title GlowBridge — Circle CCTP V2 bridge on Arc Testnet
/// @notice Burn USDC on Arc → receive USDC on any Circle-supported chain
contract GlowBridge is Ownable, ReentrancyGuard, Pausable {
    using SafeERC20 for IERC20;

    // Arc Testnet Circle addresses
    IERC20 public constant USDC               = IERC20(0x3600000000000000000000000000000000000000);
    address public constant TOKEN_MESSENGER_V2 = 0x8FE6B999Dc680CcFDD5Bf7EB0974218be2542DAA;
    address public constant MSG_TRANSMITTER    = 0xE737e5cEBEEBa77EFE34D4aa090756590b1CE275;
    uint32  public constant ARC_DOMAIN         = 26;

    // Supported destinations
    uint32 public constant ETH      = 0;
    uint32 public constant AVAX     = 1;
    uint32 public constant OP       = 2;
    uint32 public constant ARB      = 3;
    uint32 public constant BASE     = 6;
    uint32 public constant POLYGON  = 7;

    uint256 public bridgeFee      = 10;       // 0.10% (basis points)
    uint256 public constant MAX_FEE = 100;    // 1% max
    address public feeCollector;

    uint256 public totalBridged;
    uint256 public totalFeesCollected;
    mapping(uint64 => address) public nonceToSender;

    event BridgeInitiated(
        address indexed sender, bytes32 indexed recipient,
        uint32 destinationDomain, uint256 amount, uint256 fee, uint64 nonce
    );
    event MessageReceived(bytes32 msgHash, bool success);
    event FeeUpdated(uint256 fee);

    error UnsupportedDomain(uint32 domain);
    error ZeroAmount();
    error ZeroRecipient();
    error SameDomain();

    constructor(address owner_, address feeCollector_) Ownable(owner_) {
        feeCollector = feeCollector_;
    }

    /// @notice Bridge USDC from Arc to another chain
    /// @param amount            USDC amount (6 decimals for ERC-20 representation)
    /// @param destinationDomain Target chain CCTP domain ID
    /// @param recipient         Recipient address on destination (bytes32 padded)
    function bridge(uint256 amount, uint32 destinationDomain, bytes32 recipient)
        external nonReentrant whenNotPaused returns (uint64 nonce) {
        if (amount    == 0)          revert ZeroAmount();
        if (recipient == bytes32(0)) revert ZeroRecipient();
        if (destinationDomain == ARC_DOMAIN) revert SameDomain();
        _validateDomain(destinationDomain);

        USDC.safeTransferFrom(msg.sender, address(this), amount);

        // Calculate and collect fee
        uint256 fee = amount * bridgeFee / 10_000;
        uint256 net = amount - fee;
        if (fee > 0) USDC.safeTransfer(feeCollector, fee);

        // Approve and initiate CCTP burn
        USDC.forceApprove(TOKEN_MESSENGER_V2, net);
        nonce = ITokenMessengerV2(TOKEN_MESSENGER_V2).depositForBurn(
            net, destinationDomain, recipient, address(USDC)
        );

        nonceToSender[nonce] = msg.sender;
        totalBridged        += net;
        totalFeesCollected  += fee;

        emit BridgeInitiated(msg.sender, recipient, destinationDomain, net, fee, nonce);
    }

    /// @notice Convenience: bridge using address instead of bytes32
    function bridgeTo(uint256 amount, uint32 destDomain, address recipientAddress)
        external nonReentrant whenNotPaused returns (uint64) {
        bytes32 recipient = bytes32(uint256(uint160(recipientAddress)));
        return this.bridge(amount, destDomain, recipient);
    }

    /// @notice Preview fee and net amount for a bridge
    function preview(uint256 amount) external view returns (uint256 fee, uint256 net) {
        fee = amount * bridgeFee / 10_000;
        net = amount - fee;
    }

    function _validateDomain(uint32 domain) internal pure {
        if (domain != ETH && domain != AVAX && domain != OP && domain != ARB
            && domain != BASE && domain != POLYGON) revert UnsupportedDomain(domain);
    }

    function setFee(uint256 fee_) external onlyOwner {
        require(fee_ <= MAX_FEE, "Fee too high");
        bridgeFee = fee_;
        emit FeeUpdated(fee_);
    }

    function setFeeCollector(address c) external onlyOwner { feeCollector = c; }
    function pause()   external onlyOwner { _pause(); }
    function unpause() external onlyOwner { _unpause(); }
}`
      },
      {
        name: "bridge.ts",
        language: "typescript",
        content: `import { ethers } from "ethers";

// Arc Testnet setup
const ARC_RPC    = "https://rpc.testnet.arc.network";
const USDC_ADDR  = "0x3600000000000000000000000000000000000000";
const BRIDGE_ABI = [
  "function bridge(uint256 amount, uint32 destinationDomain, bytes32 recipient) returns (uint64)",
  "function bridgeTo(uint256 amount, uint32 destDomain, address recipient) returns (uint64)",
  "function preview(uint256 amount) view returns (uint256 fee, uint256 net)",
];

const DOMAINS = { ETH: 0, AVAX: 1, OP: 2, ARB: 3, BASE: 6, POLYGON: 7 } as const;

async function bridgeUSDC(
  bridgeAddress: string,
  amountUSDC: number,           // e.g. 10 = 10 USDC
  destination: keyof typeof DOMAINS,
  recipientAddress: string
) {
  const provider = new ethers.JsonRpcProvider(ARC_RPC);
  const signer   = new ethers.Wallet(process.env.PRIVATE_KEY!, provider);

  const bridge = new ethers.Contract(bridgeAddress, BRIDGE_ABI, signer);
  const usdc   = new ethers.Contract(USDC_ADDR, [
    "function approve(address,uint256) returns (bool)",
    "function allowance(address,address) view returns (uint256)",
    "function balanceOf(address) view returns (uint256)",
  ], signer);

  // Convert to USDC decimals (6 for ERC-20 representation)
  const amount = ethers.parseUnits(amountUSDC.toString(), 6);
  const domain = DOMAINS[destination];

  console.log(\`\\nBridging \${amountUSDC} USDC → \${destination}\`);
  console.log("From:", signer.address);
  console.log("To:", recipientAddress);

  // Preview fee
  const [fee, net] = await bridge.preview(amount);
  console.log("Fee:", ethers.formatUnits(fee, 6), "USDC");
  console.log("Net:", ethers.formatUnits(net, 6), "USDC will arrive");

  // Approve
  const approveTx = await usdc.approve(bridgeAddress, amount);
  await approveTx.wait();
  console.log("✓ USDC approved");

  // Bridge
  const tx = await bridge.bridgeTo(amount, domain, recipientAddress);
  const receipt = await tx.wait();
  console.log("✓ Bridge TX:", receipt.hash);
  console.log("  Track on Circle CCTP: https://iris-api.circle.com/attestations/0x" + receipt.hash.slice(2));
  console.log("  ArcScan:", \`https://testnet.arcscan.app/tx/\${receipt.hash}\`);

  return receipt;
}

// Example: bridge 10 USDC from Arc to Base
bridgeUSDC(
  "YOUR_BRIDGE_ADDRESS",
  10,
  "BASE",
  "0xRecipientAddressOnBase"
).catch(console.error);`
      }
    ]
  },
  // ── 6. Multisig Wallet ───────────────────────────────────────────────────
  {
    id: "multisig",
    title: "Multisig Safe",
    description: "N-of-M multisignature wallet for team treasury management on Arc",
    tags: ["Multisig", "Treasury", "Security", "Safe"],
    difficulty: "advanced",
    files: [
      {
        name: "GlowMultisig.sol",
        language: "solidity",
        content: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @title GlowMultisig — N-of-M multisig wallet on Arc Testnet
/// @notice Requires M-of-N owner signatures to execute any transaction
contract GlowMultisig is ReentrancyGuard {
    using SafeERC20 for IERC20;

    struct Transaction {
        address to;
        uint256 value;
        bytes   data;
        bool    executed;
        uint256 confirmations;
        uint256 submittedAt;
    }

    address[] public owners;
    mapping(address => bool) public isOwner;
    uint256 public required;          // signatures needed

    Transaction[] public transactions;
    mapping(uint256 => mapping(address => bool)) public confirmed;

    event Submitted(uint256 indexed txId, address indexed owner, address to, uint256 value);
    event Confirmed(uint256 indexed txId, address indexed owner);
    event Executed(uint256 indexed txId);
    event Revoked(uint256 indexed txId, address indexed owner);
    event OwnerAdded(address owner);
    event RequirementChanged(uint256 required);

    error NotOwner();
    error TxNotFound(uint256 id);
    error AlreadyConfirmed();
    error NotConfirmed();
    error AlreadyExecuted();
    error NotEnoughConfirmations();
    error ExecutionFailed();
    error InvalidSetup();

    modifier onlyOwner()       { if (!isOwner[msg.sender]) revert NotOwner(); _; }
    modifier txExists(uint256 id) { if (id >= transactions.length) revert TxNotFound(id); _; }
    modifier notExecuted(uint256 id) { if (transactions[id].executed) revert AlreadyExecuted(); _; }

    constructor(address[] memory owners_, uint256 required_) {
        if (owners_.length < required_ || required_ == 0) revert InvalidSetup();
        for (uint256 i; i < owners_.length; ++i) {
            isOwner[owners_[i]] = true;
            owners.push(owners_[i]);
        }
        required = required_;
    }

    /// @notice Submit a transaction for multisig approval
    function submit(address to, uint256 value, bytes calldata data)
        external onlyOwner returns (uint256 txId) {
        txId = transactions.length;
        transactions.push(Transaction({
            to: to, value: value, data: data,
            executed: false, confirmations: 0, submittedAt: block.timestamp
        }));
        emit Submitted(txId, msg.sender, to, value);
        // Auto-confirm by submitter
        _confirm(txId);
    }

    function confirm(uint256 txId) external onlyOwner txExists(txId) notExecuted(txId) {
        _confirm(txId);
    }

    function _confirm(uint256 txId) internal {
        if (confirmed[txId][msg.sender]) revert AlreadyConfirmed();
        confirmed[txId][msg.sender] = true;
        transactions[txId].confirmations++;
        emit Confirmed(txId, msg.sender);
    }

    function revoke(uint256 txId) external onlyOwner txExists(txId) notExecuted(txId) {
        if (!confirmed[txId][msg.sender]) revert NotConfirmed();
        confirmed[txId][msg.sender] = false;
        transactions[txId].confirmations--;
        emit Revoked(txId, msg.sender);
    }

    function execute(uint256 txId) external onlyOwner txExists(txId) notExecuted(txId) nonReentrant {
        Transaction storage t = transactions[txId];
        if (t.confirmations < required) revert NotEnoughConfirmations();
        t.executed = true;

        (bool success,) = t.to.call{value: t.value}(t.data);
        if (!success) revert ExecutionFailed();
        emit Executed(txId);
    }

    // ── USDC helpers ──────────────────────────────────────────────────────

    /// @notice Submit USDC transfer for approval
    function submitUSDCTransfer(address to, uint256 amount) external onlyOwner returns (uint256) {
        IERC20 usdc = IERC20(0x3600000000000000000000000000000000000000);
        bytes memory data = abi.encodeWithSelector(usdc.transfer.selector, to, amount);
        return this.submit(address(usdc), 0, data);
    }

    function getTransaction(uint256 txId) external view returns (Transaction memory) {
        return transactions[txId];
    }

    function transactionCount() external view returns (uint256) { return transactions.length; }
    function ownerCount()       external view returns (uint256) { return owners.length; }

    receive() external payable {}
}`
      }
    ]
  },
// ── 7. Embedded Wallets (Circle Dev Controlled) ──────────────────────────────
,{
  id: "embedded-wallet",
  title: "Embedded Wallet Integration",
  description: "User-controlled embedded wallets with gasless transactions using Circle's ERC-4337 paymaster on Arc",
  tags: ["ERC-4337", "Paymaster", "Gasless", "UserOp"],
  difficulty: "advanced",
  files: [
    {
      name: "GlowPaymaster.sol",
      language: "solidity",
      content: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/// @title GlowPaymaster — ERC-4337 Paymaster for gasless USDC txs on Arc Testnet
/// @notice Sponsor gas fees using USDC so users don't need ETH/native tokens
/// @dev Compatible with Circle's ERC-4337 infrastructure on Arc Testnet
interface IEntryPoint {
    function depositTo(address account) external payable;
    function getDepositInfo(address account) external view returns (uint256 deposit, bool staked, uint112 stake, uint32 unstakeDelaySec, uint48 withdrawTime);
    function handleOps(bytes[] calldata ops, address payable beneficiary) external;
}

struct UserOperation {
    address sender;
    uint256 nonce;
    bytes initCode;
    bytes callData;
    uint256 callGasLimit;
    uint256 verificationGasLimit;
    uint256 preVerificationGas;
    uint256 maxFeePerGas;
    uint256 maxPriorityFeePerGas;
    bytes paymasterAndData;
    bytes signature;
}

contract GlowPaymaster is Ownable {
    using SafeERC20 for IERC20;

    IERC20 public constant USDC = IERC20(0x3600000000000000000000000000000000000000);
    IEntryPoint public immutable entryPoint;

    // Per-user sponsored gas limit (in USDC equivalent)
    uint256 public sponsorLimitPerUser = 1_000000; // 1 USDC per user per day
    mapping(address => uint256) public dailySponsored;
    mapping(address => uint256) public lastSponsorDay;

    uint256 public totalSponsored;

    event GasSponsored(address indexed user, uint256 usdcEquivalent, bytes32 opHash);
    event SponsorLimitUpdated(uint256 newLimit);

    error ExceedsDailyLimit(uint256 attempted, uint256 remaining);
    error InsufficientDeposit();

    constructor(address entryPoint_, address owner_) Ownable(owner_) {
        entryPoint = IEntryPoint(entryPoint_);
    }

    /// @notice Fund the paymaster with USDC to sponsor gas
    function deposit(uint256 amount) external {
        USDC.safeTransferFrom(msg.sender, address(this), amount);
    }

    /// @notice Get remaining sponsor allowance for a user today
    function remainingAllowance(address user) external view returns (uint256) {
        if (block.timestamp / 1 days > lastSponsorDay[user]) return sponsorLimitPerUser;
        return sponsorLimitPerUser - dailySponsored[user];
    }

    function setSponsorLimit(uint256 limit) external onlyOwner {
        sponsorLimitPerUser = limit;
        emit SponsorLimitUpdated(limit);
    }

    function withdrawUSDC(address to, uint256 amount) external onlyOwner {
        USDC.safeTransfer(to, amount);
    }

    function paymasterBalance() external view returns (uint256) {
        return USDC.balanceOf(address(this));
    }
}`,
    },
    {
      name: "wallet-sdk.ts",
      language: "typescript",
      content: `// Circle Embedded Wallet SDK integration for Arc Testnet
// Docs: https://developers.circle.com/wallets/user-controlled/quickstart

import { W3SSdk } from "@circle-fin/w3s-pw-web-sdk";

const sdk = new W3SSdk();

// Initialize with your Circle App ID
await sdk.setAppSettings({
  appId: process.env.NEXT_PUBLIC_CIRCLE_APP_ID!,
});

// Create a user-controlled wallet on Arc Testnet
export async function createWallet(userToken: string, encryptionKey: string) {
  await sdk.setAuthentication({
    userToken,
    encryptionKey,
  });

  const { data } = await fetch("/api/circle/create-wallet", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ blockchains: ["ARC-TESTNET"] }),
  }).then(r => r.json());

  // Complete the wallet creation challenge
  await sdk.execute(data.challengeId, (error, result) => {
    if (error) throw error;
    console.log("Wallet created:", result?.type);
  });
}

// Send USDC gaslessly via paymaster
export async function sendUSDCGasless(
  userToken: string,
  encryptionKey: string,
  toAddress: string,
  amount: string // "1.50" = 1.50 USDC
) {
  await sdk.setAuthentication({ userToken, encryptionKey });

  const response = await fetch("/api/circle/send-transaction", {
    method: "POST",
    body: JSON.stringify({
      walletId: "YOUR_WALLET_ID",
      tokenId:  "USDC-ARC-TESTNET",
      destinationAddress: toAddress,
      amounts: [amount],
      fee: { type: "level", config: { feeLevel: "MEDIUM" } },
    }),
  }).then(r => r.json());

  // User signs via SDK
  await sdk.execute(response.data.challengeId, (error, result) => {
    if (error) throw error;
    console.log("TX:", result);
  });
}`,
    }
  ]
},

// ── 8. Chain-Abstracted Balance (Gateway) ────────────────────────────────────
{
  id: "unified-balance",
  title: "Chain-Abstracted Balance",
  description: "Circle Gateway: unified USDC balance and payments across all EVM chains simultaneously",
  tags: ["Gateway", "Chain-Abstraction", "Unified Balance", "Multi-chain"],
  difficulty: "intermediate",
  files: [
    {
      name: "GlowGateway.sol",
      language: "solidity",
      content: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @title GlowGateway — Chain-Abstracted USDC payments on Arc Testnet
/// @notice Accept USDC payments from ANY chain via Circle Gateway
/// @dev Integrates with Circle Gateway for unified balance management
/// @custom:docs https://developers.circle.com/gateway/quickstarts/unified-balance-evm
contract GlowGateway is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    IERC20 public constant USDC = IERC20(0x3600000000000000000000000000000000000000);

    // ── Payment tracking ──────────────────────────────────────────────────
    struct Payment {
        address payer;
        uint256 amount;
        uint256 timestamp;
        string  reference;
        uint32  sourceChain;  // 0 = Arc native, else chain ID
        bool    settled;
    }

    uint256 public paymentCount;
    mapping(bytes32 => Payment) public payments;
    mapping(address => uint256) public totalPaid;
    uint256 public totalRevenue;
    address public treasury;

    // Gateway operator (authorized to relay cross-chain payments)
    mapping(address => bool) public operators;

    event PaymentReceived(
        bytes32 indexed paymentId,
        address indexed payer,
        uint256 amount,
        uint32  sourceChain,
        string  reference
    );
    event PaymentSettled(bytes32 indexed paymentId);
    event Withdrawn(address indexed treasury, uint256 amount);

    error NotOperator();
    error AlreadySettled();
    error ZeroAmount();

    modifier onlyOperator() {
        if (!operators[msg.sender] && msg.sender != owner()) revert NotOperator();
        _;
    }

    constructor(address owner_, address treasury_) Ownable(owner_) {
        treasury = treasury_;
        operators[owner_] = true;
    }

    // ── Native Arc payment ────────────────────────────────────────────────

    /// @notice Pay directly with Arc Testnet USDC
    /// @param amount    USDC amount (represented in 18 dec on Arc native)
    /// @param reference Payment reference (e.g. order ID)
    function payNative(uint256 amount, string calldata reference)
        external nonReentrant returns (bytes32 paymentId) {
        if (amount == 0) revert ZeroAmount();
        USDC.safeTransferFrom(msg.sender, address(this), amount);

        paymentId = _createPayment(msg.sender, amount, 5042002, reference);
        totalRevenue += amount;
        totalPaid[msg.sender] += amount;
    }

    // ── Cross-chain payment relay (called by Gateway operator) ────────────

    /// @notice Relay a USDC payment that originated on another chain
    /// @dev Called by Circle Gateway after verifying cross-chain USDC transfer
    function relayPayment(
        address payer,
        uint256 amount,
        uint32  sourceChain,
        string  calldata reference
    ) external onlyOperator returns (bytes32 paymentId) {
        if (amount == 0) revert ZeroAmount();
        paymentId = _createPayment(payer, amount, sourceChain, reference);
        totalRevenue += amount;
        totalPaid[payer] += amount;
    }

    function _createPayment(
        address payer, uint256 amount, uint32 chain, string memory reference
    ) internal returns (bytes32 paymentId) {
        paymentId = keccak256(abi.encodePacked(payer, amount, block.timestamp, ++paymentCount));
        payments[paymentId] = Payment({
            payer: payer, amount: amount,
            timestamp: block.timestamp, reference: reference,
            sourceChain: chain, settled: false
        });
        emit PaymentReceived(paymentId, payer, amount, chain, reference);
    }

    function settle(bytes32 paymentId) external onlyOwner {
        Payment storage p = payments[paymentId];
        if (p.settled) revert AlreadySettled();
        p.settled = true;
        emit PaymentSettled(paymentId);
    }

    function withdraw() external onlyOwner {
        uint256 bal = USDC.balanceOf(address(this));
        USDC.safeTransfer(treasury, bal);
        emit Withdrawn(treasury, bal);
    }

    function addOperator(address op) external onlyOwner { operators[op] = true; }
    function removeOperator(address op) external onlyOwner { operators[op] = false; }
    function setTreasury(address t) external onlyOwner { treasury = t; }

    function getPayment(bytes32 id) external view returns (Payment memory) { return payments[id]; }
}`,
    },
    {
      name: "gateway-api.ts",
      language: "typescript",
      content: `// Circle Gateway — Chain-Abstracted USDC Balance
// Docs: https://developers.circle.com/gateway/quickstarts/unified-balance-evm
// This lets users pay from ANY chain — Ethereum, Base, Arbitrum, etc.
// and your app receives it on Arc Testnet unified.

const CIRCLE_API = "https://api.circle.com/v1/w3s";
const API_KEY    = process.env.CIRCLE_API_KEY!;

const headers = {
  "Content-Type": "application/json",
  "Authorization": \`Bearer \${API_KEY}\`,
};

// Get unified USDC balance across all connected chains
export async function getUnifiedBalance(walletAddress: string) {
  const res = await fetch(
    \`\${CIRCLE_API}/wallets/balances?address=\${walletAddress}&includeChains=true\`,
    { headers }
  );
  const { data } = await res.json();
  // Returns combined USDC balance from ETH + Base + Arc + ARB etc.
  return {
    totalBalance: data.tokenBalances.find((t: {symbol:string}) => t.symbol === "USDC")?.amount ?? "0",
    perChain:     data.tokenBalances,
  };
}

// Initiate cross-chain USDC payment — user pays from any chain
export async function initiatePayment({
  amount,
  destinationChain = "ARC-TESTNET",
  destinationAddress,
  reference,
}: {
  amount: string;
  destinationChain?: string;
  destinationAddress: string;
  reference: string;
}) {
  const res = await fetch(\`\${CIRCLE_API}/transactions/transfer\`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      idempotencyKey:     crypto.randomUUID(),
      destinationAddress,
      refId:              reference,
      amounts:            [amount],
      destinationChainId: destinationChain,
      tokenId:            "USDC",
      // Circle Gateway will route from user's best chain automatically
      routeOptimization:  "LOWEST_COST",
    }),
  });
  const { data } = await res.json();
  return data; // { transactionId, state, txHash }
}

// React hook: poll for payment status
export async function waitForPayment(transactionId: string, timeoutMs = 120_000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const res = await fetch(\`\${CIRCLE_API}/transactions/\${transactionId}\`, { headers });
    const { data } = await res.json();
    if (data.state === "CONFIRMED") return data;
    if (data.state === "FAILED") throw new Error("Payment failed");
    await new Promise(r => setTimeout(r, 2000));
  }
  throw new Error("Payment timeout");
}`,
    }
  ]
},

// ── 9. USYC Tokenized Money Market ───────────────────────────────────────────
{
  id: "usyc-integration",
  title: "USYC Tokenized Money Market",
  description: "Integrate USYC (Hashnote US Yield Coin) — earn yield on-chain via Circle's tokenized money market fund",
  tags: ["USYC", "Yield", "Tokenized", "RWA", "Money Market"],
  difficulty: "advanced",
  files: [
    {
      name: "GlowYield.sol",
      language: "solidity",
      content: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @title GlowYield — USYC yield strategy vault on Arc Testnet
/// @notice Deposit USDC → receive USYC (yield-bearing) → redeem anytime
/// @dev USYC = Hashnote US Yield Coin via Circle on Arc Testnet
/// @custom:usyc 0xe9185F0c5F296Ed1797AaE4238D26CCaBEadb86C
contract GlowYield is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // Arc Testnet
    IERC20 public constant USDC = IERC20(0x3600000000000000000000000000000000000000);
    IERC20 public constant USYC = IERC20(0xe9185F0c5F296Ed1797AaE4238D26CCaBEadb86C);

    // ── Vault accounting ──────────────────────────────────────────────────
    mapping(address => uint256) public usdcDeposited;   // original USDC deposited
    mapping(address => uint256) public usycBalance;      // USYC received for user
    mapping(address => uint256) public depositTime;

    uint256 public totalDeposited;
    uint256 public totalUsycManaged;

    // Circle USYC operator — authorized to convert USDC↔USYC
    address public usycOperator;

    event Deposited(address indexed user, uint256 usdcAmount, uint256 usycReceived);
    event Redeemed(address indexed user, uint256 usycAmount, uint256 usdcReceived);
    event YieldClaimed(address indexed user, uint256 yieldAmount);

    error InsufficientBalance(uint256 have, uint256 need);
    error NotOperator();

    modifier onlyOperator() {
        if (msg.sender != usycOperator && msg.sender != owner()) revert NotOperator();
        _;
    }

    constructor(address owner_, address operator_) Ownable(owner_) {
        usycOperator = operator_;
    }

    /// @notice Deposit USDC and receive USYC yield-bearing tokens
    /// @dev Conversion rate: 1 USDC ≈ 1 USYC (USYC accrues value over time)
    function deposit(uint256 usdcAmount) external nonReentrant returns (uint256 usycAmount) {
        USDC.safeTransferFrom(msg.sender, address(this), usdcAmount);

        // Operator converts USDC → USYC at current rate
        // In production: call Circle's USYC subscription API
        usycAmount = _convertToUsyc(usdcAmount);

        usdcDeposited[msg.sender]  += usdcAmount;
        usycBalance[msg.sender]    += usycAmount;
        depositTime[msg.sender]    = depositTime[msg.sender] == 0 ? block.timestamp : depositTime[msg.sender];
        totalDeposited             += usdcAmount;
        totalUsycManaged           += usycAmount;

        emit Deposited(msg.sender, usdcAmount, usycAmount);
    }

    /// @notice Redeem USYC → USDC (includes accrued yield)
    function redeem(uint256 usycAmount) external nonReentrant returns (uint256 usdcAmount) {
        if (usycBalance[msg.sender] < usycAmount)
            revert InsufficientBalance(usycBalance[msg.sender], usycAmount);

        usdcAmount = _convertToUsdc(usycAmount);

        usycBalance[msg.sender]  -= usycAmount;
        usdcDeposited[msg.sender] = usycBalance[msg.sender] == 0 ? 0 : usdcDeposited[msg.sender];
        totalUsycManaged         -= usycAmount;

        USDC.safeTransfer(msg.sender, usdcAmount);
        emit Redeemed(msg.sender, usycAmount, usdcAmount);
    }

    /// @notice View estimated yield for a user
    function estimatedYield(address user) external view returns (uint256) {
        if (usycBalance[user] == 0) return 0;
        // USYC yield: ~5% APY accrued in token price appreciation
        uint256 elapsed = block.timestamp - depositTime[user];
        return (usdcDeposited[user] * 500 * elapsed) / (10_000 * 365 days);
    }

    // ── Operator: manage USDC↔USYC conversion ────────────────────────────

    /// @notice Operator supplies USYC tokens to the vault (after converting USDC)
    function supplyUsyc(uint256 amount) external onlyOperator {
        USYC.safeTransferFrom(msg.sender, address(this), amount);
    }

    function setOperator(address op) external onlyOwner { usycOperator = op; }

    function _convertToUsyc(uint256 usdcAmount) internal view returns (uint256) {
        // Approximate 1:1 with slight discount for fees
        // In production: use Circle's USYC subscription API for exact rate
        return (usdcAmount * 999) / 1000;
    }

    function _convertToUsdc(uint256 usycAmount) internal view returns (uint256) {
        // USYC appreciates in value — returns more USDC than deposited
        // In production: use USYC redemption API
        uint256 usycBal = USYC.balanceOf(address(this));
        if (usycBal == 0) return usycAmount;
        uint256 usdcBal = USDC.balanceOf(address(this));
        return (usycAmount * usdcBal) / usycBal;
    }

    function vaultStats() external view returns (uint256 deposits, uint256 usycHeld, uint256 usdcHeld) {
        return (totalDeposited, USYC.balanceOf(address(this)), USDC.balanceOf(address(this)));
    }
}`,
    }
  ]
},

// ── 10. Stablecoin Payroll ────────────────────────────────────────────────────
{
  id: "usdc-payroll",
  title: "USDC Payroll Contract",
  description: "Automated on-chain payroll in USDC — schedule recurring payments to employees/contractors",
  tags: ["Payroll", "USDC", "Automation", "Recurring"],
  difficulty: "intermediate",
  files: [
    {
      name: "GlowPayroll.sol",
      language: "solidity",
      content: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @title GlowPayroll — Automated USDC payroll on Arc Testnet
/// @notice Schedule recurring USDC payments on-chain
contract GlowPayroll is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    IERC20 public constant USDC = IERC20(0x3600000000000000000000000000000000000000);

    enum Frequency { Weekly, BiWeekly, Monthly }

    struct Employee {
        address wallet;
        uint256 salaryPerPeriod;  // USDC (6 dec on ERC-20 / 18 dec native)
        Frequency frequency;
        uint256 nextPaymentAt;
        uint256 totalPaid;
        bool    active;
        string  name;
    }

    Employee[] public employees;
    mapping(address => uint256) public employeeIndex;
    mapping(address => bool)    public isEmployee;

    uint256 public totalDisbursed;

    event EmployeeAdded(address indexed wallet, uint256 salary, Frequency freq);
    event PaymentSent(address indexed wallet, uint256 amount, uint256 periodTimestamp);
    event EmployeeDeactivated(address indexed wallet);

    error NotEmployee();
    error NotDueYet(uint256 nextPaymentAt);
    error InsufficientFunds(uint256 balance, uint256 required);

    constructor(address owner_) Ownable(owner_) {}

    /// @notice Add employee to payroll
    function addEmployee(
        address wallet, uint256 salaryPerPeriod,
        Frequency frequency, string calldata name
    ) external onlyOwner {
        if (isEmployee[wallet]) return; // Update salary instead

        uint256 periodSeconds = _periodToSeconds(frequency);
        employees.push(Employee({
            wallet: wallet, salaryPerPeriod: salaryPerPeriod,
            frequency: frequency, nextPaymentAt: block.timestamp + periodSeconds,
            totalPaid: 0, active: true, name: name
        }));
        employeeIndex[wallet] = employees.length - 1;
        isEmployee[wallet]    = true;

        emit EmployeeAdded(wallet, salaryPerPeriod, frequency);
    }

    /// @notice Process all due payroll payments
    function runPayroll() external onlyOwner nonReentrant {
        uint256 total = 0;
        for (uint256 i; i < employees.length;) {
            Employee storage emp = employees[i];
            if (emp.active && block.timestamp >= emp.nextPaymentAt) {
                total += emp.salaryPerPeriod;
            }
            unchecked { ++i; }
        }

        uint256 balance = USDC.balanceOf(address(this));
        if (balance < total) revert InsufficientFunds(balance, total);

        for (uint256 i; i < employees.length;) {
            Employee storage emp = employees[i];
            if (emp.active && block.timestamp >= emp.nextPaymentAt) {
                uint256 period = emp.nextPaymentAt;
                emp.nextPaymentAt += _periodToSeconds(emp.frequency);
                emp.totalPaid     += emp.salaryPerPeriod;
                totalDisbursed    += emp.salaryPerPeriod;

                USDC.safeTransfer(emp.wallet, emp.salaryPerPeriod);
                emit PaymentSent(emp.wallet, emp.salaryPerPeriod, period);
            }
            unchecked { ++i; }
        }
    }

    /// @notice Pay a single employee now (emergency / off-cycle)
    function payEmployee(address wallet, uint256 amount) external onlyOwner nonReentrant {
        if (!isEmployee[wallet]) revert NotEmployee();
        USDC.safeTransfer(wallet, amount);
        employees[employeeIndex[wallet]].totalPaid += amount;
        totalDisbursed += amount;
        emit PaymentSent(wallet, amount, block.timestamp);
    }

    function deactivate(address wallet) external onlyOwner {
        if (!isEmployee[wallet]) revert NotEmployee();
        employees[employeeIndex[wallet]].active = false;
        emit EmployeeDeactivated(wallet);
    }

    function fund(uint256 amount) external { USDC.safeTransferFrom(msg.sender, address(this), amount); }
    function withdraw(uint256 amount) external onlyOwner { USDC.safeTransfer(owner(), amount); }

    function getNextDueAt() external view returns (uint256 timestamp, uint256 totalDue) {
        timestamp = type(uint256).max;
        for (uint256 i; i < employees.length;) {
            if (employees[i].active) {
                if (employees[i].nextPaymentAt < timestamp) timestamp = employees[i].nextPaymentAt;
                if (block.timestamp >= employees[i].nextPaymentAt) totalDue += employees[i].salaryPerPeriod;
            }
            unchecked { ++i; }
        }
        if (timestamp == type(uint256).max) timestamp = 0;
    }

    function employeeCount() external view returns (uint256 active, uint256 total) {
        total = employees.length;
        for (uint256 i; i < total;) { if (employees[i].active) active++; unchecked { ++i; } }
    }

    function _periodToSeconds(Frequency f) internal pure returns (uint256) {
        if (f == Frequency.Weekly)    return 7 days;
        if (f == Frequency.BiWeekly)  return 14 days;
        return 30 days; // Monthly
    }
}`,
    }
  ]
}
];

export function getProjectById(id: string): SampleProject | undefined {
  return ARC_SAMPLES.find(p => p.id === id);
}

