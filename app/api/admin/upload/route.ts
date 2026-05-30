export const dynamic = "force-dynamic";
export const maxDuration = 30;
import { NextRequest, NextResponse } from "next/server";

const ADMIN_WALLET = (process.env.NEXT_PUBLIC_ADMIN_WALLET ?? "").toLowerCase();

function verifyAdmin(req: NextRequest): boolean {
  const auth = req.headers.get("authorization") ?? "";
  if (auth.startsWith("Wallet ")) {
    const w = auth.slice(7).toLowerCase();
    return ADMIN_WALLET ? w === ADMIN_WALLET : true;
  }
  return !process.env.ADMIN_SECRET_KEY;
}

async function saveToDb(key: string, value: string): Promise<boolean> {
  const url  = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const sKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !sKey) return false;

  const row = { key, value, is_secret: false, updated_at: new Date().toISOString() };
  const headers = {
    "Content-Type":  "application/json",
    "apikey":        sKey,
    "Authorization": `Bearer ${sKey}`,
    "Prefer":        "resolution=merge-duplicates,return=minimal",
  };

  // Upsert with on_conflict=key
  const res = await fetch(`${url}/rest/v1/system_settings?on_conflict=key`, {
    method:  "POST",
    headers,
    body:    JSON.stringify(row),
    cache:   "no-store",
  });

  if (!res.ok) {
    const text = await res.text();
    console.error(`[upload] DB save failed for ${key}:`, text.slice(0, 200));
    return false;
  }
  return true;
}

export async function POST(req: NextRequest) {
  if (!verifyAdmin(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const formData = await req.formData();
    const file    = formData.get("file") as File | null;
    const setting = formData.get("setting") as string | null;

    if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });
    if (file.size > 5 * 1024 * 1024) return NextResponse.json({ error: "File too large (max 5MB)" }, { status: 400 });

    let imageUrl = "";

    const nftKey = process.env.NFT_STORAGE_API_KEY?.trim();
    if (nftKey) {
      const bytes = await file.arrayBuffer();
      const res = await fetch("https://api.nft.storage/upload", {
        method:  "POST",
        headers: { "Authorization": `Bearer ${nftKey}`, "Content-Type": file.type },
        body:    bytes,
      });
      const d = await res.json() as { value?: { cid: string }; error?: { message: string } };
      if (!res.ok) throw new Error(d.error?.message ?? "NFT.storage upload failed");
      imageUrl = `https://nftstorage.link/ipfs/${d.value!.cid}`;
    } else {
      // Fallback: base64 data URL (no external service needed)
      const bytes = await file.arrayBuffer();
      const b64 = Buffer.from(bytes).toString("base64");
      imageUrl = `data:${file.type};base64,${b64}`;
    }

    // Save URL to system_settings immediately
    let dbSaved = false;
    if (setting) {
      dbSaved = await saveToDb(setting, imageUrl);
    }

    return NextResponse.json({
      success: true,
      url: imageUrl,
      setting,
      dbSaved,
      message: dbSaved
        ? "Image uploaded and saved to database"
        : setting
          ? "Image uploaded but DB save failed — check Supabase connection"
          : "Image uploaded (no setting key provided)",
    });
  } catch (err) {
    console.error("[upload]", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
