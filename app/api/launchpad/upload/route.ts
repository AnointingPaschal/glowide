export const dynamic = "force-dynamic";
export const maxDuration = 30;
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const json = formData.get("json") as string | null;
    const nftKey = process.env.NFT_STORAGE_API_KEY;

    if (file) {
      if (!nftKey) {
        // No IPFS key configured — return a placeholder (developer can add NFT_STORAGE_API_KEY)
        const bytes = await file.arrayBuffer();
        const b64 = Buffer.from(bytes).toString("base64");
        const dataUrl = `data:${file.type};base64,${b64}`;
        return NextResponse.json({ success: true, url: dataUrl, gateway: dataUrl, fallback: true });
      }
      const uploadRes = await fetch("https://api.nft.storage/upload", {
        method: "POST",
        headers: { Authorization: `Bearer ${nftKey}`, "Content-Type": file.type },
        body: await file.arrayBuffer(),
      });
      const d = await uploadRes.json() as { value?: { cid: string }; error?: { message: string } };
      if (!uploadRes.ok) throw new Error(d.error?.message ?? "Upload failed");
      const cid = d.value!.cid;
      return NextResponse.json({ success: true, cid, url: `ipfs://${cid}`, gateway: `https://nftstorage.link/ipfs/${cid}` });
    }

    if (json) {
      if (!nftKey) {
        const encoded = Buffer.from(json).toString("base64");
        return NextResponse.json({ success: true, url: `data:application/json;base64,${encoded}`, gateway: "", fallback: true });
      }
      const uploadRes = await fetch("https://api.nft.storage/upload", {
        method: "POST",
        headers: { Authorization: `Bearer ${nftKey}`, "Content-Type": "application/json" },
        body: json,
      });
      const d = await uploadRes.json() as { value?: { cid: string }; error?: { message: string } };
      if (!uploadRes.ok) throw new Error(d.error?.message ?? "Upload failed");
      const cid = d.value!.cid;
      return NextResponse.json({ success: true, cid, url: `ipfs://${cid}`, gateway: `https://nftstorage.link/ipfs/${cid}` });
    }

    return NextResponse.json({ error: "No file or json provided" }, { status: 400 });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
