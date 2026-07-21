/**
 * GET /api/github/oauth/callback
 * Exchanges GitHub's authorization code for a real access token, then
 * redirects back to the editor with the token in the URL so the client can
 * store it (GitPanel reads it once, saves to githubStore, and cleans the URL).
 */
export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const code  = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state");
  const savedState = req.cookies.get("gh_oauth_state")?.value;

  const clientId     = process.env.GITHUB_CLIENT_ID;
  const clientSecret = process.env.GITHUB_CLIENT_SECRET;

  if (!code || !state || state !== savedState) {
    return NextResponse.redirect(`${req.nextUrl.origin}/editor?gh_error=${encodeURIComponent("Invalid OAuth state — please try connecting again")}`);
  }
  if (!clientId || !clientSecret) {
    return NextResponse.redirect(`${req.nextUrl.origin}/editor?gh_error=${encodeURIComponent("GitHub OAuth not configured (missing GITHUB_CLIENT_SECRET)")}`);
  }

  try {
    const tokenRes = await fetch("https://github.com/login/oauth/access_token", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Accept": "application/json" },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        redirect_uri: `${req.nextUrl.origin}/api/github/oauth/callback`,
      }),
    });
    const data = await tokenRes.json() as { access_token?: string; error?: string; error_description?: string };

    if (data.error || !data.access_token) {
      return NextResponse.redirect(`${req.nextUrl.origin}/editor?gh_error=${encodeURIComponent(data.error_description ?? "Token exchange failed")}`);
    }

    const res = NextResponse.redirect(`${req.nextUrl.origin}/editor?gh_token=${encodeURIComponent(data.access_token)}`);
    res.cookies.delete("gh_oauth_state");
    return res;
  } catch (e) {
    return NextResponse.redirect(`${req.nextUrl.origin}/editor?gh_error=${encodeURIComponent(String(e))}`);
  }
}
