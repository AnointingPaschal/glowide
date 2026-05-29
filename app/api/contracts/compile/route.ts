/* eslint-disable */
import { NextRequest, NextResponse } from "next/server";

// Force Node.js runtime so require('solc') works
export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(req: NextRequest) {
  try {
    const { sourceCode, contractName, optimizer } = await req.json();

    if (!sourceCode) {
      return NextResponse.json(
        { success: false, errors: [{ type: "error", message: "No source code provided" }] },
        { status: 400 }
      );
    }

    // Validate basic Solidity syntax before loading solc
    const validationErrors: string[] = [];
    if (!sourceCode.includes("pragma solidity")) {
      validationErrors.push("Missing 'pragma solidity' statement");
    }
    if (!sourceCode.match(/contract\s+\w+|interface\s+\w+|library\s+\w+/)) {
      validationErrors.push("No contract, interface, or library definition found");
    }
    if (validationErrors.length) {
      return NextResponse.json({ success: false, errors: validationErrors.map(m => ({ type: "error", message: m })) });
    }

    let solc: any;
    try {
      solc = require("solc");
    } catch (e) {
      return NextResponse.json({
        success: false,
        errors: [{ type: "error", message: `Solidity compiler unavailable: ${String(e)}. Ensure 'solc' is in dependencies.` }],
      });
    }

    const fileLabel = `${contractName ?? "Contract"}.sol`;
    const input = {
      language: "Solidity",
      sources: { [fileLabel]: { content: sourceCode } },
      settings: {
        outputSelection: { "*": { "*": ["abi", "evm.bytecode", "evm.deployedBytecode"] } },
        optimizer: optimizer ?? { enabled: true, runs: 200 },
        evmVersion: "paris",
      },
    };

    let output: any;
    try {
      output = JSON.parse(solc.compile(JSON.stringify(input)));
    } catch (compileErr) {
      return NextResponse.json({
        success: false,
        errors: [{ type: "error", message: `Compiler internal error: ${String(compileErr)}` }],
      });
    }

    const errors   = (output.errors ?? []).filter((e: any) => e.severity === "error");
    const warnings = (output.errors ?? []).filter((e: any) => e.severity === "warning");

    if (errors.length) {
      return NextResponse.json({
        success: false,
        errors:   errors.map((e: any) => ({ type: "error", message: e.message, formattedMessage: e.formattedMessage })),
        warnings: warnings.map((w: any) => ({ type: "warning", message: w.message })),
      });
    }

    const fileContracts = output.contracts?.[fileLabel];
    if (!fileContracts) {
      return NextResponse.json({ success: false, errors: [{ type: "error", message: "Compiler returned no output for this file." }] });
    }

    const names = Object.keys(fileContracts);
    const targetName = (contractName && names.includes(contractName)) ? contractName : names[0];
    const compiled = fileContracts[targetName];

    if (!compiled?.evm?.bytecode?.object) {
      return NextResponse.json({
        success: false,
        errors: [{ type: "error", message: "No bytecode generated — is this an abstract contract or interface?" }],
      });
    }

    return NextResponse.json({
      success: true,
      contractName: targetName,
      allContracts: names,
      abi: compiled.abi ?? [],
      bytecode: "0x" + compiled.evm.bytecode.object,
      deployedBytecode: compiled.evm.deployedBytecode?.object ? "0x" + compiled.evm.deployedBytecode.object : null,
      warnings: warnings.map((w: any) => ({ type: "warning", message: w.message })),
      metadata: {
        compiler:    { version: solc.version() },
        optimizer:   optimizer ?? { enabled: true, runs: 200 },
        evmVersion:  "paris",
      },
    });
  } catch (err) {
    console.error("[compile]", err);
    return NextResponse.json(
      { success: false, errors: [{ type: "error", message: String(err) }] },
      { status: 500 }
    );
  }
}
