/**
 * GET /api/github/oauth/start
 * Redirects the user to GitHub's OAuth authorize screen. Requires
 * GITHUB_CLIENT_ID to be set in Vercel env vars (create an OAuth App at
 * github.com/settings/developers — callback URL must be
 * https://yourdomain.com/api/github/oauth/callback).
 */
export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const clientId = process.env.GITHUB_CLIENT_ID;
  if (!clientId) {
    return NextResponse.json({
      error: "GitHub OAuth isn't configured yet.",
      hint: "Create an OAuth App at github.com/settings/developers, set the callback URL to " +
            `${req.nextUrl.origin}/api/github/oauth/callback, then add GITHUB_CLIENT_ID and ` +
            "GITHUB_CLIENT_SECRET to your Vercel environment variables.",
    }, { status: 400 });
  }

  const redirectUri = `${req.nextUrl.origin}/api/github/oauth/callback`;
  const state = crypto.randomUUID();

  const authUrl = new URL("https://github.com/login/oauth/authorize");
  authUrl.searchParams.set("client_id", clientId);
  authUrl.searchParams.set("redirect_uri", redirectUri);
  authUrl.searchParams.set("scope", "repo read:user");
  authUrl.searchParams.set("state", state);

  const res = NextResponse.redirect(authUrl.toString());
  // CSRF protection — verified against the callback's state param
  res.cookies.set("gh_oauth_state", state, { httpOnly: true, maxAge: 600, sameSite: "lax", path: "/" });
  return res;
}
