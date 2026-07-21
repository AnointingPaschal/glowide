import { NextRequest, NextResponse } from "next/server";

export const runtime = "edge";
export const maxDuration = 60;

const CIRCLE_CONTEXT = `
You are GlowIDE AI — a senior Web3 engineer with full Circle integration.

## Circle Programmable Wallets
User has a Circle MPC wallet (non-custodial, 2-of-2 MPC).
- User-controlled: user holds keys, protected by PIN
- To send USDC: use circle_transfer tool
- To execute contract: use circle_contract_execute tool
- To bridge cross-chain: use circle_cctp_bridge tool
- To send nanopayment (<$0.01, gas-free): use circle_nanopayment tool

## Arc Testnet (Chain 5042002)
- USDC: 0x3600000000000000000000000000000000000000 (native gas)
- EURC: 0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a
- cirBTC: 0xf0C4a4CE82A5746AbAAd9425360Ab04fbBA432BF
- USYC: 0xe9185F0c5F296Ed1797AaE4238D26CCaBEadb86C
- TokenMessengerV2: 0x8FE6B999Dc680CcFDD5Bf7EB0974218be2542DAA

## Gateway (Unified balance, <500ms cross-chain)
Use circle_gateway_transfer for instant USDC moves across chains.

## CCTP Domains
ETH=0, AVAX=1, OP=2, ARB=3, Base=6, Polygon=7, Arc=26

## All supported tokens on Arc Testnet
- USDC:   0x3600000000000000000000000000000000000000 · 6 decimals · native gas
- EURC:   0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a · 6 decimals
- cirBTC: 0xf0C4a4CE82A5746AbAAd9425360Ab04fbBA432BF · 8 decimals
- USYC:   0xe9185F0c5F296Ed1797AaE4238D26CCaBEadb86C · 6 decimals
- Custom ERC-20 tokens are also supported — if the user provides a contract address, use circle_transfer with the address as tokenAddress

**circle_transfer sends ALL four tokens.** Always pass the token field ("USDC", "EURC", "cirBTC", "USYC") so the system uses the right decimals. For custom tokens, the user supplies the contract address.

**CCTP bridge** works for USDC (and potentially EURC). Not available for cirBTC or USYC.

## Capabilities
- Write, audit, deploy Solidity contracts on any EVM chain
- Execute on-chain transactions with user wallet approval
- Send USDC, EURC, cirBTC, USYC or any custom ERC-20 anywhere on Arc
- Bridge USDC cross-chain via CCTP, instant transfers via Gateway
- Nanopay sub-cent, gas-free
- Check token balances for all tokens at once
- View transaction history — last N token transfers on Arc Testnet
- Swap tokens between USDC, EURC, cirBTC, USYC (when swap contract is deployed)
- Analyze token data, explain DeFi protocols
- Create, write, and edit files and folders directly in the user's project

## Creating and editing files/folders
When writing code the user wants saved, always put it in a fenced code block
with the file's path as the info string right after the language, e.g.:
\`\`\`solidity contracts/token/MyToken.sol
// code here
\`\`\`
Use forward slashes for nested folders (e.g. "contracts/token/MyToken.sol") —
the editor will automatically create any missing folders in that path. If you
omit a path, the code applies to whatever file the user currently has open.
When editing an existing file, always include its correct existing path so
changes land in the right place rather than creating a duplicate.

## Chain — always Arc Testnet
Every transaction (transfer, contract call) executes on Arc Testnet only.
Never ask the user which blockchain to use — there is only one, and it's
already selected. The only time chain choice is relevant is the destination
of a cross-chain bridge/gateway transfer (circle_cctp_bridge,
circle_gateway_transfer), where the source is always Arc and only the
destination needs asking.

## Running terminal commands
To actually run something (install a package, run a script, use git, run
tests), put the command(s) in a \`\`\`bash fenced block — this executes for
real in a sandboxed environment and the output is shown in the terminal:
\`\`\`bash
npm install ethers
node scripts/deploy.js
\`\`\`
One command per line. Available: node, npm, npx, yarn, pnpm, git (clone,
status, log, diff, branch, init, add, commit — no push/pull/remote/credential
commands), python3, pip, tsc, solc, and basic file utilities (ls, cat, mkdir,
touch, rm, mv, cp, grep, find). Don't narrate a fake "running command..." in
plain text — if you want something to actually execute, it must be inside a
\`\`\`bash block, otherwise it's just a suggestion the user has to run
themselves. Only ever put commands in bash blocks, never source code.

## Communication style while writing code or running commands
The user doesn't need to see the raw code or command output inline in the
chat — the editor and terminal show that. Keep your prose focused on what
you're doing and why (a short plan, then a brief note once it's done), not a
line-by-line narration of the code itself. Think of it like a colleague
telling you what they're about to change, not reading the diff aloud.

Always be explicit about what you're doing before executing any transaction.
Confirm amounts and addresses with the user before calling transaction tools.

## CRITICAL — Never simulate transactions
When the user asks you to send, transfer, swap, bridge, pay, or execute anything
on-chain, you MUST call the matching tool function. Do NOT describe the action
in plain text as if it happened — that is a simulation and is strictly forbidden.
Every transaction request requires an actual tool_call in your response. If you
are unsure of an address or amount, ask a clarifying question instead of calling
the tool with guessed values — but once confirmed, always call the tool.
`;

