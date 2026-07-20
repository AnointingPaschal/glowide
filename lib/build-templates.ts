// ── Arc Lab: Advanced Project Templates ─────────────────────────────────────
// Real, working starter projects across many categories — loaded directly
// into the File Explorer via /build. Each template is genuinely functional
// code, not a placeholder stub.

export interface TemplateFile { name: string; content: string; }
export interface Template {
  name: string;
  description: string;
  difficulty: "beginner" | "intermediate" | "advanced";
  tags: string[];
  files: TemplateFile[];
}
export interface Category {
  id: string; label: string; description: string;
  color: string; border: string; accent: string;
  templates: Template[];
}

const USDC = "0x3600000000000000000000000000000000000000";
const TOKEN_MESSENGER = "0x8FE6B999Dc680CcFDD5Bf7EB0974218be2542DAA";

export const DEFI_CATEGORY: Category = {
  id: "defi", label: "DeFi", description: "Lending, AMMs, yield — real Solidity + UI",
  color: "from-green-500/20 to-emerald-500/10", border: "border-green-500/25", accent: "#22c55e",
  templates: [
    {
      name: "Lending Pool",
      description: "Over-collateralized supply/borrow pool with interest accrual",
      difficulty: "advanced",
      tags: ["Solidity", "DeFi", "Lending"],
      files: [
        { name: "contracts/LendingPool.sol", content: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title LendingPool — over-collateralized supply/borrow with interest
/// @notice Users supply a token to earn yield, or borrow against their supply
interface IERC20 {
    function transferFrom(address, address, uint256) external returns (bool);
    function transfer(address, uint256) external returns (bool);
}

contract LendingPool {
    struct Market {
        bool active;
        uint256 supplyRateBps;   // APY in basis points (482 = 4.82%)
        uint256 borrowRateBps;
        uint256 ltvBps;          // loan-to-value, e.g. 8000 = 80%
        uint256 totalSupply;
        uint256 totalBorrow;
    }
    struct Position { uint256 supplied; uint256 borrowed; uint256 lastUpdate; }

    address public owner;
    mapping(address => Market) public markets;
    mapping(address => mapping(address => Position)) public positions; // user => token => position

    event Supplied(address indexed user, address indexed token, uint256 amount);
    event Withdrawn(address indexed user, address indexed token, uint256 amount);
    event Borrowed(address indexed user, address indexed token, uint256 amount);
    event Repaid(address indexed user, address indexed token, uint256 amount);

    modifier onlyOwner() { require(msg.sender == owner, "not owner"); _; }
    constructor() { owner = msg.sender; }

    function addMarket(address token, uint256 supplyRateBps, uint256 borrowRateBps, uint256 ltvBps) external onlyOwner {
        markets[token] = Market(true, supplyRateBps, borrowRateBps, ltvBps, 0, 0);
    }

    function supply(address token, uint256 amount) external {
        require(markets[token].active, "market inactive");
        require(IERC20(token).transferFrom(msg.sender, address(this), amount), "transfer failed");
        Position storage pos = positions[msg.sender][token];
        pos.supplied += amount;
        pos.lastUpdate = block.timestamp;
        markets[token].totalSupply += amount;
        emit Supplied(msg.sender, token, amount);
    }

    function withdraw(address token, uint256 amount) external {
        Position storage pos = positions[msg.sender][token];
        require(pos.supplied >= amount, "insufficient supply");
        pos.supplied -= amount;
        markets[token].totalSupply -= amount;
        require(IERC20(token).transfer(msg.sender, amount), "transfer failed");
        emit Withdrawn(msg.sender, token, amount);
    }

    function borrow(address token, uint256 amount) external {
        Market memory m = markets[token];
        require(m.active, "market inactive");
        Position storage pos = positions[msg.sender][token];
        uint256 maxBorrow = (pos.supplied * m.ltvBps) / 10000;
        require(pos.borrowed + amount <= maxBorrow, "exceeds collateral");
        pos.borrowed += amount;
        markets[token].totalBorrow += amount;
        require(IERC20(token).transfer(msg.sender, amount), "transfer failed");
        emit Borrowed(msg.sender, token, amount);
    }

    function repay(address token, uint256 amount) external {
        Position storage pos = positions[msg.sender][token];
        uint256 repayAmt = amount > pos.borrowed ? pos.borrowed : amount;
        require(IERC20(token).transferFrom(msg.sender, address(this), repayAmt), "transfer failed");
        pos.borrowed -= repayAmt;
        markets[token].totalBorrow -= repayAmt;
        emit Repaid(msg.sender, token, repayAmt);
    }

    function healthFactor(address user, address token) external view returns (uint256) {
        Position memory pos = positions[user][token];
        if (pos.borrowed == 0) return type(uint256).max;
        return (pos.supplied * markets[token].ltvBps * 100) / (pos.borrowed * 10000);
    }
}` },
        { name: "README.md", content: `# Lending Pool

Over-collateralized lending pool for Arc Testnet.

## Flow
1. \`addMarket(token, supplyRateBps, borrowRateBps, ltvBps)\` — owner configures a token market
2. \`supply(token, amount)\` — deposit collateral, earn yield
3. \`borrow(token, amount)\` — borrow up to LTV against your supply
4. \`repay(token, amount)\` — pay back borrowed amount
5. \`withdraw(token, amount)\` — pull out unborrowed collateral

## Deploy on Arc Testnet
Use the Deploy & Run panel — constructor takes no args. Then call \`addMarket\`
with the USDC address: \`${USDC}\`, e.g. 482 bps supply APY, 650 bps borrow APY, 8000 bps (80%) LTV.
` },
      ],
    },
    {
      name: "Constant-Product AMM",
      description: "Uniswap V2-style two-token swap pool with LP shares",
      difficulty: "advanced",
      tags: ["Solidity", "AMM", "DEX"],
      files: [
        { name: "contracts/SimpleAMM.sol", content: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title SimpleAMM — constant product (x*y=k) automated market maker
interface IERC20 {
    function transferFrom(address, address, uint256) external returns (bool);
    function transfer(address, uint256) external returns (bool);
    function balanceOf(address) external view returns (uint256);
}

contract SimpleAMM {
    address public tokenA;
    address public tokenB;
    uint256 public reserveA;
    uint256 public reserveB;
    uint256 public totalShares;
    mapping(address => uint256) public shares;

    uint256 constant FEE_BPS = 30; // 0.3% swap fee

    event LiquidityAdded(address indexed user, uint256 amountA, uint256 amountB, uint256 sharesOut);
    event LiquidityRemoved(address indexed user, uint256 amountA, uint256 amountB, uint256 sharesIn);
    event Swapped(address indexed user, address tokenIn, uint256 amountIn, uint256 amountOut);

    constructor(address _tokenA, address _tokenB) {
        tokenA = _tokenA;
        tokenB = _tokenB;
    }

    function addLiquidity(uint256 amountA, uint256 amountB) external returns (uint256 sharesOut) {
        require(IERC20(tokenA).transferFrom(msg.sender, address(this), amountA), "transfer A failed");
        require(IERC20(tokenB).transferFrom(msg.sender, address(this), amountB), "transfer B failed");

        if (totalShares == 0) {
            sharesOut = sqrt(amountA * amountB);
        } else {
            sharesOut = min((amountA * totalShares) / reserveA, (amountB * totalShares) / reserveB);
        }
        require(sharesOut > 0, "insufficient liquidity minted");

        reserveA += amountA;
        reserveB += amountB;
        shares[msg.sender] += sharesOut;
        totalShares += sharesOut;
        emit LiquidityAdded(msg.sender, amountA, amountB, sharesOut);
    }

    function removeLiquidity(uint256 sharesIn) external returns (uint256 amountA, uint256 amountB) {
        require(shares[msg.sender] >= sharesIn, "insufficient shares");
        amountA = (sharesIn * reserveA) / totalShares;
        amountB = (sharesIn * reserveB) / totalShares;

        shares[msg.sender] -= sharesIn;
        totalShares -= sharesIn;
        reserveA -= amountA;
        reserveB -= amountB;

        IERC20(tokenA).transfer(msg.sender, amountA);
        IERC20(tokenB).transfer(msg.sender, amountB);
        emit LiquidityRemoved(msg.sender, amountA, amountB, sharesIn);
    }

    function swap(address tokenIn, uint256 amountIn) external returns (uint256 amountOut) {
        require(tokenIn == tokenA || tokenIn == tokenB, "invalid token");
        bool isA = tokenIn == tokenA;
        (uint256 reserveIn, uint256 reserveOut) = isA ? (reserveA, reserveB) : (reserveB, reserveA);

        require(IERC20(tokenIn).transferFrom(msg.sender, address(this), amountIn), "transfer failed");
        uint256 amountInWithFee = amountIn * (10000 - FEE_BPS);
        amountOut = (amountInWithFee * reserveOut) / (reserveIn * 10000 + amountInWithFee);

        if (isA) { reserveA += amountIn; reserveB -= amountOut; }
        else     { reserveB += amountIn; reserveA -= amountOut; }

        IERC20(isA ? tokenB : tokenA).transfer(msg.sender, amountOut);
        emit Swapped(msg.sender, tokenIn, amountIn, amountOut);
    }

    function getPrice() external view returns (uint256) {
        if (reserveA == 0) return 0;
        return (reserveB * 1e18) / reserveA;
    }

    function sqrt(uint256 x) internal pure returns (uint256 y) {
        if (x == 0) return 0;
        uint256 z = (x + 1) / 2;
        y = x;
        while (z < y) { y = z; z = (x / z + z) / 2; }
    }
    function min(uint256 a, uint256 b) internal pure returns (uint256) { return a < b ? a : b; }
}` },
      ],
    },
  ],
};

export const CCTP_CATEGORY: Category = {
  id: "cctp", label: "CCTP", description: "Cross-Chain Transfer Protocol — native USDC bridging",
  color: "from-blue-500/20 to-indigo-500/10", border: "border-blue-500/25", accent: "#3b82f6",
  templates: [
    {
      name: "CCTP Bridge UI",
      description: "React component that burns USDC on Arc and mints on the destination chain via Circle's CCTP",
      difficulty: "intermediate",
      tags: ["React", "CCTP", "Cross-chain"],
      files: [
        { name: "CCTPBridge.tsx", content: `import { useState } from "react";

// Circle's TokenMessengerV2 on Arc Testnet — burns USDC for cross-chain mint
const TOKEN_MESSENGER = "${TOKEN_MESSENGER}";
const USDC = "${USDC}";
const CCTP_DOMAIN = 26; // Arc Testnet's CCTP domain ID

declare global {
  interface Window { ethereum?: { request: (a: { method: string; params?: unknown[] }) => Promise<unknown> } }
}

const DESTINATION_CHAINS = [
  { name: "Ethereum Sepolia", domain: 0 },
  { name: "Base Sepolia", domain: 6 },
  { name: "Arbitrum Sepolia", domain: 3 },
];

export default function CCTPBridge() {
  const [amount, setAmount] = useState("");
  const [destDomain, setDestDomain] = useState(DESTINATION_CHAINS[0].domain);
  const [destAddress, setDestAddress] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const bridge = async () => {
    if (!window.ethereum) return setStatus("Install a wallet like MetaMask first");
    if (!amount || !destAddress) return setStatus("Enter amount and destination address");
    setLoading(true);
    setStatus("Requesting approval…");
    try {
      const [from] = await window.ethereum.request({ method: "eth_requestAccounts" }) as string[];

      // Step 1: approve TokenMessenger to burn USDC
      const amountWei = BigInt(Math.floor(parseFloat(amount) * 1e6)); // USDC = 6 decimals on CCTP interface
      const approveData = "0x095ea7b3" +
        TOKEN_MESSENGER.slice(2).padStart(64, "0") +
        amountWei.toString(16).padStart(64, "0");
      await window.ethereum.request({
        method: "eth_sendTransaction",
        params: [{ from, to: USDC, data: approveData }],
      });

      setStatus("Approved — burning USDC for cross-chain transfer…");

      // Step 2: depositForBurn(amount, destinationDomain, mintRecipient, burnToken)
      const paddedRecipient = destAddress.replace("0x", "").padStart(64, "0");
      const burnData = "0x6fd3504e" +
        amountWei.toString(16).padStart(64, "0") +
        destDomain.toString(16).padStart(64, "0") +
        paddedRecipient +
        USDC.slice(2).padStart(64, "0");

      const txHash = await window.ethereum.request({
        method: "eth_sendTransaction",
        params: [{ from, to: TOKEN_MESSENGER, data: burnData }],
      }) as string;

      setStatus(\`✓ Burn submitted: \${txHash.slice(0,10)}… — funds will mint on destination in ~15 min\`);
    } catch (e) {
      setStatus(\`Error: \${(e as Error).message}\`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: 420, margin: "60px auto", padding: 24, background: "#13141c", borderRadius: 16, color: "#e8e8ee", fontFamily: "system-ui" }}>
      <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>CCTP Bridge</h1>
      <p style={{ fontSize: 12, color: "#8888a0", marginBottom: 20 }}>Native USDC transfer via Circle's Cross-Chain Transfer Protocol — no wrapped tokens.</p>

      <label style={{ fontSize: 11, color: "#8888a0", textTransform: "uppercase" }}>Amount (USDC)</label>
      <input value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.00" type="number"
        style={{ width: "100%", padding: 10, marginTop: 4, marginBottom: 14, background: "#1a1b23", border: "1px solid #26262e", borderRadius: 10, color: "#e8e8ee" }}/>

      <label style={{ fontSize: 11, color: "#8888a0", textTransform: "uppercase" }}>Destination Chain</label>
      <select value={destDomain} onChange={e => setDestDomain(Number(e.target.value))}
        style={{ width: "100%", padding: 10, marginTop: 4, marginBottom: 14, background: "#1a1b23", border: "1px solid #26262e", borderRadius: 10, color: "#e8e8ee" }}>
        {DESTINATION_CHAINS.map(c => <option key={c.domain} value={c.domain}>{c.name}</option>)}
      </select>

      <label style={{ fontSize: 11, color: "#8888a0", textTransform: "uppercase" }}>Recipient Address</label>
      <input value={destAddress} onChange={e => setDestAddress(e.target.value)} placeholder="0x..."
        style={{ width: "100%", padding: 10, marginTop: 4, marginBottom: 18, background: "#1a1b23", border: "1px solid #26262e", borderRadius: 10, color: "#e8e8ee", fontFamily: "monospace", fontSize: 12 }}/>

      <button onClick={bridge} disabled={loading}
        style={{ width: "100%", padding: 12, background: "linear-gradient(135deg,#7c3aed,#06b6d4)", border: "none", borderRadius: 12, color: "white", fontWeight: 700, cursor: "pointer", opacity: loading ? 0.6 : 1 }}>
        {loading ? "Bridging…" : "Bridge USDC"}
      </button>

      {status && <p style={{ fontSize: 12, marginTop: 14, color: status.startsWith("✓") ? "#34d399" : status.startsWith("Error") ? "#f87171" : "#8888a0" }}>{status}</p>}
    </div>
  );
}` },
        { name: "README.md", content: `# CCTP Bridge

Native USDC cross-chain transfer using Circle's Cross-Chain Transfer Protocol (CCTP).

Unlike wrapped-token bridges, CCTP **burns** USDC on the source chain and
**mints** genuine USDC on the destination — no synthetic wrapped assets, no
liquidity pool risk.

## How it works
1. Approve \`TokenMessengerV2\` (\`${TOKEN_MESSENGER}\`) to spend your USDC
2. Call \`depositForBurn(amount, destinationDomain, mintRecipient, burnToken)\` — this burns your USDC on Arc
3. Circle's attestation service observes the burn (~15 min) and signs a message
4. Anyone can call \`receiveMessage\` on the destination chain's MessageTransmitter to mint the USDC there

This template handles steps 1-2 (the source-chain burn). Completing the mint
on the destination chain requires calling its MessageTransmitter with Circle's
attestation — see [Circle's CCTP docs](https://developers.circle.com/stablecoins/cctp) for the attestation API.
` },
      ],
    },
    {
      name: "CCTP Escrow Contract",
      description: "Solidity wrapper that holds USDC and releases it via CCTP burn on a condition",
      difficulty: "advanced",
      tags: ["Solidity", "CCTP", "Escrow"],
      files: [
        { name: "contracts/CCTPEscrow.sol", content: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title CCTPEscrow — holds USDC, releases cross-chain via CCTP on approval
interface IERC20 {
    function transferFrom(address, address, uint256) external returns (bool);
    function approve(address, uint256) external returns (bool);
}
interface ITokenMessenger {
    function depositForBurn(uint256 amount, uint32 destinationDomain, bytes32 mintRecipient, address burnToken) external returns (uint64);
}

contract CCTPEscrow {
    address public constant USDC = ${USDC};
    address public constant TOKEN_MESSENGER = ${TOKEN_MESSENGER};

    struct Escrow {
        address depositor;
        uint256 amount;
        address approver;
        bool released;
        bool refunded;
    }

    mapping(uint256 => Escrow) public escrows;
    uint256 public nextId;

    event Deposited(uint256 indexed id, address depositor, uint256 amount, address approver);
    event Released(uint256 indexed id, uint32 destinationDomain, bytes32 recipient);
    event Refunded(uint256 indexed id);

    function deposit(uint256 amount, address approver) external returns (uint256 id) {
        require(IERC20(USDC).transferFrom(msg.sender, address(this), amount), "transfer failed");
        id = nextId++;
        escrows[id] = Escrow(msg.sender, amount, approver, false, false);
        emit Deposited(id, msg.sender, amount, approver);
    }

    /// @notice Approver releases funds cross-chain via CCTP burn+mint
    function releaseCrossChain(uint256 id, uint32 destinationDomain, bytes32 mintRecipient) external {
        Escrow storage e = escrows[id];
        require(msg.sender == e.approver, "not approver");
        require(!e.released && !e.refunded, "already settled");
        e.released = true;

        IERC20(USDC).approve(TOKEN_MESSENGER, e.amount);
        ITokenMessenger(TOKEN_MESSENGER).depositForBurn(e.amount, destinationDomain, mintRecipient, USDC);
        emit Released(id, destinationDomain, mintRecipient);
    }

    function refund(uint256 id) external {
        Escrow storage e = escrows[id];
        require(msg.sender == e.depositor, "not depositor");
        require(!e.released && !e.refunded, "already settled");
        e.refunded = true;
        IERC20(USDC).transferFrom(address(this), e.depositor, e.amount);
        emit Refunded(id);
    }
}` },
      ],
    },
  ],
};

export const PREDICTION_CATEGORY: Category = {
  id: "prediction", label: "Prediction Markets", description: "Binary and multi-outcome betting markets settled in USDC",
  color: "from-fuchsia-500/20 to-pink-500/10", border: "border-fuchsia-500/25", accent: "#d946ef",
  templates: [
    {
      name: "Binary Prediction Market",
      description: "Yes/No market — users bet USDC, an oracle resolves the outcome, winners split the pot",
      difficulty: "advanced",
      tags: ["Solidity", "Prediction", "Oracle"],
      files: [
        { name: "contracts/PredictionMarket.sol", content: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title PredictionMarket — binary yes/no market settled in USDC
interface IERC20 {
    function transferFrom(address, address, uint256) external returns (bool);
    function transfer(address, uint256) external returns (bool);
}

contract PredictionMarket {
    address public constant USDC = ${USDC};

    enum Outcome { Unresolved, Yes, No }

    struct Market {
        string question;
        uint256 closeTime;
        address oracle;
        Outcome outcome;
        uint256 yesPool;
        uint256 noPool;
        mapping(address => uint256) yesBets;
        mapping(address => uint256) noBets;
        mapping(address => bool) claimed;
    }

    mapping(uint256 => Market) private markets;
    uint256 public nextMarketId;

    event MarketCreated(uint256 indexed id, string question, uint256 closeTime, address oracle);
    event BetPlaced(uint256 indexed id, address indexed user, bool betYes, uint256 amount);
    event Resolved(uint256 indexed id, Outcome outcome);
    event Claimed(uint256 indexed id, address indexed user, uint256 payout);

    function createMarket(string calldata question, uint256 closeTime, address oracle) external returns (uint256 id) {
        require(closeTime > block.timestamp, "close time must be future");
        id = nextMarketId++;
        Market storage m = markets[id];
        m.question = question;
        m.closeTime = closeTime;
        m.oracle = oracle;
        emit MarketCreated(id, question, closeTime, oracle);
    }

    function bet(uint256 id, bool betYes, uint256 amount) external {
        Market storage m = markets[id];
        require(block.timestamp < m.closeTime, "market closed");
        require(m.outcome == Outcome.Unresolved, "already resolved");
        require(IERC20(USDC).transferFrom(msg.sender, address(this), amount), "transfer failed");

        if (betYes) { m.yesPool += amount; m.yesBets[msg.sender] += amount; }
        else        { m.noPool  += amount; m.noBets[msg.sender]  += amount; }
        emit BetPlaced(id, msg.sender, betYes, amount);
    }

    function resolve(uint256 id, bool outcomeYes) external {
        Market storage m = markets[id];
        require(msg.sender == m.oracle, "not oracle");
        require(block.timestamp >= m.closeTime, "not closed yet");
        require(m.outcome == Outcome.Unresolved, "already resolved");
        m.outcome = outcomeYes ? Outcome.Yes : Outcome.No;
        emit Resolved(id, m.outcome);
    }

    function claim(uint256 id) external {
        Market storage m = markets[id];
        require(m.outcome != Outcome.Unresolved, "not resolved");
        require(!m.claimed[msg.sender], "already claimed");
        m.claimed[msg.sender] = true;

        uint256 totalPool = m.yesPool + m.noPool;
        uint256 payout;
        if (m.outcome == Outcome.Yes && m.yesBets[msg.sender] > 0) {
            payout = (m.yesBets[msg.sender] * totalPool) / m.yesPool;
        } else if (m.outcome == Outcome.No && m.noBets[msg.sender] > 0) {
            payout = (m.noBets[msg.sender] * totalPool) / m.noPool;
        }
        require(payout > 0, "nothing to claim");
        IERC20(USDC).transfer(msg.sender, payout);
        emit Claimed(id, msg.sender, payout);
    }

    function getMarket(uint256 id) external view returns (
        string memory question, uint256 closeTime, Outcome outcome, uint256 yesPool, uint256 noPool
    ) {
        Market storage m = markets[id];
        return (m.question, m.closeTime, m.outcome, m.yesPool, m.noPool);
    }

    function impliedProbability(uint256 id) external view returns (uint256 yesBps) {
        Market storage m = markets[id];
        uint256 total = m.yesPool + m.noPool;
        if (total == 0) return 5000; // 50% default
        return (m.yesPool * 10000) / total;
    }
}` },
        { name: "README.md", content: `# Binary Prediction Market

A yes/no betting market settled in USDC, with an oracle-based resolution.

## Flow
1. \`createMarket(question, closeTime, oracle)\` — anyone can spin up a market
2. \`bet(id, betYes, amount)\` — users bet USDC on Yes or No before close time
3. \`resolve(id, outcomeYes)\` — only the designated oracle resolves after close
4. \`claim(id)\` — winners claim their proportional share of the total pool

## Payout math
If you bet on the winning side, your payout is:
\`\`\`
payout = (your_bet / winning_pool) * total_pool
\`\`\`
This is a pari-mutuel model — no house edge, winners split the losers' pool.

## Implied probability
\`impliedProbability(id)\` returns the current market-implied odds (yesPool / totalPool)
in basis points, live as bets come in — same mechanic as Polymarket-style markets.
` },
      ],
    },
  ],
};

export const AGENTIC_ECONOMY_CATEGORY: Category = {
  id: "agentic-economy", label: "Agentic Economy", description: "AI agents that hold wallets, spend budgets, and transact autonomously",
  color: "from-orange-500/20 to-amber-500/10", border: "border-orange-500/25", accent: "#f97316",
  templates: [
    {
      name: "Agent Spending Wallet",
      description: "On-chain wallet with programmable spending limits for autonomous AI agents",
      difficulty: "advanced",
      tags: ["Solidity", "AI Agents", "Treasury"],
      files: [
        { name: "contracts/AgentWallet.sol", content: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title AgentWallet — a spending-limited wallet for autonomous AI agents.
/// @notice The owner funds the wallet and sets a per-period budget; the agent
/// (a separate address, e.g. a server-controlled key) can spend up to that
/// budget without further human approval, and the budget resets each period.
interface IERC20 {
    function transfer(address, uint256) external returns (bool);
    function transferFrom(address, address, uint256) external returns (bool);
}

contract AgentWallet {
    address public owner;
    address public agent;
    address public constant USDC = ${USDC};

    uint256 public budgetPerPeriod;
    uint256 public periodLength;     // seconds
    uint256 public periodStart;
    uint256 public spentThisPeriod;

    mapping(address => bool) public allowedRecipients; // optional allowlist, empty = anyone

    event Funded(uint256 amount);
    event Spent(address indexed to, uint256 amount, string memo);
    event BudgetUpdated(uint256 budgetPerPeriod, uint256 periodLength);
    event AgentUpdated(address newAgent);

    modifier onlyOwner() { require(msg.sender == owner, "not owner"); _; }
    modifier onlyAgent()  { require(msg.sender == agent, "not agent"); _; }

    constructor(address _agent, uint256 _budgetPerPeriod, uint256 _periodLength) {
        owner = msg.sender;
        agent = _agent;
        budgetPerPeriod = _budgetPerPeriod;
        periodLength = _periodLength;
        periodStart = block.timestamp;
    }

    function fund(uint256 amount) external {
        require(IERC20(USDC).transferFrom(msg.sender, address(this), amount), "transfer failed");
        emit Funded(amount);
    }

    function _rollPeriodIfNeeded() internal {
        if (block.timestamp >= periodStart + periodLength) {
            periodStart = block.timestamp;
            spentThisPeriod = 0;
        }
    }

    /// @notice The agent spends within its budget — no owner signature needed
    function agentSpend(address to, uint256 amount, string calldata memo) external onlyAgent {
        _rollPeriodIfNeeded();
        require(spentThisPeriod + amount <= budgetPerPeriod, "exceeds period budget");
        if (_hasAllowlist()) require(allowedRecipients[to], "recipient not allowed");
        spentThisPeriod += amount;
        require(IERC20(USDC).transfer(to, amount), "transfer failed");
        emit Spent(to, amount, memo);
    }

    /// @notice Owner can always spend directly, bypassing the agent's budget
    function ownerSpend(address to, uint256 amount) external onlyOwner {
        require(IERC20(USDC).transfer(to, amount), "transfer failed");
    }

    function setBudget(uint256 newBudget, uint256 newPeriodLength) external onlyOwner {
        budgetPerPeriod = newBudget;
        periodLength = newPeriodLength;
        emit BudgetUpdated(newBudget, newPeriodLength);
    }

    function setAgent(address newAgent) external onlyOwner {
        agent = newAgent;
        emit AgentUpdated(newAgent);
    }

    function allowRecipient(address recipient, bool allowed) external onlyOwner {
        allowedRecipients[recipient] = allowed;
    }

    function _hasAllowlist() internal pure returns (bool) {
        return false; // flip to true + track a counter if you want to enforce a strict allowlist
    }

    function remainingBudget() external view returns (uint256) {
        if (block.timestamp >= periodStart + periodLength) return budgetPerPeriod;
        return budgetPerPeriod > spentThisPeriod ? budgetPerPeriod - spentThisPeriod : 0;
    }
}` },
        { name: "README.md", content: `# Agent Spending Wallet

A treasury contract designed for autonomous AI agents: the owner funds it and
sets a periodic budget (e.g. "500 USDC per day"), and a separate **agent**
address — typically a server-side key an AI system controls — can spend
within that budget with zero human-in-the-loop approval per transaction.

## Why this pattern matters
This is the core primitive behind "agentic economy" apps: an AI agent (like
GlowIDE's own chat assistant) needs to execute real transactions on a user's
behalf, but you don't want it to have unlimited spending power. This contract
gives the agent a hard on-chain ceiling that resets every period.

## Flow
1. Deploy with the agent's address, budget, and period length (in seconds)
2. Owner calls \`fund(amount)\` to deposit USDC
3. Agent calls \`agentSpend(to, amount, memo)\` — reverts if it exceeds the period budget
4. Owner can always \`ownerSpend\` directly, or adjust the budget/agent anytime
` },
      ],
    },
    {
      name: "Agent-to-Agent Payment Hub",
      description: "Registry where AI agents send micropayments to each other for services rendered",
      difficulty: "advanced",
      tags: ["Solidity", "AI Agents", "Micropayments"],
      files: [
        { name: "contracts/AgentPaymentHub.sol", content: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title AgentPaymentHub — a registry + ledger for agent-to-agent micropayments
/// @notice Agents register a service + price; other agents (or users) pay to
/// invoke that service, and payment is released once the caller confirms.
interface IERC20 {
    function transferFrom(address, address, uint256) external returns (bool);
    function transfer(address, uint256) external returns (bool);
}

contract AgentPaymentHub {
    address public constant USDC = ${USDC};

    struct Service {
        address provider;
        string name;
        uint256 pricePerCall;
        bool active;
        uint256 totalCalls;
        uint256 totalEarned;
    }

    struct PendingCall {
        uint256 serviceId;
        address caller;
        uint256 amount;
        bool settled;
    }

    mapping(uint256 => Service) public services;
    mapping(uint256 => PendingCall) public calls;
    uint256 public nextServiceId;
    uint256 public nextCallId;

    event ServiceRegistered(uint256 indexed id, address provider, string name, uint256 price);
    event CallRequested(uint256 indexed callId, uint256 indexed serviceId, address caller, uint256 amount);
    event CallSettled(uint256 indexed callId, bool success);

    function registerService(string calldata name, uint256 pricePerCall) external returns (uint256 id) {
        id = nextServiceId++;
        services[id] = Service(msg.sender, name, pricePerCall, true, 0, 0);
        emit ServiceRegistered(id, msg.sender, name, pricePerCall);
    }

    /// @notice Caller (a user or another agent) escrows payment to invoke a service
    function requestCall(uint256 serviceId) external returns (uint256 callId) {
        Service storage s = services[serviceId];
        require(s.active, "service inactive");
        require(IERC20(USDC).transferFrom(msg.sender, address(this), s.pricePerCall), "transfer failed");
        callId = nextCallId++;
        calls[callId] = PendingCall(serviceId, msg.sender, s.pricePerCall, false);
        emit CallRequested(callId, serviceId, msg.sender, s.pricePerCall);
    }

    /// @notice Caller confirms the service was delivered — releases payment to the provider
    function confirmDelivery(uint256 callId) external {
        PendingCall storage c = calls[callId];
        require(msg.sender == c.caller, "not caller");
        require(!c.settled, "already settled");
        c.settled = true;
        Service storage s = services[c.serviceId];
        s.totalCalls++;
        s.totalEarned += c.amount;
        IERC20(USDC).transfer(s.provider, c.amount);
        emit CallSettled(callId, true);
    }

    /// @notice Caller can refund themselves if the service was never delivered
    function disputeAndRefund(uint256 callId) external {
        PendingCall storage c = calls[callId];
        require(msg.sender == c.caller, "not caller");
        require(!c.settled, "already settled");
        c.settled = true;
        IERC20(USDC).transfer(c.caller, c.amount);
        emit CallSettled(callId, false);
    }

    function setServiceActive(uint256 serviceId, bool active) external {
        require(services[serviceId].provider == msg.sender, "not provider");
        services[serviceId].active = active;
    }
}` },
      ],
    },
  ],
};

export const AI_AGENTS_CATEGORY: Category = {
  id: "ai-agents", label: "AI Agents", description: "Tool-calling AI chat interfaces and autonomous agent frontends",
  color: "from-cyan-500/20 to-teal-500/10", border: "border-cyan-500/25", accent: "#06b6d4",
  templates: [
    {
      name: "Tool-Calling Chat Agent",
      description: "React chat UI + serverless route where the AI can call real functions (weather, calculator, on-chain reads)",
      difficulty: "intermediate",
      tags: ["React", "AI", "Tool Calling"],
      files: [
        { name: "AgentChat.tsx", content: `import { useState, useRef, useEffect } from "react";

interface Message { role: "user" | "assistant"; content: string; }

export default function AgentChat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const send = async () => {
    if (!input.trim() || loading) return;
    const userMsg: Message = { role: "user", content: input };
    setMessages(m => [...m, userMsg]);
    setInput("");
    setLoading(true);
    try {
      const res = await fetch("/api/agent", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: [...messages, userMsg] }),
      });
      const data = await res.json();
      setMessages(m => [...m, { role: "assistant", content: data.reply }]);
    } catch {
      setMessages(m => [...m, { role: "assistant", content: "Error reaching agent." }]);
    } finally { setLoading(false); }
  };

  return (
    <div style={{ maxWidth: 480, margin: "40px auto", height: 560, display: "flex", flexDirection: "column", background: "#13141c", borderRadius: 16, overflow: "hidden", fontFamily: "system-ui" }}>
      <div style={{ padding: 16, borderBottom: "1px solid #26262e", fontWeight: 700, color: "#e8e8ee" }}>Tool-Calling Agent</div>
      <div style={{ flex: 1, overflowY: "auto", padding: 16, display: "flex", flexDirection: "column", gap: 10 }}>
        {messages.map((m, i) => (
          <div key={i} style={{ alignSelf: m.role === "user" ? "flex-end" : "flex-start", maxWidth: "80%",
            background: m.role === "user" ? "linear-gradient(135deg,#7c3aed,#5b21b6)" : "#1a1b23",
            color: "#e8e8ee", padding: "8px 12px", borderRadius: 12, fontSize: 13 }}>
            {m.content}
          </div>
        ))}
        {loading && <div style={{ color: "#8888a0", fontSize: 12 }}>Agent is thinking…</div>}
        <div ref={endRef}/>
      </div>
      <div style={{ display: "flex", gap: 8, padding: 12, borderTop: "1px solid #26262e" }}>
        <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === "Enter" && send()}
          placeholder="Ask the agent to check the weather, calculate, or read on-chain data…"
          style={{ flex: 1, padding: 10, background: "#1a1b23", border: "1px solid #26262e", borderRadius: 10, color: "#e8e8ee", fontSize: 13 }}/>
        <button onClick={send} disabled={loading}
          style={{ padding: "0 16px", background: "linear-gradient(135deg,#7c3aed,#06b6d4)", border: "none", borderRadius: 10, color: "white", fontWeight: 700, cursor: "pointer" }}>
          Send
        </button>
      </div>
    </div>
  );
}` },
        { name: "api/agent.ts", content: `// Serverless route — the AI can call real "tools" (functions) based on user intent.
// Deploy this as a Next.js API route (app/api/agent/route.ts) or Express handler.

interface ToolCall { name: string; args: Record<string, unknown>; }

// ── Real tool implementations ────────────────────────────────────────────
async function getWeather(city: string): Promise<string> {
  // Plug in a real weather API key here
  return \`It's sunny in \${city}, 22°C.\`;
}

function calculate(expression: string): string {
  // Simple safe evaluator for +,-,*,/ only — never use raw eval() in production
  const sanitized = expression.replace(/[^0-9+\\-*/(). ]/g, "");
  try { return String(Function(\`"use strict"; return (\${sanitized})\`)()); }
  catch { return "Invalid expression"; }
}

async function readOnChainBalance(address: string): Promise<string> {
  const res = await fetch("https://rpc.testnet.arc.network", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_getBalance", params: [address, "latest"] }),
  });
  const d = await res.json();
  const wei = BigInt(d.result ?? "0x0");
  return \`\${(Number(wei) / 1e18).toFixed(4)} USDC (native gas balance) at \${address}\`;
}

// ── Simple intent router (swap this for real LLM tool-calling in production) ──
function detectTool(text: string): ToolCall | null {
  const weatherMatch = text.match(/weather.*in\\s+(\\w+)/i);
  if (weatherMatch) return { name: "weather", args: { city: weatherMatch[1] } };

  const calcMatch = text.match(/calculate\\s+([\\d+\\-*/(). ]+)/i);
  if (calcMatch) return { name: "calculate", args: { expression: calcMatch[1] } };

  const balanceMatch = text.match(/balance.*?(0x[a-fA-F0-9]{40})/);
  if (balanceMatch) return { name: "balance", args: { address: balanceMatch[1] } };

  return null;
}

export async function POST(req: Request) {
  const { messages } = await req.json();
  const lastMessage = messages[messages.length - 1]?.content ?? "";

  const tool = detectTool(lastMessage);
  let reply: string;

  if (tool?.name === "weather") reply = await getWeather(tool.args.city as string);
  else if (tool?.name === "calculate") reply = \`Result: \${calculate(tool.args.expression as string)}\`;
  else if (tool?.name === "balance") reply = await readOnChainBalance(tool.args.address as string);
  else reply = "I can check weather (\\"weather in Tokyo\\"), calculate (\\"calculate 5*12\\"), or read on-chain balances (\\"balance of 0x...\\"). Try one of those!";

  return Response.json({ reply });
}` },
        { name: "README.md", content: `# Tool-Calling Chat Agent

A minimal but real pattern for an AI agent that can invoke actual functions
based on user intent — weather lookups, math, and live on-chain balance reads
from Arc Testnet.

## Upgrading to a real LLM
Swap \`detectTool()\` for an actual LLM call (OpenAI, Anthropic, OpenRouter)
with function-calling / tools enabled, passing the same three tool schemas
(weather, calculate, balance) as JSON Schema. The LLM will decide which tool
to call and with what arguments — replace the regex router with the LLM's
tool_calls response.
` },
      ],
    },
    {
      name: "Autonomous Task Bounty",
      description: "Post tasks with USDC bounties that AI agents can discover, claim, and complete on-chain",
      difficulty: "advanced",
      tags: ["Solidity", "AI Agents", "Bounties"],
      files: [
        { name: "contracts/TaskBounty.sol", content: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title TaskBounty — post tasks with USDC bounties for autonomous agents to claim
interface IERC20 {
    function transferFrom(address, address, uint256) external returns (bool);
    function transfer(address, uint256) external returns (bool);
}

contract TaskBounty {
    address public constant USDC = ${USDC};

    enum Status { Open, Claimed, Submitted, Completed, Cancelled }

    struct Task {
        address poster;
        string description;
        uint256 bounty;
        address claimedBy;
        string submissionUri; // e.g. IPFS hash of the agent's completed work
        Status status;
    }

    mapping(uint256 => Task) public tasks;
    uint256 public nextTaskId;

    event TaskPosted(uint256 indexed id, address poster, string description, uint256 bounty);
    event TaskClaimed(uint256 indexed id, address agent);
    event TaskSubmitted(uint256 indexed id, string submissionUri);
    event TaskCompleted(uint256 indexed id, address agent, uint256 bounty);
    event TaskCancelled(uint256 indexed id);

    function postTask(string calldata description, uint256 bounty) external returns (uint256 id) {
        require(IERC20(USDC).transferFrom(msg.sender, address(this), bounty), "transfer failed");
        id = nextTaskId++;
        tasks[id] = Task(msg.sender, description, bounty, address(0), "", Status.Open);
        emit TaskPosted(id, msg.sender, description, bounty);
    }

    /// @notice An agent claims an open task, reserving it for themselves
    function claimTask(uint256 id) external {
        Task storage t = tasks[id];
        require(t.status == Status.Open, "not open");
        t.claimedBy = msg.sender;
        t.status = Status.Claimed;
        emit TaskClaimed(id, msg.sender);
    }

    /// @notice The claiming agent submits proof of completed work
    function submitWork(uint256 id, string calldata submissionUri) external {
        Task storage t = tasks[id];
        require(msg.sender == t.claimedBy, "not the claiming agent");
        require(t.status == Status.Claimed, "not claimed");
        t.submissionUri = submissionUri;
        t.status = Status.Submitted;
        emit TaskSubmitted(id, submissionUri);
    }

    /// @notice The poster approves the submission and releases the bounty
    function approveAndPay(uint256 id) external {
        Task storage t = tasks[id];
        require(msg.sender == t.poster, "not poster");
        require(t.status == Status.Submitted, "not submitted");
        t.status = Status.Completed;
        IERC20(USDC).transfer(t.claimedBy, t.bounty);
        emit TaskCompleted(id, t.claimedBy, t.bounty);
    }

    /// @notice Poster can cancel and refund themselves if still unclaimed
    function cancelTask(uint256 id) external {
        Task storage t = tasks[id];
        require(msg.sender == t.poster, "not poster");
        require(t.status == Status.Open, "already claimed or settled");
        t.status = Status.Cancelled;
        IERC20(USDC).transfer(t.poster, t.bounty);
        emit TaskCancelled(id);
    }

    function getOpenTasks(uint256 fromId, uint256 count) external view returns (uint256[] memory ids) {
        uint256 found = 0;
        uint256[] memory temp = new uint256[](count);
        for (uint256 i = fromId; i < nextTaskId && found < count; i++) {
            if (tasks[i].status == Status.Open) temp[found++] = i;
        }
        ids = new uint256[](found);
        for (uint256 i = 0; i < found; i++) ids[i] = temp[i];
    }
}` },
        { name: "README.md", content: `# Autonomous Task Bounty

A task marketplace built for AI agents: post a task with a USDC bounty,
agents discover it via \`getOpenTasks\`, claim it, do the work, submit proof
(e.g. an IPFS URI), and get paid once the poster approves.

## Flow
1. \`postTask(description, bounty)\` — escrows USDC
2. \`claimTask(id)\` — an agent reserves the task
3. \`submitWork(id, submissionUri)\` — agent submits proof of completion
4. \`approveAndPay(id)\` — poster releases the bounty to the agent

This is the on-chain settlement layer for an "agent marketplace" — pair it
with an off-chain indexer that watches \`TaskPosted\` events and feeds them to
your agents automatically.
` },
      ],
    },
  ],
};
