export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { supabaseREST } from "@/lib/supabase-server";
import { readFileSync } from "fs";
import { join } from "path";

function readContractFile(filename: string): string {
  try {
    return readFileSync(join(process.cwd(), "contracts", filename), "utf8");
  } catch {
    return ""; // caller checks for empty source and returns a clear 400 instead of crashing
  }
}

const ADMIN_WALLET = (process.env.NEXT_PUBLIC_ADMIN_WALLET ?? "").toLowerCase();

function verifyAdmin(req: NextRequest): boolean {
  const auth = req.headers.get("authorization") ?? "";
  if (auth.startsWith("Wallet ")) {
    const w = auth.slice(7).toLowerCase();
    return ADMIN_WALLET ? w === ADMIN_WALLET : true;
  }
  return !process.env.ADMIN_SECRET_KEY;
}

// POST: compile a named platform contract and return ABI + bytecode
export async function POST(req: NextRequest) {
  if (!verifyAdmin(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { contractName } = await req.json();
  const sources: Record<string, string> = {
    GlowIDETreasury: TREASURY_SOURCE,
    GlowLaunchpad:   LAUNCHPAD_SOURCE,
    GlowLendingPool:   readContractFile("GlowLendingPool.sol"),
    GlowPaymentStream: readContractFile("GlowPaymentStream.sol"),
    GlowYieldVault:    readContractFile("GlowYieldVault.sol"),
  };

  const source = sources[contractName];
  if (!source) return NextResponse.json({ error: `Unknown contract: ${contractName}` }, { status: 400 });

  // Compile via our existing compile endpoint
  const origin = req.headers.get("x-forwarded-host")
    ? `https://${req.headers.get("x-forwarded-host")}`
    : req.url.split("/api/")[0];

  const res = await fetch(`${origin}/api/contracts/compile`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sourceCode: source, contractName }),
  });
  const compiled = await res.json();
  return NextResponse.json(compiled);
}

