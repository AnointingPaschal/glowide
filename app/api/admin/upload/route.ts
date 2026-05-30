export const dynamic = "force-dynamic";
export const maxDuration = 30;
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

// Upload image → returns URL
// Uses NFT.storage if key present, otherwise stores as base64 data URL
// Also saves the URL to system_settings under the given key
export async function POST(req: NextRequest) {
  if (!verifyAdmin(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const formData = await req.formData();
    const file    = formData.get("file") as File | null;
    const setting = formData.get("setting") as string | null; // e.g. "logo_url", "usdc_logo_url"

    if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });
    if (file.size > 5 * 1024 * 1024) return NextResponse.json({ error: "File too large (max 5MB)" }, { status: 400 });

    let imageUrl = "";

    const nftKey = process.env.NFT_STORAGE_API_KEY;
    if (nftKey) {
      // Upload to IPFS via NFT.storage
      const bytes = await file.arrayBuffer();
      const res = await fetch("https://api.nft.storage/upload", {
        method: "POST",
        headers: { "Authorization": `Bearer ${nftKey}`, "Content-Type": file.type },
        body: bytes,
      });
      const d = await res.json() as { value?: { cid: string }; error?: { message: string } };
      if (!res.ok) throw new Error(d.error?.message ?? "NFT.storage upload failed");
      imageUrl = `https://nftstorage.link/ipfs/${d.value!.cid}`;
    } else {
      // Fallback: base64 data URL (works without external services)
      const bytes = await file.arrayBuffer();
      const b64 = Buffer.from(bytes).toString("base64");
      imageUrl = `data:${file.type};base64,${b64}`;
    }

    // If a settings key was provided, save to DB
    if (setting && imageUrl) {
      await supabaseREST("POST", "system_settings",
        { key: setting, value: imageUrl, is_secret: false, updated_at: new Date().toISOString() }
      );
      // Also try PATCH in case it exists
      await supabaseREST("PATCH", "system_settings",
        { value: imageUrl, updated_at: new Date().toISOString() },
        `key=eq.${setting}`
      ).catch(() => {});
    }

    return NextResponse.json({ success: true, url: imageUrl, setting });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