const TOOLS = [
  {
    type: "function",
    function: {
      name: "circle_transfer",
      description: "Send USDC, EURC, cirBTC, or USYC to any address on Arc Testnet using the user's active wallet (website wallet, Circle Developer Wallet, or MetaMask). Always Arc Testnet. For custom ERC-20 tokens, use the contract address in tokenAddress.",
      parameters: {
        type: "object",
        properties: {
          to:           { type: "string", description: "Destination wallet address (0x...)" },
          amount:       { type: "string", description: "Human-readable amount to send (e.g. '10.5')" },
          token:        { type: "string", description: "Token symbol", enum: ["USDC","EURC","cirBTC","USYC"] },
          tokenAddress: { type: "string", description: "Custom ERC-20 contract address — only needed for non-standard tokens. Leave empty for USDC/EURC/cirBTC/USYC." },
          reason:       { type: "string", description: "Why this transfer is being made" },
        },
        required: ["to", "amount"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "circle_contract_execute",
      description: "Execute a smart contract function on Arc Testnet using the user's connected wallet. Always Arc Testnet, never any other chain.",
      parameters: {
        type: "object",
        properties: {
          contractAddress:       { type: "string", description: "Contract address to call" },
          abiFunctionSignature:  { type: "string", description: "Function signature e.g. 'transfer(address,uint256)'" },
          abiParameters:         { type: "array",  description: "Function arguments array", items: {} },
          value:                 { type: "string", description: "Native token value to send (usually '0')" },
          reason: { type: "string", description: "Why this contract call is being made" },
        },
        required: ["contractAddress", "abiFunctionSignature"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "circle_cctp_bridge",
      description: "Bridge USDC FROM Arc Testnet to another chain via Circle's CCTP protocol. Burns on Arc, natively mints on the destination chain you specify.",
      parameters: {
        type: "object",
        properties: {
          amount:              { type: "string", description: "USDC amount to bridge" },
          destinationChain:    { type: "string", description: "Destination blockchain to bridge TO (source is always Arc Testnet)" },
          destinationAddress:  { type: "string", description: "Recipient address on destination chain" },
        },
        required: ["amount", "destinationChain"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "circle_gateway_transfer",
      description: "Instant cross-chain USDC transfer FROM Arc Testnet via Circle Gateway (<500ms). Uses unified balance model.",
      parameters: {
        type: "object",
        properties: {
          amount:               { type: "string", description: "USDC amount" },
          destinationChain:     { type: "string", description: "Target blockchain to send TO (source is always Arc Testnet)" },
          destinationAddress:   { type: "string", description: "Recipient address" },
        },
        required: ["amount", "destinationChain", "destinationAddress"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "circle_nanopayment",
      description: "Send a gas-free nanopayment ($0.000001 minimum) via Circle Gateway x402 protocol. No gas needed.",
      parameters: {
        type: "object",
        properties: {
          to:     { type: "string", description: "Recipient address" },
          amount: { type: "string", description: "USDC amount (can be tiny, e.g. 0.000001)" },
          reason: { type: "string", description: "What this payment is for" },
        },
        required: ["to", "amount"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_wallet_balance",
      description: "Check the user's current wallet balances for USDC, EURC, cirBTC, USYC and any other ERC-20 tokens on Arc Testnet.",
      parameters: {
        type: "object",
        properties: {
          token: { type: "string", description: "Optional: specific token symbol to check (USDC, EURC, cirBTC, USYC)" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_transaction_history",
      description: "View the user's recent token transfer history on Arc Testnet. Shows incoming and outgoing transfers for USDC, EURC, cirBTC, USYC and any ERC-20 tokens.",
      parameters: {
        type: "object",
        properties: {
          limit: { type: "number", description: "How many transactions to show (default 5, max 20)" },
          token: { type: "string", description: "Optional: filter to a specific token symbol" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "circle_swap",
      description: "Swap between tokens on Arc Testnet (USDC, EURC, cirBTC, USYC). Requires a swap/AMM contract to be deployed — if none exists the user will be directed to the DeFi page.",
      parameters: {
        type: "object",
        properties: {
          tokenIn:   { type: "string", description: "Token to sell", enum: ["USDC","EURC","cirBTC","USYC"] },
          tokenOut:  { type: "string", description: "Token to buy",  enum: ["USDC","EURC","cirBTC","USYC"] },
          amountIn:  { type: "string", description: "Amount of tokenIn to swap" },
          slippage:  { type: "number", description: "Max slippage % (default 0.5)" },
        },
        required: ["tokenIn", "tokenOut", "amountIn"],
      },
    },
  },
];

async function fetchDB(supabaseUrl: string, sKey: string, path: string) {
  const res = await fetch(`${supabaseUrl}/rest/v1${path}`, {
    headers: { "apikey": sKey, "Authorization": `Bearer ${sKey}` },
    cache: "no-store",
  });
  if (!res.ok) return null;
  return res.json();
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as {
      messages: Array<{ role: string; content: string }>;
      model?: string;
      walletContext?: {
        circleUserId?: string;
        userToken?: string;
        wallets?: Array<{ id: string; address: string; blockchain: string }>;
        address?: string;
      };
      editorContext?: { fileName?: string; fileContent?: string; errors?: string[] };
    };

    const { messages, model, walletContext, editorContext } = body;

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
    const sKey        = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
    // Fetch OpenRouter key: DB first (admin setting), then env var
    let openRouterKey = process.env.OPENROUTER_API_KEY ?? "";
    if (!openRouterKey && supabaseUrl && sKey) {
      try {
        const keyRow = await fetchDB(supabaseUrl, sKey, "/system_settings?key=eq.openrouter_api_key&select=value&limit=1");
        if (Array.isArray(keyRow) && keyRow[0]?.value) openRouterKey = keyRow[0].value;
      } catch { /* use env */ }
    }
    if (!openRouterKey) return NextResponse.json({ error: "OpenRouter API key not set. Add OPENROUTER_API_KEY to Vercel env vars or set it in Admin → Settings." }, { status: 500 });

    // Fetch system prompt + training examples from DB
    let systemPrompt = CIRCLE_CONTEXT;
    if (supabaseUrl && sKey) {
      const map = await fetchDB(supabaseUrl, sKey, "/system_settings?key=eq.ai_system_prompt&select=value&limit=1");
      if (Array.isArray(map) && map[0]?.value) systemPrompt = map[0].value + "\n\n" + CIRCLE_CONTEXT;
    }

    // Inject wallet context into system prompt
    if (walletContext?.wallets?.length) {
      systemPrompt += `\n\n## User's Active Wallets\n`;
      walletContext.wallets.forEach(w => {
        systemPrompt += `- ${w.blockchain}: ${w.address} (walletId: ${w.id})\n`;
      });
      systemPrompt += `Circle userId: ${walletContext.circleUserId ?? "unknown"}\n`;
    } else if (walletContext?.address) {
      systemPrompt += `\n\nUser's MetaMask address: ${walletContext.address}\n`;
    }

    // Inject editor context
    if (editorContext?.fileName) {
      systemPrompt += `\n\n## Active Editor File: ${editorContext.fileName}\n`;
      if (editorContext.fileContent) {
        systemPrompt += `\`\`\`solidity\n${editorContext.fileContent.slice(0, 6000)}\n\`\`\`\n`;
      }
      if (editorContext.errors?.length) {
        systemPrompt += `### Compile Errors:\n${editorContext.errors.join("\n")}\n`;
      }
    }

    // Use exactly what was requested — the admin's configured model ID is authoritative.
    // Don't second-guess it; surface the real OpenRouter error if it fails.
    const useModel = model ?? "anthropic/claude-3.5-sonnet";

    // Detect clear transaction intent in the latest user message so we can force
    // tool_choice="required" — some OpenRouter models are conservative under "auto"
    // and will describe an action in prose instead of actually calling the tool.
    const lastUserMsg = [...messages].reverse().find(m => m.role === "user")?.content ?? "";
    const TX_INTENT = /\b(send|transfer|pay|bridge|swap|execute|deploy|call the contract|mint|burn)\b.{0,60}\b(usdc|eurc|cirbtc|usyc|to |address|0x[a-f0-9]{6,})/i;
    const forceToolCall = TX_INTENT.test(lastUserMsg);

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${openRouterKey}`,
        "Content-Type":  "application/json",
        "HTTP-Referer":  "https://glowaide.com",
        "X-Title":       "GlowIDE",
      },
      body: JSON.stringify({
        model: useModel,
        messages: [
          { role: "system", content: systemPrompt },
          ...messages.slice(-20),
        ],
        tools: TOOLS,
        tool_choice: forceToolCall ? "required" : "auto",
        stream: false,
        max_tokens: 8000, // high enough for full Solidity contracts (~200 lines ≈ 4-6k tokens)
      }),
    });

    const data = await response.json() as {
      choices?: Array<{
        message: {
          role: string;
          content: string | null;
          tool_calls?: Array<{ id: string; type: string; function: { name: string; arguments: string } }>;
        };
        finish_reason?: string;
      }>;
      error?: { message: string };
    };

    if (!response.ok || data.error) {
      const errMsg = data.error?.message ?? `OpenRouter ${response.status}`;
      const isRateLimit = response.status === 429 || errMsg.toLowerCase().includes("rate limit") || errMsg.toLowerCase().includes("too many");
      const isCredits   = errMsg.toLowerCase().includes("credit") || errMsg.toLowerCase().includes("billing") || errMsg.toLowerCase().includes("insufficient");
      const isNotFound  = response.status === 404 || errMsg.toLowerCase().includes("not found") || errMsg.toLowerCase().includes("unknown model");
      let hint = "";
      if (isRateLimit) hint = `\n\n⏱️ Rate limit hit. The free tier for "${useModel}" has low limits (20 req/min, 200/day) — wait a moment and try again, or switch models.`;
      else if (isCredits) hint = `\n\n💳 Credits needed for "${useModel}". Try adding ":free" to the model ID in Admin → Models (e.g. openai/gpt-oss-120b:free).`;
      else if (isNotFound) hint = `\n\n❌ Model "${useModel}" not found. Check the ID in Admin → Models — may need a ":free" suffix.`;
      return NextResponse.json({ error: errMsg + hint }, { status: 500 });
    }

    const choice  = data.choices?.[0];
    const message = choice?.message;

    // If AI wants to call a tool, return the tool call info for the frontend to confirm
    if (message?.tool_calls?.length) {
      const toolCall = message.tool_calls[0];
      let args: Record<string, unknown> = {};
      try { args = JSON.parse(toolCall.function.arguments); } catch {}

      return NextResponse.json({
        content: message.content ?? `I'll ${toolCall.function.name.replace(/_/g, " ")} for you. Please confirm below.`,
        toolCall: {
          id:   toolCall.id,
          name: toolCall.function.name,
          args,
        },
      });
    }

    return NextResponse.json({ content: message?.content ?? "" });
  } catch (err) {
    console.error("[AI chat]", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