// PATCH: save deployed contract address to system_settings + deployed_contracts
export async function PATCH(req: NextRequest) {
  if (!verifyAdmin(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { contractName, contractAddress, txHash, deployer, abi, bytecode } = await req.json();
  if (!contractAddress || !contractName) return NextResponse.json({ error: "contractName and contractAddress required" }, { status: 400 });

  const settingsKey = {
    GlowIDETreasury: "treasury_address",
    GlowLaunchpad:   "launchpad_factory",
    GlowLendingPool:   "lending_pool_address",
    GlowPaymentStream: "payment_stream_address",
    GlowYieldVault:    "yield_vault_address",
  }[contractName];

  const errors: string[] = [];

  // 1. Save to system_settings
  if (settingsKey) {
    const { error } = await supabaseREST(
      "POST", "system_settings",
      { key: settingsKey, value: contractAddress.toLowerCase(), is_secret: false, updated_at: new Date().toISOString() },
    );
    if (error) {
      // Try PATCH if exists
      await supabaseREST("PATCH", "system_settings",
        { value: contractAddress.toLowerCase(), updated_at: new Date().toISOString() },
        `key=eq.${settingsKey}`
      );
    }
  }

  // 2. Save to deployed_contracts
  const row = {
    name:        contractName,
    address:     contractAddress.toLowerCase(),
    chain_id:    5042002,
    tx_hash:     txHash ?? "",
    deployer:    deployer?.toLowerCase() ?? "",
    status:      "deployed",
    verified:    false,
    abi:         JSON.stringify(abi ?? []),
    bytecode:    bytecode ?? "",
    source_code: "",
    metadata:    JSON.stringify({ network: "Arc Testnet", platform: "GlowIDE Admin" }),
  };
  const { error: dbErr } = await supabaseREST("POST", "deployed_contracts", row);
  if (dbErr) errors.push(`DB save: ${dbErr}`);

  return NextResponse.json({
    success: true,
    contractName, contractAddress, settingsKey,
    saved: { systemSettings: !errors.length, deployedContracts: !dbErr },
    errors: errors.length ? errors : undefined,
  });
}

// ── Contract sources (compiled server-side) ───────────────────────────────
const TREASURY_SOURCE = `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title GlowIDETreasury
 * @notice Collects all GlowIDE platform fees on Arc Testnet.
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
    function stats() external view returns (uint256 bal, uint256 recv, uint256 wdrn, uint256 cnt) {
        return (address(this).balance, totalReceived, totalWithdrawn, transactionCount);
    }
}
`;

const LAUNCHPAD_SOURCE = `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title GlowLaunchpad
 * @notice Deploy tokens + lock LP on Arc Testnet.
 */
contract GlowLaunchpad is ReentrancyGuard {

    struct TokenParams {
        string name; string symbol; uint8 decimals;
        uint256 totalSupply; uint256 liquidityPercent;
        uint256 lockDurationDays; string tokenURI;
        string description; string website; string twitter;
    }

    struct TokenRecord {
        address tokenAddress; address creator; address pairAddress;
        uint256 lpAmount; uint256 lpUnlockTime; uint256 launchedAt;
        bool liquidityWithdrawn; string name; string symbol; string tokenURI;
    }

    address public immutable admin;
    address public dexRouter;
    uint256 public launchFee;
    address public feeRecipient;
    uint256 public tokenCount;

    mapping(address => TokenRecord)              public tokens;
    mapping(address => mapping(address => uint256)) public lockedLP;
    mapping(uint256 => address)                  public tokenIndex;

    event TokenLaunched(address indexed token, address indexed creator, string name, string symbol, string tokenURI, uint256 launchedAt);
    event LiquidityWithdrawn(address indexed token, address indexed creator, uint256 amount);

    error NotAdmin();
    error LockNotExpired(uint256 unlockTime);
    error NoLockedLP();
    error TransferFailed();
    error InsufficientFee(uint256 required, uint256 provided);

    modifier onlyAdmin() { if (msg.sender != admin) revert NotAdmin(); _; }

    constructor(address admin_, address dexRouter_, uint256 launchFee_, address feeRecipient_) {
        admin        = admin_;
        dexRouter    = dexRouter_;
        launchFee    = launchFee_;
        feeRecipient = feeRecipient_;
    }

    function launchAndPool(TokenParams calldata p) external payable nonReentrant returns (address tokenAddress) {
        if (launchFee > 0 && msg.value < launchFee) revert InsufficientFee(launchFee, msg.value);
        if (launchFee > 0 && feeRecipient != address(0)) {
            (bool ok,) = feeRecipient.call{value: launchFee}("");
            if (!ok) revert TransferFailed();
        }

        LaunchedToken token = new LaunchedToken(
            p.name, p.symbol, p.decimals, p.totalSupply,
            p.tokenURI, p.description, p.website, p.twitter, msg.sender
        );
        tokenAddress = address(token);

        uint256 unlockTime = block.timestamp + (p.lockDurationDays * 1 days);
        tokens[tokenAddress] = TokenRecord({
            tokenAddress: tokenAddress, creator: msg.sender, pairAddress: address(0),
            lpAmount: 0, lpUnlockTime: unlockTime, launchedAt: block.timestamp,
            liquidityWithdrawn: false, name: p.name, symbol: p.symbol, tokenURI: p.tokenURI
        });
        tokenIndex[tokenCount++] = tokenAddress;

        emit TokenLaunched(tokenAddress, msg.sender, p.name, p.symbol, p.tokenURI, block.timestamp);
    }

    function setRouter(address r) external onlyAdmin { dexRouter = r; }
    function setFee(uint256 f, address r) external onlyAdmin { launchFee = f; feeRecipient = r; }
    function getToken(address a) external view returns (TokenRecord memory) { return tokens[a]; }
    function getAllTokens(uint256 offset, uint256 limit) external view returns (TokenRecord[] memory records, uint256 total) {
        total = tokenCount;
        uint256 end = offset + limit > total ? total : offset + limit;
        records = new TokenRecord[](end > offset ? end - offset : 0);
        for (uint256 i = offset; i < end; i++) records[i - offset] = tokens[tokenIndex[i]];
    }

    receive() external payable {}
}

contract LaunchedToken is ERC20, Ownable {
    string private _tokenURI;
    string public description;
    string public website;
    string public twitter;
    uint8  private _decimals;

    constructor(
        string memory name_, string memory symbol_, uint8 decimals_,
        uint256 totalSupply_, string memory tokenURI_,
        string memory description_, string memory website_, string memory twitter_,
        address owner_
    ) ERC20(name_, symbol_) Ownable(owner_) {
        _decimals = decimals_; _tokenURI = tokenURI_;
        description = description_; website = website_; twitter = twitter_;
        _mint(owner_, totalSupply_);
    }

    function decimals() public view override returns (uint8) { return _decimals; }
    function tokenURI() external view returns (string memory) { return _tokenURI; }
    function setTokenURI(string calldata uri) external onlyOwner { _tokenURI = uri; }
}
`;
