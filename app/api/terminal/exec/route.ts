/**
 * POST /api/terminal/exec
 * Executes a real shell command in an ephemeral sandbox directory.
 *
 * Supports: node, npm, npx, yarn, pnpm, git (safe subcommands), python3,
 * python, pip3, pip, tsc, solc, echo, cat, ls, mkdir, touch, rm, mv, cp,
 * grep, find, env, which, pwd, whoami.
 *
 * Honesty note: this runs inside Vercel's Node.js serverless runtime, which
 * does NOT ship python3/git binaries by default the way a real dev machine
 * does. We attempt the command regardless and surface a clear "not
 * available in this environment" message on ENOENT rather than a cryptic
 * failure, so the terminal never lies about what happened.
 *
 * Each request gets a fresh, isolated tmp directory: any project files
 * passed in are materialized there first, the command runs with cwd set to
 * it, then we diff the directory afterward and return any created/modified
 * files so the caller can sync them back into the in-browser file system.
 */
export const dynamic = "force-dynamic";
export const maxDuration = 60;
import { NextRequest, NextResponse } from "next/server";
import { exec } from "child_process";
import { promisify } from "util";
import { mkdtemp, writeFile, mkdir, readdir, readFile, rm, stat } from "fs/promises";
import { join, dirname } from "path";
import { tmpdir } from "os";

const execAsync = promisify(exec);

// First token of the command must match one of these (after stripping any
// leading `sudo`/path prefix, which we simply reject outright).
const ALLOWED_BINARIES = new Set([
  "node", "npm", "npx", "yarn", "pnpm",
  "git", "python3", "python", "pip3", "pip",
  "tsc", "solc", "echo", "cat", "ls", "pwd", "whoami", "env", "which",
  "mkdir", "touch", "rm", "mv", "cp", "grep", "find", "wc", "head", "tail",
]);

// Git subcommands that don't touch credentials/remotes/history rewriting.
const GIT_SAFE_SUBCOMMANDS = new Set([
  "clone", "status", "log", "diff", "branch", "init", "add", "commit", "show", "ls-files",
]);

function validateCommand(cmd: string): { ok: boolean; reason?: string } {
  const segments = cmd.split(/&&|;|\|\|/).map(s => s.trim()).filter(Boolean);
  if (segments.length === 0) return { ok: false, reason: "Empty command" };
  for (const seg of segments) {
    const tokens = seg.split(/\s+/);
    const bin = tokens[0];
    if (!ALLOWED_BINARIES.has(bin)) {
      return { ok: false, reason: `Command not allowed: "${bin}". Allowed: ${[...ALLOWED_BINARIES].join(", ")}` };
    }
    if (bin === "git") {
      const sub = tokens[1];
      if (!sub || !GIT_SAFE_SUBCOMMANDS.has(sub)) {
        return { ok: false, reason: `git subcommand "${sub ?? ""}" not allowed here (no push/pull/remote/credentials). Allowed: ${[...GIT_SAFE_SUBCOMMANDS].join(", ")}` };
      }
    }
    if (bin === "rm" && (seg.includes("-rf /") || seg.includes("--no-preserve-root"))) {
      return { ok: false, reason: "Destructive rm pattern blocked" };
    }
  }
  return { ok: true };
}

async function listFilesRecursive(dir: string, base = ""): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  let out: string[] = [];
  for (const e of entries) {
    if (e.name === "node_modules" || e.name === ".git" || e.name === ".home" || e.name === ".npm-cache") continue;
    const rel = base ? `${base}/${e.name}` : e.name;
    if (e.isDirectory()) out = out.concat(await listFilesRecursive(join(dir, e.name), rel));
    else out.push(rel);
  }
  return out;
}

export async function POST(req: NextRequest) {
  const body = await req.json() as {
    command?: string;
    files?: Array<{ path: string; content: string }>;
  };
  const command = body.command?.trim();
  if (!command) return NextResponse.json({ error: "No command provided" }, { status: 400 });

  const validation = validateCommand(command);
  if (!validation.ok) {
    return NextResponse.json({ error: validation.reason, stdout: "", stderr: "" }, { status: 400 });
  }

  let workDir: string | null = null;
  try {
    workDir = await mkdtemp(join(tmpdir(), "glowide-"));

    // Materialize provided project files into the sandbox — keep exact
    // content (not length/size) so the diff afterward is byte-for-byte
    // accurate, not an approximation that breaks on any non-ASCII character.
    const before = new Map<string, string>();
    for (const f of body.files ?? []) {
      const full = join(workDir, f.path);
      await mkdir(dirname(full), { recursive: true });
      await writeFile(full, f.content, "utf8");
      before.set(f.path, f.content);
    }

    // Give npm/git/pip a real writable HOME inside our own sandbox instead of
    // whatever ambient $HOME the serverless runtime reports (which is often
    // not an actual writable directory here, causing ENOENT on npm's cache).
    const fakeHome = join(workDir, ".home");
    await mkdir(fakeHome, { recursive: true });
    const npmCache = join(workDir, ".npm-cache");
    await mkdir(npmCache, { recursive: true });

    let stdout = "", stderr = "", timedOut = false;
    try {
      const result = await execAsync(command, {
        cwd: workDir,
        timeout: 25_000,
        maxBuffer: 5 * 1024 * 1024,
        env: {
          ...process.env,
          CI: "true",
          NO_COLOR: "1",
          HOME: fakeHome,
          npm_config_cache: npmCache,
          npm_config_update_notifier: "false",
          npm_config_fund: "false",
        },
      });
      stdout = result.stdout; stderr = result.stderr;
    } catch (e) {
      const err = e as { stdout?: string; stderr?: string; killed?: boolean; code?: string; message: string };
      stdout = err.stdout ?? "";
      stderr = err.stderr ?? "";
      timedOut = !!err.killed;
      if (err.code === "ENOENT" || /command not found|not recognized/i.test(err.message)) {
        stderr += `\n[GlowIDE] This binary isn't available in the serverless runtime. Node/npm/npx work reliably here; git, python3, and pip depend on what's bundled in Vercel's Node.js function image and may be missing.`;
      }
      if (!stdout && !stderr) stderr = err.message;
    }

    // Diff the directory to find files the command actually created or
    // changed — exact string comparison against what we wrote, so a file
    // the command never touched is NEVER reported as "updated" no matter
    // what characters it contains.
    const afterPaths = await listFilesRecursive(workDir);
    const updatedFiles: Array<{ path: string; content: string }> = [];
    for (const p of afterPaths) {
      try {
        const s = await stat(join(workDir, p));
        if (s.size > 2_000_000) continue; // skip anything huge (binaries, build output)
        const content = await readFile(join(workDir, p), "utf8").catch(() => null);
        if (content === null) continue; // unreadable/binary, skip
        const prior = before.get(p);
        if (prior === undefined || prior !== content) {
          updatedFiles.push({ path: p, content });
        }
      } catch { /* file vanished mid-diff, skip */ }
    }

    return NextResponse.json({ stdout, stderr, timedOut, updatedFiles });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  } finally {
    if (workDir) rm(workDir, { recursive: true, force: true }).catch(() => {});
  }
}
