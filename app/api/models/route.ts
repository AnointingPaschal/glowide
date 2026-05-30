export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { supabaseREST } from "@/lib/supabase-server";

const ADMIN_WALLET = (process.env.NEXT_PUBLIC_ADMIN_WALLET ?? "").toLowerCase();

function verifyAdmin(req: NextRequest): boolean {
  const auth = req.headers.get("authorization") ?? "";
  if (auth.startsWith("Wallet ")) {
    const w = auth.slice(7).toLowerCase();
    return ADMIN_WALLET ? w === ADMIN_WALLET : true;
  }
  return !process.env.ADMIN_SECRET_KEY;
}

export interface PublicModel {
  id: string; name: string; provider: string;
  tier: "premium" | "fast" | "coding";
  context_length?: number; description?: string; enabled: boolean;
}

const DEFAULT_MODELS: PublicModel[] = [
  { id:"anthropic/claude-sonnet-4-5",       name:"Claude Sonnet 4.5", provider:"Anthropic", tier:"premium", context_length:200000, description:"Latest Claude",        enabled:true  },
  { id:"anthropic/claude-3.5-sonnet",       name:"Claude 3.5 Sonnet", provider:"Anthropic", tier:"premium", context_length:200000, description:"Powerful & fast",      enabled:true  },
  { id:"anthropic/claude-3-haiku",          name:"Claude 3 Haiku",    provider:"Anthropic", tier:"fast",    context_length:200000, description:"Fastest Claude",        enabled:true  },
  { id:"openai/gpt-4o",                     name:"GPT-4o",            provider:"OpenAI",    tier:"premium", context_length:128000, description:"OpenAI flagship",       enabled:true  },
  { id:"openai/gpt-4o-mini",                name:"GPT-4o Mini",       provider:"OpenAI",    tier:"fast",    context_length:128000, description:"Fast & affordable",     enabled:true  },
  { id:"google/gemini-flash-1.5",           name:"Gemini 1.5 Flash",  provider:"Google",    tier:"fast",    context_length:1000000,description:"1M context",           enabled:true  },
  { id:"meta-llama/llama-3.1-70b-instruct", name:"Llama 3.1 70B",    provider:"Meta",      tier:"fast",    context_length:128000, description:"Open source",           enabled:true  },
  { id:"deepseek/deepseek-coder",           name:"DeepSeek Coder",    provider:"DeepSeek",  tier:"coding",  context_length:16000,  description:"Code specialist",       enabled:true  },
  { id:"mistralai/mistral-large",           name:"Mistral Large",     provider:"Mistral",   tier:"premium", context_length:32000,  description:"European AI",           enabled:true  },
];

async function getModelsFromDB(): Promise<PublicModel[] | null> {
  try {
    const { data, error } = await supabaseREST("GET", "system_settings", undefined, "select=value&key=eq.available_models&limit=1");
    if (error || !Array.isArray(data) || !data.length) return null;
    const row = data[0] as { value: string };
    if (!row.value) return null;
    const parsed = JSON.parse(row.value);
    return Array.isArray(parsed) ? parsed : null;
  } catch { return null; }
}

// GET — public endpoint, returns enabled models
export async function GET() {
  const dbModels = await getModelsFromDB();
  const models = dbModels ?? DEFAULT_MODELS;
  return NextResponse.json({ models: models.filter(m => m.enabled) });
}

// POST — admin: save full models list to DB
export async function POST(req: NextRequest) {
  if (!verifyAdmin(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const { models } = await req.json();
    if (!Array.isArray(models)) return NextResponse.json({ error: "models must be an array" }, { status: 400 });

    const row = { key: "available_models", value: JSON.stringify(models), is_secret: false, updated_at: new Date().toISOString() };
    // Try upsert
    const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/system_settings?on_conflict=key`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
        "Authorization": `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY ?? ""}`,
        "Prefer": "resolution=merge-duplicates,return=minimal",
      },
      body: JSON.stringify(row),
      cache: "no-store",
    });

    if (!res.ok) {
      const text = await res.text();
      return NextResponse.json({ error: text }, { status: 500 });
    }
    return NextResponse.json({ success: true, count: models.length });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
