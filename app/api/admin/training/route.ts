import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import fs from "fs";
import path from "path";

function verifyAdmin(req: NextRequest) {
  const auth = req.headers.get("authorization");
  const key = process.env.ADMIN_SECRET_KEY;
  if (!key) return true;
  return auth === `Bearer ${key}`;
}

const TRAINING_PATH = path.join(process.cwd(), "ai-training", "glowide-training.jsonl");

export async function GET(req: NextRequest) {
  if (!verifyAdmin(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    // Try DB first
    const supabase = createServerSupabaseClient();
    const { data } = await supabase.from("ai_training_examples").select("*").order("created_at", { ascending: false });
    if (data && data.length > 0) return NextResponse.json({ examples: data });

    // Fall back to file
    const content = fs.existsSync(TRAINING_PATH) ? fs.readFileSync(TRAINING_PATH, "utf-8") : "";
    const examples = content.trim().split("\n").filter(Boolean).map((line, i) => {
      const obj = JSON.parse(line);
      return {
        id: `file-${i}`,
        user_message: obj.messages[1].content,
        assistant_response: obj.messages[2].content,
        category: "general",
        enabled: true,
        created_at: new Date().toISOString(),
      };
    });
    return NextResponse.json({ examples });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  if (!verifyAdmin(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const { examples } = await req.json();
    const supabase = createServerSupabaseClient();

    // Save to DB
    await supabase.from("ai_training_examples").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    const inserts = examples.map((ex: { user_message: string; assistant_response: string; category?: string; enabled?: boolean }) => ({
      user_message: ex.user_message,
      assistant_response: ex.assistant_response,
      category: ex.category ?? "general",
      enabled: ex.enabled ?? true,
      updated_at: new Date().toISOString(),
    }));
    await supabase.from("ai_training_examples").insert(inserts);

    // Also write JSONL file
    const SYS = "You are GlowIDE AI — a senior full-stack Web3 engineer and coding expert.";
    const jsonl = examples.map((ex: { user_message: string; assistant_response: string }) =>
      JSON.stringify({ messages: [{ role: "system", content: SYS }, { role: "user", content: ex.user_message }, { role: "assistant", content: ex.assistant_response }] })
    ).join("\n");
    fs.writeFileSync(TRAINING_PATH, jsonl);

    return NextResponse.json({ success: true, count: inserts.length });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
