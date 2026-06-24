export const dynamic = "force-dynamic";
export const runtime = "nodejs";
import { NextRequest, NextResponse } from "next/server";

interface Finding {
  id:       string;
  severity: "high" | "medium" | "low" | "info";
  title:    string;
  message:  string;
  line?:    number;
  docs?:    string;
}

function analyze(source: string): Finding[] {
  const findings: Finding[] = [];
  const lines = source.split("\n");

  const check = (pattern: RegExp, id: string, severity: Finding["severity"], title: string, message: string, docs?: string) => {
    lines.forEach((line, i) => {
      if (pattern.test(line) && !line.trim().startsWith("//") && !line.trim().startsWith("*")) {
        findings.push({ id, severity, title, message, line: i + 1, docs });
      }
    });
  };

  // ── Security vulnerabilities ──────────────────────────────────────────────
  // SWC-115: tx.origin
  check(/\btx\.origin\b/, "SWC-115", "high",
    "tx.origin Authentication",
    "Use msg.sender instead of tx.origin for authorization. tx.origin can be manipulated by phishing attacks.",
    "https://swcregistry.io/docs/SWC-115"
  );

  // SWC-107: Reentrancy — state change after external call
  const hasExternalCall = /\.call\{|\.transfer\(|\.send\(/.test(source);
  const hasStateAfterCall = lines.some((l, i) => {
    if (/\.(call|transfer|send)\(/.test(l)) {
      const after = lines.slice(i+1, i+5).join(" ");
      return /\w+\s*[\+\-\*\/]?=/.test(after) && !after.includes("require") && !after.includes("revert");
    }
    return false;
  });
  if (hasExternalCall && hasStateAfterCall) {
    findings.push({ id:"SWC-107", severity:"high", title:"Potential Reentrancy",
      message:"State changes detected after external calls. Follow Checks-Effects-Interactions pattern or use ReentrancyGuard.",
      docs:"https://swcregistry.io/docs/SWC-107" });
  }

  // SWC-101: Integer overflow (no SafeMath, pre-0.8)
  const pragma = source.match(/pragma solidity\s+[^;]+;/)?.[0] ?? "";
  const ver = pragma.match(/(\d+\.\d+\.\d+)/)?.[1] ?? "0.8.0";
  const major = parseInt(ver.split(".")[1]);
  if (major < 8) {
    check(/\+\s*\d|\d\s*\+|\+\+\w|\w\+\+|\*\s*\d|\d\s*\*/, "SWC-101", "high",
      "Integer Overflow (pre-0.8)",
      "Solidity <0.8 doesn't auto-revert on overflow. Use SafeMath or upgrade to ^0.8.0.",
      "https://swcregistry.io/docs/SWC-101"
    );
  }

  // SWC-116: Block timestamp manipulation
  check(/block\.timestamp|now\b/, "SWC-116", "medium",
    "Block Timestamp Dependence",
    "block.timestamp can be manipulated by miners within ~15 seconds. Avoid using it for critical randomness or timelocks < 15s.",
    "https://swcregistry.io/docs/SWC-116"
  );

  // SWC-120: Weak randomness
  check(/block\.difficulty|block\.prevrandao|blockhash\(/, "SWC-120", "high",
    "Weak Randomness Source",
    "On-chain randomness sources (block.difficulty, blockhash) are predictable by miners. Use Chainlink VRF or commit-reveal.",
    "https://swcregistry.io/docs/SWC-120"
  );

  // SWC-128: DoS via block gas limit
  check(/for\s*\([^)]*\.length/, "SWC-128", "medium",
    "Loop Over Dynamic Array",
    "Looping over an array whose length isn't bounded can hit the block gas limit. Consider pagination.",
    "https://swcregistry.io/docs/SWC-128"
  );

  // Missing event on state change
  const hasMappingSet  = /\w+\[\w+\]\s*=/.test(source);
  const hasEvent       = /emit\s+\w+/.test(source);
  if (hasMappingSet && !hasEvent) {
    findings.push({ id:"BEST-001", severity:"low", title:"Missing Events",
      message:"State changes found but no events emitted. Events are essential for off-chain indexing and transparency." });
  }

  // Floating pragma
  check(/pragma solidity\s+\^|pragma solidity\s+>=/, "BEST-002", "low",
    "Floating Pragma",
    "Lock pragma to a specific version (e.g. pragma solidity 0.8.20;) to ensure deterministic compilation.",
    "https://swcregistry.io/docs/SWC-103"
  );

  // Unlocked send — no return value check
  check(/\.send\(/, "SWC-104", "medium",
    "Unchecked .send() Return Value",
    ".send() returns false on failure instead of reverting. Use .transfer() or check the return value.",
    "https://swcregistry.io/docs/SWC-104"
  );

  // Selfdestruct
  check(/selfdestruct\(|suicide\(/, "SWC-106", "high",
    "Selfdestruct Usage",
    "selfdestruct can permanently delete the contract. Ensure it's properly guarded with access control.",
    "https://swcregistry.io/docs/SWC-106"
  );

  // Assembly usage
  check(/assembly\s*\{/, "BEST-003", "info",
    "Inline Assembly",
    "Inline assembly bypasses Solidity safety checks. Ensure the assembly block is correct and well-commented.",
  );

  // Missing access control
  const hasOwner     = /Ownable|onlyOwner|AccessControl/.test(source);
  const hasSensitive = /mint\(|pause\(|setOwner\(|withdraw\(|emergencyWithdraw/.test(source);
  if (hasSensitive && !hasOwner) {
    findings.push({ id:"BEST-004", severity:"high", title:"Missing Access Control",
      message:"Sensitive functions (mint, withdraw, pause) found without access control. Add Ownable or a custom modifier." });
  }

  // Approve + transferFrom pattern (ERC-20 front-running)
  if (/\.approve\(/.test(source) && /transferFrom/.test(source)) {
    findings.push({ id:"BEST-005", severity:"medium", title:"Approve/TransferFrom Pattern",
      message:"The ERC-20 approve/transferFrom pattern is vulnerable to front-running. Consider increaseAllowance/decreaseAllowance or ERC-2612 permit." });
  }

  // Divide before multiply
  lines.forEach((line, i) => {
    if (/\/\s*\d+.*\*\s*\d+/.test(line) && !line.trim().startsWith("//")) {
      findings.push({ id:"MATH-001", severity:"medium", title:"Division Before Multiplication",
        message:"Dividing before multiplying loses precision in integer arithmetic. Multiply first, then divide.",
        line: i + 1 });
    }
  });

  // Missing zero address check
  const hasAddressParam = /address\s+\w+/.test(source);
  const hasZeroCheck    = /require\([^)]*!=\s*address\(0\)|if\s*\([^)]*==\s*address\(0\)/.test(source);
  if (hasAddressParam && !hasZeroCheck) {
    findings.push({ id:"BEST-006", severity:"low", title:"Missing Zero Address Check",
      message:"Address parameters are not validated against address(0). Add require(addr != address(0)) checks in constructors and setters." });
  }

  // No SPDX license
  if (!source.includes("SPDX-License-Identifier")) {
    findings.push({ id:"BEST-007", severity:"info", title:"Missing SPDX License",
      message:"No SPDX-License-Identifier found. Add // SPDX-License-Identifier: MIT (or your license) at the top." });
  }

  // Deduplicate line-level findings
  const seen = new Set<string>();
  return findings.filter(f => {
    const key = `${f.id}:${f.line ?? 0}`;
    if (seen.has(key)) return false;
    seen.add(key); return true;
  }).sort((a, b) => {
    const order = { high:0, medium:1, low:2, info:3 };
    return order[a.severity] - order[b.severity];
  });
}

export async function POST(req: NextRequest) {
  try {
    const { sourceCode } = await req.json() as { sourceCode?: string };
    if (!sourceCode) return NextResponse.json({ findings: [] });
    const findings = analyze(sourceCode);
    const summary = {
      high:   findings.filter(f => f.severity === "high").length,
      medium: findings.filter(f => f.severity === "medium").length,
      low:    findings.filter(f => f.severity === "low").length,
      info:   findings.filter(f => f.severity === "info").length,
    };
    return NextResponse.json({ findings, summary, total: findings.length });
  } catch (err) {
    return NextResponse.json({ error: String(err), findings: [] }, { status: 500 });
  }
}
