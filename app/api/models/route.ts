export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";

export const revalidate = 60; // Cache for 60 seconds

export interface PublicModel {
  id: string;
  name: string;
  provider: string;
  tier: string;
  context_length?: number;
  description?: string;
  enabled: boolean;
}

// Default models if none configured in admin
const DEFAULT_MODELS: PublicModel[] = [
  { id: "anthropic/claude-sonnet-4-5", name: "Claude Sonnet 4.5", provider: "Anthropic", tier: "premium", context_length: 200000, description: "Latest Claude, best balance", enabled: true },
  { id: "anthropic/claude-3.5-sonnet", name: "Claude 3.5 Sonnet", provider: "Anthropic", tier: "premium", context_length: 200000, description: "Powerful, fast", enabled: true },
  { id: "anthropic/claude-3-haiku", name: "Claude 3 Haiku", provider: "Anthropic", tier: "fast", context_length: 200000, description: "Fastest Claude", enabled: true },
  { id: "openai/gpt-4o", name: "GPT-4o", provider: "OpenAI", tier: "premium", context_length: 128000, description: "OpenAI flagship", enabled: true },
  { id: "openai/gpt-4o-mini", name: "GPT-4o Mini", provider: "OpenAI", tier: "fast", context_length: 128000, description: "Fast and affordable", enabled: true },
  { id: "google/gemini-flash-1.5", name: "Gemini 1.5 Flash", provider: "Google", tier: "fast", context_length: 1000000, description: "1M context window", enabled: true },
  { id: "meta-llama/llama-3.1-70b-instruct", name: "Llama 3.1 70B", provider: "Meta", tier: "fast", context_length: 128000, description: "Open source, fast", enabled: true },
  { id: "deepseek/deepseek-coder", name: "DeepSeek Coder", provider: "DeepSeek", tier: "coding", context_length: 16000, description: "Specialized for code", enabled: true },
  { id: "mistralai/mistral-large", name: "Mistral Large", provider: "Mistral", tier: "premium", context_length: 32000, description: "European AI", enabled: true },
];

export async function GET() {
  try {
    const supabase = createServerSupabaseClient();
    const { data } = await supabase
      .from("system_settings")
      .select("value")
      .eq("key", "available_models")
      .single();

    if (data?.value) {
      const models = JSON.parse(data.value) as PublicModel[];
      const enabled = models.filter(m => m.enabled !== false);
      return NextResponse.json({ models: enabled.length ? enabled : DEFAULT_MODELS });
    }
  } catch {
    // Fall through to defaults
  }

  return NextResponse.json({ models: DEFAULT_MODELS });
}
