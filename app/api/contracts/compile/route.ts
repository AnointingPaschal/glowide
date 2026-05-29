/* eslint-disable */
import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 30;

export async function POST(req: NextRequest) {
  try {
    const { sourceCode, contractName, optimizer } = await req.json();
    if (!sourceCode) {
      return NextResponse.json({ success: false, errors: [{ type: "error", message: "No source code provided" }] }, { status: 400 });
    }

    // ── Load solc ──────────────────────────────────────────────
    // Dynamic require for solc (CommonJS module)
    // eslint-disable-next-line
    const solc = require("solc");

    const fileName = `${contractName ?? "Contract"}.sol`;
    const input = JSON.stringify({
      language: "Solidity",
      sources: { [fileName]: { content: sourceCode } },
      settings: {
        outputSelection: { "*": { "*": ["abi", "evm.bytecode", "evm.deployedBytecode", "metadata"] } },
        optimizer: optimizer ?? { enabled: true, runs: 200 },
        evmVersion: "paris", // Arc Testnet compatible
      },
    });

    const outputRaw = solc.compile(input);
    const output = JSON.parse(outputRaw) as {
      errors?: Array<{ type: string; severity: string; formattedMessage: string; message: string }>;
      contracts?: Record<string, Record<string, {
        abi: unknown[];
        evm: { bytecode: { object: string }; deployedBytecode: { object: string } };
        metadata: string;
      }>>;
    };

    // ── Collect errors/warnings ────────────────────────────────
    const errors   = (output.errors ?? []).filter(e => e.severity === "error");
    const warnings = (output.errors ?? []).filter(e => e.severity === "warning");

    if (errors.length > 0) {
      return NextResponse.json({
        success: false,
        errors: errors.map(e => ({ type: "error", message: e.message, formattedMessage: e.formattedMessage })),
        warnings: warnings.map(w => ({ type: "warning", message: w.message })),
      });
    }

    // ── Find compiled contract ─────────────────────────────────
    const contracts = output.contracts?.[fileName];
    if (!contracts) {
      return NextResponse.json({ success: false, errors: [{ type: "error", message: "Compilation produced no output" }] });
    }

    // Pick the requested contract or the first one
    const names = Object.keys(contracts);
    const targetName = contractName && names.includes(contractName) ? contractName : names[0];
    const compiled = contracts[targetName];

    if (!compiled) {
      return NextResponse.json({ success: false, errors: [{ type: "error", message: `Contract "${targetName}" not found in output` }] });
    }

    const bytecode = compiled.evm.bytecode.object
      ? "0x" + compiled.evm.bytecode.object
      : null;

    if (!bytecode || bytecode === "0x") {
      return NextResponse.json({ success: false, errors: [{ type: "error", message: "Compilation succeeded but no bytecode generated. Is this an abstract contract or interface?" }] });
    }

    return NextResponse.json({
      success: true,
      contractName: targetName,
      allContracts: names,
      abi: compiled.abi,
      bytecode,
      deployedBytecode: compiled.evm.deployedBytecode.object ? "0x" + compiled.evm.deployedBytecode.object : null,
      warnings: warnings.map(w => ({ type: "warning", message: w.message })),
      metadata: { compiler: { version: solc.version() }, optimizer: optimizer ?? { enabled: true, runs: 200 }, evmVersion: "paris" },
    });
  } catch (err) {
    console.error("[compile]", err);
    return NextResponse.json({ success: false, errors: [{ type: "error", message: String(err) }] }, { status: 500 });
  }
}
