import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { key } = await req.json();
    const adminKey = process.env.ADMIN_SECRET_KEY;

    // If no key is configured, allow any non-empty string
    if (!adminKey) {
      if (!key || !key.trim()) {
        return NextResponse.json({ error: "Enter an admin key" }, { status: 400 });
      }
      return NextResponse.json({ ok: true, warning: "ADMIN_SECRET_KEY not set in environment — anyone can log in" });
    }

    if (key === adminKey) {
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: "Invalid admin key" }, { status: 401 });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
