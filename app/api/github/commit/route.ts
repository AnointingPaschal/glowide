/**
 * POST /api/github/commit
 * Commits and pushes one or more changed files to a GitHub repo as a single
 * commit, using GitHub's low-level Git Data API (blob -> tree -> commit ->
 * ref update). This produces one clean commit for the whole changeset
 * instead of one commit per file.
 *
 * The user's Personal Access Token is passed in the request body and used
 * only for this request — it's never written to any database or log here.
 */
export const dynamic = "force-dynamic";
export const maxDuration = 30;
import { NextRequest, NextResponse } from "next/server";

const GITHUB_API = "https://api.github.com";

interface FileChange { path: string; content: string; }

async function gh(token: string, path: string, init?: RequestInit) {
  const res = await fetch(`${GITHUB_API}${path}`, {
    ...init,
    headers: {
      "Authorization": `Bearer ${token}`,
      "Accept": "application/vnd.github+json",
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const msg = (data as { message?: string })?.message ?? `GitHub API ${res.status}`;
    throw new Error(msg);
  }
  return data;
}

export async function POST(req: NextRequest) {
  const body = await req.json() as {
    token?: string; owner?: string; repo?: string; branch?: string;
    message?: string; files?: FileChange[];
  };
  const { token, owner, repo, branch, message, files } = body;

  if (!token)   return NextResponse.json({ error: "GitHub token required" }, { status: 400 });
  if (!owner || !repo || !branch) return NextResponse.json({ error: "owner/repo/branch required" }, { status: 400 });
  if (!files?.length) return NextResponse.json({ error: "No changed files to commit" }, { status: 400 });

  try {
    // 1. Verify token + get identity (also confirms token is valid before we do anything else)
    const user = await gh(token, "/user") as { login: string };

    // 2. Get the current branch ref -> latest commit -> its tree
    const ref = await gh(token, `/repos/${owner}/${repo}/git/refs/heads/${branch}`) as { object: { sha: string } };
    const baseCommitSha = ref.object.sha;
    const baseCommit = await gh(token, `/repos/${owner}/${repo}/git/commits/${baseCommitSha}`) as { tree: { sha: string } };
    const baseTreeSha = baseCommit.tree.sha;

    // 3. Create a blob for each changed file
    const treeItems = await Promise.all(files.map(async (f) => {
      const blob = await gh(token, `/repos/${owner}/${repo}/git/blobs`, {
        method: "POST",
        body: JSON.stringify({ content: f.content, encoding: "utf-8" }),
      }) as { sha: string };
      return { path: f.path, mode: "100644", type: "blob", sha: blob.sha };
    }));

    // 4. Create a new tree layered on top of the current one
    const newTree = await gh(token, `/repos/${owner}/${repo}/git/trees`, {
      method: "POST",
      body: JSON.stringify({ base_tree: baseTreeSha, tree: treeItems }),
    }) as { sha: string };

    // 5. Create the commit
    const commitMessage = message?.trim() || `Update ${files.length} file(s) via GlowIDE`;
    const newCommit = await gh(token, `/repos/${owner}/${repo}/git/commits`, {
      method: "POST",
      body: JSON.stringify({ message: commitMessage, tree: newTree.sha, parents: [baseCommitSha] }),
    }) as { sha: string; html_url: string };

    // 6. Move the branch ref forward to the new commit (the actual "push")
    await gh(token, `/repos/${owner}/${repo}/git/refs/heads/${branch}`, {
      method: "PATCH",
      body: JSON.stringify({ sha: newCommit.sha }),
    });

    return NextResponse.json({
      ok: true,
      commitSha: newCommit.sha,
      commitUrl: `https://github.com/${owner}/${repo}/commit/${newCommit.sha}`,
      committedBy: user.login,
      filesChanged: files.length,
    });
  } catch (e) {
    return NextResponse.json({ error: String((e as Error).message ?? e) }, { status: 400 });
  }
}
