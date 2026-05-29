import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";


// Circle Agent Stack context injected into system prompt
const CIRCLE_AGENT_CONTEXT = `
You have access to Circle's full stack for Web3 development:

CIRCLE ASSETS on Arc Testnet:
- USDC: 0x3600000000000000000000000000000000000000 (native gas, 6 decimals)
- EURC: 0x3700000000000000000000000000000000000000 (Euro stablecoin, 6 decimals)
- cirBTC: 0x3800000000000000000000000000000000000000 (Circle Bitcoin, 8 decimals)

CCTP (Cross-Chain Transfer Protocol):
- Burns USDC on source chain, mints natively on destination
- Supported chains: Ethereum, Avalanche, OP, Arbitrum, Base, Polygon, Solana, Stellar, Arc Testnet
- CCTP domains: ETH=0, AVAX=1, OP=2, ARB=3, Stellar=4, SOL=5, Base=6, Polygon=7, Arc=9
- For transfers: depositForBurn() on source, receiveMessage() on destination
- Fast Transfer: sub-second finality
- Smart contracts: TokenMessenger (source), MessageTransmitter (relay)

CIRCLE AGENT STACK (developers.circle.com/agent-stack):
- Circle's programmable wallets for AI agents
- Nanopayments: sub-cent USDC payments, gas-free, batched settlement
- Gateway unified balance: one USDC balance across all chains
- EIP-4337 smart account support for gasless UX
- Webhook events for payment confirmation

PAYMENTS API:
- Accept USDC/EURC payments via Circle Payments API
- On-chain settlement, payment intents, webhooks

When helping with Web3 code on Arc Testnet:
1. Always use USDC for gas calculations (6 decimals, not 18)
2. Reference correct contract addresses above
3. For cross-chain: always use CCTP, not bridges
4. Smart accounts: use EIP-4337 for gasless transactions
`;

export const runtime = "edge";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const { messages, model, sessionId, temperature, maxTokens } = await req.json();

    // Fetch API key and settings from Supabase (admin-configured)
    let apiKey = process.env.OPENROUTER_API_KEY || "";
    let defaultModel = model || process.env.OPENROUTER_DEFAULT_MODEL || "anthropic/claude-3.5-sonnet";
    let systemPrompt = `You are GlowIDE's AI coding assistant — a senior full-stack Web3 engineer with deep expertise in JavaScript, TypeScript, React, Next.js, Solidity smart contracts, Arc Testnet (Chain ID: 5042002), USDC/Circle integrations, and modern Web3 development. Write production-ready, secure, well-typed code with clear explanations.`;

    try {
      const supabase = createServerSupabaseClient();
      const { data: settings } = await supabase
        .from("system_settings")
        .select("key, value")
        .in("key", ["openrouter_api_key", "default_model", "system_prompt", "temperature", "max_tokens"]);

      if (settings) {
        const settingsMap = Object.fromEntries(settings.map((s: { key: string; value: string }) => [s.key, s.value]));
        if (settingsMap.openrouter_api_key) apiKey = settingsMap.openrouter_api_key;
        if (settingsMap.default_model) defaultModel = model || settingsMap.default_model;
        if (settingsMap.system_prompt) systemPrompt = settingsMap.system_prompt;
      }
    } catch {
      // Use env defaults if DB fails
    }

    if (!apiKey) {
      return NextResponse.json({ error: "OpenRouter API key not configured. Visit Admin → Settings to configure." }, { status: 503 });
    }

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
        "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL || "https://glowide.app",
        "X-Title": "GlowIDE",
      },
      body: JSON.stringify({
        model: defaultModel,
        messages: [{ role: "system", content: systemPrompt }, ...messages],
        temperature: temperature ?? 0.7,
        max_tokens: maxTokens ?? 4096,
        stream: true,
      }),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({ error: { message: "Unknown error" } }));
      return NextResponse.json({ error: err.error?.message || "AI service error" }, { status: response.status });
    }

    // Stream the response
    return new Response(response.body, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (err) {
    console.error("Chat API error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
