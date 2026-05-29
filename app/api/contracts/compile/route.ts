/* eslint-disable */
import { NextRequest, NextResponse } from "next/server";
import https from "https";

export const runtime = "nodejs";
export const maxDuration = 60;

// ── Fetch a file from unpkg/github for import resolution ─────────────────────
async function fetchImport(importPath: string): Promise<string | null> {
  // Map common import prefixes to CDN URLs
  const remaps: [RegExp, string][] = [
    [/^@openzeppelin\/contracts\/(.+)$/, "https://raw.githubusercontent.com/OpenZeppelin/openzeppelin-contracts/v5.0.2/contracts/$1"],
    [/^@openzeppelin\/contracts-upgradeable\/(.+)$/, "https://raw.githubusercontent.com/OpenZeppelin/openzeppelin-contracts-upgradeable/v5.0.2/contracts/$1"],
    [/^solmate\/(.+)$/, "https://raw.githubusercontent.com/transmissions11/solmate/main/src/$1"],
    [/^forge-std\/(.+)$/, "https://raw.githubusercontent.com/foundry-rs/forge-std/master/src/$1"],
  ];

  let url: string | null = null;
  for (const [pattern, base] of remaps) {
    const m = importPath.match(pattern);
    if (m) { url = base.replace("$1", m[1]); break; }
  }
  if (!url) return null;

  return new Promise((resolve) => {
    https.get(url!, (res) => {
      if (res.statusCode !== 200) { resolve(null); return; }
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => resolve(data));
    }).on("error", () => resolve(null));
  });
}

// ── Import cache to avoid re-fetching ────────────────────────────────────────
const importCache = new Map<string, string>();

export async function POST(req: NextRequest) {
  try {
    const { sourceCode, contractName, optimizer } = await req.json();
    if (!sourceCode) return NextResponse.json({ success: false, errors: [{ type: "error", message: "No source code provided" }] }, { status: 400 });

    let solc: any;
    try { solc = require("solc"); }
    catch (e) { return NextResponse.json({ success: false, errors: [{ type: "error", message: `Solidity compiler unavailable: ${String(e)}` }] }); }

    const fileLabel = `${contractName ?? "Contract"}.sol`;

    // ── Pre-fetch all imports from source ───────────────────────────────────
    const importRegex = /import\s+(?:{[^}]*}\s+from\s+)?["']([^"']+)["']/g;
    const toFetch = new Set<string>();
    let match: RegExpExecArray | null;
    while ((match = importRegex.exec(sourceCode)) !== null) {
      const imp = match[1];
      if (!imp.startsWith(".")) toFetch.add(imp);
    }

    // Fetch all imports recursively
    async function resolveImports(content: string, visited = new Set<string>()): Promise<void> {
      const re = /import\s+(?:{[^}]*}\s+from\s+)?["']([^"']+)["']/g;
      let m: RegExpExecArray | null;
      const fetches: Promise<void>[] = [];
      while ((m = re.exec(content)) !== null) {
        const imp = m[1];
        if (imp.startsWith(".") || visited.has(imp) || importCache.has(imp)) continue;
        visited.add(imp);
        fetches.push((async () => {
          const src = await fetchImport(imp);
          if (src) {
            importCache.set(imp, src);
            await resolveImports(src, visited);
          }
        })());
      }
      await Promise.all(fetches);
    }
    await resolveImports(sourceCode);

    // ── Compile with import callback ────────────────────────────────────────
    const input = {
      language: "Solidity",
      sources: { [fileLabel]: { content: sourceCode } },
      settings: {
        outputSelection: { "*": { "*": ["abi", "evm.bytecode", "evm.deployedBytecode"] } },
        optimizer: optimizer ?? { enabled: true, runs: 200 },
        evmVersion: "paris",
      },
    };

    function findImports(path: string) {
      if (importCache.has(path)) return { contents: importCache.get(path)! };
      return { error: `Import "${path}" not found. Only @openzeppelin, solmate, and forge-std are supported.` };
    }

    let output: any;
    try { output = JSON.parse(solc.compile(JSON.stringify(input), { import: findImports })); }
    catch (e) { return NextResponse.json({ success: false, errors: [{ type: "error", message: `Compiler error: ${String(e)}` }] }); }

    const errors   = (output.errors ?? []).filter((e: any) => e.severity === "error");
    const warnings = (output.errors ?? []).filter((e: any) => e.severity === "warning");
    if (errors.length) return NextResponse.json({ success: false, errors: errors.map((e: any) => ({ type: "error", message: e.message, formattedMessage: e.formattedMessage })), warnings: warnings.map((w: any) => ({ type: "warning", message: w.message })) });

    const fileContracts = output.contracts?.[fileLabel];
    if (!fileContracts) return NextResponse.json({ success: false, errors: [{ type: "error", message: "Compiler returned no contracts." }] });

    const names = Object.keys(fileContracts);
    const targetName = (contractName && names.includes(contractName)) ? contractName : names[0];
    const compiled = fileContracts[targetName];
    if (!compiled?.evm?.bytecode?.object) return NextResponse.json({ success: false, errors: [{ type: "error", message: "No bytecode — is this abstract or an interface?" }] });

    return NextResponse.json({
      success: true, contractName: targetName, allContracts: names,
      abi: compiled.abi ?? [],
      bytecode: "0x" + compiled.evm.bytecode.object,
      deployedBytecode: compiled.evm.deployedBytecode?.object ? "0x" + compiled.evm.deployedBytecode.object : null,
      warnings: warnings.map((w: any) => ({ type: "warning", message: w.message })),
      metadata: { compiler: { version: solc.version() }, evmVersion: "paris" },
    });
  } catch (err) {
    console.error("[compile]", err);
    return NextResponse.json({ success: false, errors: [{ type: "error", message: String(err) }] }, { status: 500 });
  }
}
