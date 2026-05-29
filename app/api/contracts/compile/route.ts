/* eslint-disable */
import { NextRequest, NextResponse } from "next/server";
import https from "https";

export const runtime = "nodejs";
export const maxDuration = 60;

// ── Import cache (process-level, survives warm lambdas) ─────────────────────
const importCache = new Map<string, string>();

// ── Resolve relative import path to absolute package path ───────────────────
function resolveRelative(importPath: string, fromPackagePath: string): string {
  if (!importPath.startsWith(".")) return importPath;
  // fromPackagePath e.g. "@openzeppelin/contracts/token/ERC20/ERC20.sol"
  const parts = fromPackagePath.split("/");
  parts.pop(); // remove filename, keep directory parts
  for (const seg of importPath.split("/")) {
    if (seg === "..") { parts.pop(); }
    else if (seg !== ".") { parts.push(seg); }
  }
  return parts.join("/");
}

// ── Map package path → GitHub raw URL ───────────────────────────────────────
function toRawUrl(pkgPath: string): string | null {
  const remaps: [RegExp, string][] = [
    [/^@openzeppelin\/contracts\/(.+)$/,              "https://raw.githubusercontent.com/OpenZeppelin/openzeppelin-contracts/v5.0.2/contracts/$1"],
    [/^@openzeppelin\/contracts-upgradeable\/(.+)$/,  "https://raw.githubusercontent.com/OpenZeppelin/openzeppelin-contracts-upgradeable/v5.0.2/contracts/$1"],
    [/^solmate\/(.+)$/,                               "https://raw.githubusercontent.com/transmissions11/solmate/main/src/$1"],
    [/^forge-std\/(.+)$/,                             "https://raw.githubusercontent.com/foundry-rs/forge-std/master/src/$1"],
  ];
  for (const [pat, base] of remaps) {
    const m = pkgPath.match(pat);
    if (m) return base.replace("$1", m[1]);
  }
  return null;
}

// ── Fetch one file from GitHub ───────────────────────────────────────────────
function fetchFile(url: string): Promise<string | null> {
  return new Promise(resolve => {
    https.get(url, res => {
      if (res.statusCode !== 200) { resolve(null); return; }
      let d = ""; res.on("data", c => d += c); res.on("end", () => resolve(d));
    }).on("error", () => resolve(null));
  });
}

// ── Recursively resolve & cache all imports in a Solidity source ─────────────
async function resolveAll(source: string, fromPkgPath: string, visited = new Set<string>()): Promise<void> {
  const re = /import\s+(?:{[^}]*}\s+from\s+)?["']([^"']+)["']/g;
  const pending: Promise<void>[] = [];
  let m: RegExpExecArray | null;

  while ((m = re.exec(source)) !== null) {
    const rawImport = m[1];
    // Resolve to absolute package path
    const absPath = rawImport.startsWith(".")
      ? resolveRelative(rawImport, fromPkgPath)
      : rawImport;

    if (visited.has(absPath) || importCache.has(absPath)) continue;
    visited.add(absPath);

    const url = toRawUrl(absPath);
    if (!url) continue; // unknown registry

    pending.push((async () => {
      const content = await fetchFile(url);
      if (!content) return;
      // Store under absolute path AND the original relative path (if different)
      importCache.set(absPath, content);
      if (rawImport !== absPath) importCache.set(rawImport, content);
      // Recurse into this file's imports
      await resolveAll(content, absPath, visited);
    })());
  }
  await Promise.all(pending);
}

// ── POST handler ─────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const { sourceCode, contractName, optimizer } = await req.json();
    if (!sourceCode) return NextResponse.json({ success:false, errors:[{type:"error",message:"No source code provided"}] }, { status:400 });

    let solc: any;
    try { solc = require("solc"); }
    catch (e) { return NextResponse.json({ success:false, errors:[{type:"error",message:`Solc unavailable: ${e}`}] }); }

    const fileLabel = `${contractName ?? "Contract"}.sol`;

    // ── Resolve ALL imports (including transitive) before compiling ────────
    await resolveAll(sourceCode, fileLabel);

    // ── The findImports callback (synchronous — all content already cached) ─
    function findImports(importPath: string): { contents: string } | { error: string } {
      // Check direct cache hit
      if (importCache.has(importPath)) return { contents: importCache.get(importPath)! };
      // Try resolving relative to root (shouldn't happen but safety net)
      const abs = resolveRelative(importPath, fileLabel);
      if (importCache.has(abs)) return { contents: importCache.get(abs)! };
      return { error: `Import "${importPath}" not found. Supported: @openzeppelin/contracts, @openzeppelin/contracts-upgradeable, solmate, forge-std.` };
    }

    const input = {
      language: "Solidity",
      sources: { [fileLabel]: { content: sourceCode } },
      settings: {
        outputSelection: { "*": { "*": ["abi","evm.bytecode","evm.deployedBytecode"] } },
        optimizer: optimizer ?? { enabled:true, runs:200 },
        evmVersion: "paris",
      },
    };

    let output: any;
    try { output = JSON.parse(solc.compile(JSON.stringify(input), { import: findImports })); }
    catch (e) { return NextResponse.json({ success:false, errors:[{type:"error",message:`Compiler error: ${e}`}] }); }

    const errors   = (output.errors ?? []).filter((e:any) => e.severity === "error");
    const warnings = (output.errors ?? []).filter((e:any) => e.severity === "warning");

    if (errors.length) return NextResponse.json({
      success:false,
      errors: errors.map((e:any) => ({ type:"error", message:e.message, formattedMessage:e.formattedMessage })),
      warnings: warnings.map((w:any) => ({ type:"warning", message:w.message })),
    });

    const fileContracts = output.contracts?.[fileLabel];
    if (!fileContracts) return NextResponse.json({ success:false, errors:[{type:"error",message:"No contracts in output. Check pragma and contract definition."}] });

    const names = Object.keys(fileContracts);
    const targetName = (contractName && names.includes(contractName)) ? contractName : names[0];
    const compiled = fileContracts[targetName];

    if (!compiled?.evm?.bytecode?.object) return NextResponse.json({ success:false, errors:[{type:"error",message:"No bytecode — is this abstract, interface, or library only?"}] });

    return NextResponse.json({
      success: true,
      contractName: targetName,
      allContracts: names,
      abi: compiled.abi ?? [],
      bytecode: "0x" + compiled.evm.bytecode.object,
      deployedBytecode: compiled.evm.deployedBytecode?.object ? "0x"+compiled.evm.deployedBytecode.object : null,
      warnings: warnings.map((w:any) => ({ type:"warning", message:w.message })),
      metadata: { compiler:{ version:solc.version() }, optimizer: optimizer ?? {enabled:true,runs:200}, evmVersion:"paris" },
    });
  } catch (err) {
    console.error("[compile]", err);
    return NextResponse.json({ success:false, errors:[{type:"error",message:String(err)}] }, { status:500 });
  }
}
