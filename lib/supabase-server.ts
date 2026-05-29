import { createClient } from "@supabase/supabase-js";

export function createServerSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error(
      "Missing Supabase env vars: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in Vercel."
    );
  }

  // Validate URL format
  if (!url.startsWith("https://") || !url.includes(".supabase.co")) {
    throw new Error(
      `Invalid NEXT_PUBLIC_SUPABASE_URL format: "${url}". Expected: https://xxxx.supabase.co`
    );
  }

  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: {
      // Explicit fetch options to avoid SSL/DNS issues
      fetch: (input, init) =>
        fetch(input, { ...init, cache: "no-store" }),
    },
  });
}

// ── Direct REST helper — bypasses SDK entirely ──────────────────────────────
// Use this when SDK has network issues (paused project, DNS, etc.)
export async function supabaseREST(
  method: "GET" | "POST" | "PATCH" | "DELETE",
  table: string,
  body?: object,
  query?: string
): Promise<{ data: unknown; error: string | null; status: number }> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    return { data: null, error: "Missing Supabase env vars", status: 500 };
  }

  const endpoint = `${url}/rest/v1/${table}${query ? `?${query}` : ""}`;

  try {
    const res = await fetch(endpoint, {
      method,
      headers: {
        "Content-Type":  "application/json",
        "apikey":        key,
        "Authorization": `Bearer ${key}`,
        "Prefer":        method === "POST" ? "return=representation" : "return=minimal",
      },
      body: body ? JSON.stringify(body) : undefined,
      cache: "no-store",
    });

    const text = await res.text();
    let data: unknown = null;
    try { data = JSON.parse(text); } catch { data = text; }

    return {
      data,
      error: res.ok ? null : (typeof data === "object" && data !== null && "message" in data ? (data as { message: string }).message : text),
      status: res.status,
    };
  } catch (err) {
    return { data: null, error: String(err), status: 0 };
  }
}
