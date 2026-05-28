import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";

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
