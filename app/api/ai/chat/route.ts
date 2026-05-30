import { NextRequest, NextResponse } from "next/server";

export const runtime = "edge";
export const maxDuration = 60;

const CIRCLE_CONTEXT = `
Arc Testnet (Chain 5042002) — Circle assets:
- USDC: 0x3600000000000000000000000000000000000000 (native gas, 18 dec internal / 6 dec ERC-20)
- EURC: 0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a (6 dec)
- cirBTC: 0xf0C4a4CE82A5746AbAAd9425360Ab04fbBA432BF (8 dec)
- USYC: 0xe9185F0c5F296Ed1797AaE4238D26CCaBEadb86C (6 dec)
- TokenMessengerV2 CCTP: 0x8FE6B999Dc680CcFDD5Bf7EB0974218be2542DAA (domain 26)
- CCTP domains: ETH=0, AVAX=1, OP=2, ARB=3, Stellar=4, SOL=5, Base=6, Polygon=7, Arc=26
Always use USDC for gas. Use CCTP for cross-chain, not bridges.
`;

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
    const { messages, model, sessionId, temperature, maxTokens } = await req.json();
    void sessionId;

    const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").trim();
    const sKey        = (process.env.SUPABASE_SERVICE_ROLE_KEY ?? "").trim();

    // Defaults
    let apiKey     = process.env.OPENROUTER_API_KEY ?? "";
    let useModel   = model ?? process.env.OPENROUTER_DEFAULT_MODEL ?? "anthropic/claude-3.5-sonnet";
    let systemPrompt = `You are GlowIDE AI — a senior full-stack Web3 engineer. Write production-ready, secure, well-typed code with clear explanations.\n${CIRCLE_CONTEXT}`;
    let temp       = temperature ?? 0.7;
    let maxTok     = maxTokens ?? 4096;
    let trainingMessages: Array<{role:string;content:string}> = [];

    // Load settings + training from DB in parallel
    if (supabaseUrl && sKey) {
      const [settings, training] = await Promise.allSettled([
        fetchDB(supabaseUrl, sKey, "/system_settings?select=key,value&key=in.(openrouter_api_key,default_model,system_prompt,temperature,max_tokens)"),
        fetchDB(supabaseUrl, sKey, "/ai_training_examples?select=user_message,assistant_response,enabled&enabled=eq.true&limit=20"),
      ]);

      if (settings.status === "fulfilled" && Array.isArray(settings.value)) {
        const map = Object.fromEntries((settings.value as Array<{key:string;value:string}>).map(s => [s.key, s.value]));
        if (map.openrouter_api_key) apiKey   = map.openrouter_api_key;
        if (map.default_model)      useModel = model ?? map.default_model;
        if (map.system_prompt)      systemPrompt = map.system_prompt + "\n\n" + CIRCLE_CONTEXT;
        if (map.temperature)        temp     = parseFloat(map.temperature) || 0.7;
        if (map.max_tokens)         maxTok   = parseInt(map.max_tokens) || 4096;
      }

      if (training.status === "fulfilled" && Array.isArray(training.value)) {
        // Inject training examples as few-shot pairs before the conversation
        for (const ex of training.value as Array<{user_message:string;assistant_response:string}>) {
          if (ex.user_message && ex.assistant_response) {
            trainingMessages.push({ role: "user",      content: ex.user_message });
            trainingMessages.push({ role: "assistant", content: ex.assistant_response });
          }
        }
      }
    }

    if (!apiKey) {
      return NextResponse.json({ error: "OpenRouter API key not configured. Visit Admin → AI Config." }, { status: 503 });
    }

    // Build message array: system + few-shot training + conversation
    const allMessages = [
      { role: "system", content: systemPrompt },
      ...trainingMessages,
      ...messages,
    ];

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
        "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL ?? "https://glowide.app",
        "X-Title": "GlowIDE",
      },
      body: JSON.stringify({
        model: useModel,
        messages: allMessages,
        temperature: temp,
        max_tokens: maxTok,
        stream: true,
      }),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({ error: { message: "AI service error" } }));
      return NextResponse.json({ error: err.error?.message ?? "AI service error" }, { status: response.status });
    }

    return new Response(response.body, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
      },
    });
  } catch (err) {
    console.error("[ai/chat]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
