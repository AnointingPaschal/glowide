"use client";
import { useState, useCallback } from "react";
import { useEditorStore } from "@/store/editorStore";
import { useWalletStore } from "@/store/walletStore";
import { FlaskConical, Play, CheckCircle, XCircle, Loader2, Plus, AlertTriangle, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";

const TEST_TEMPLATE = `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

// Write plain Solidity — functions starting with "test" are deployed and
// called on Arc Testnet for real. A test PASSES if the transaction succeeds
// and FAILS if it reverts (e.g. via require()), exactly like Foundry.
contract YourContractTest {
    uint256 public value;

    function testInitialValue() public {
        require(value == 0, "Initial value should be 0");
    }

    function testSetValue() public {
        value = 42;
        require(value == 42, "Value should be 42 after set");
    }
}`;

interface TestResult { name: string; passed: boolean; message?: string; gas?: number; txHash?: string; }

interface EthProvider { request:(a:{method:string;params?:unknown[]})=>Promise<unknown>; }

const ARC_RPC = "https://rpc.testnet.arc.network";

export function UnitTestPanel() {
  const { tabs, activeTabId } = useEditorStore();
  const { address } = useWalletStore();
  const [results,  setResults]  = useState<TestResult[]|null>(null);
  const [loading,  setLoading]  = useState(false);
  const [progress, setProgress] = useState("");
  const [testCode, setTestCode] = useState(TEST_TEMPLATE);
  const [tab,      setTab]      = useState<"run"|"write">("run");
  const [deployedAddr, setDeployedAddr] = useState<string|null>(null);

  const activeFile = tabs.find(t => t.id === activeTabId);

  async function waitForReceipt(txHash: string): Promise<{ status:string; contractAddress?:string; gasUsed:string }> {
    for (let i = 0; i < 30; i++) {
      const res = await fetch(ARC_RPC, {
        method:"POST", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({ jsonrpc:"2.0", id:1, method:"eth_getTransactionReceipt", params:[txHash] }),
      });
      const d = await res.json() as { result?: { status:string; contractAddress?:string; gasUsed:string } };
      if (d.result) return d.result;
      await new Promise(r => setTimeout(r, 1000));
    }
    throw new Error("Timed out waiting for confirmation");
  }

  const runTests = useCallback(async () => {
    const provider = (window as Window & { ethereum?: EthProvider }).ethereum;
    if (!provider || !address) { setResults([{ name:"Setup", passed:false, message:"Connect a wallet first — tests deploy and execute for real on Arc Testnet" }]); return; }

    setLoading(true); setResults(null); setDeployedAddr(null);
    try {
      const fns = [...testCode.matchAll(/function\s+(test\w+)\s*\(\)/g)].map(m => m[1]);
      if (fns.length === 0) { setResults([]); return; }

      // 1. Compile the real test contract
      setProgress("Compiling test contract…");
      const compileRes = await fetch("/api/contracts/compile", {
        method:"POST", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({ sourceCode: testCode, contractName: "YourContractTest" }),
      });
      const compiled = await compileRes.json() as { success:boolean; bytecode?:string; errors?:Array<{message:string}> };
      if (!compiled.success || !compiled.bytecode) {
        setResults(fns.map(fn => ({ name: fn, passed: false, message: compiled.errors?.[0]?.message ?? "Compile failed" })));
        return;
      }

      // 2. Deploy the test contract for real
      setProgress("Deploying test contract to Arc Testnet…");
      const deployHash = await provider.request({
        method: "eth_sendTransaction",
        params: [{ from: address, data: compiled.bytecode.startsWith("0x") ? compiled.bytecode : "0x"+compiled.bytecode }],
      }) as string;
      const deployReceipt = await waitForReceipt(deployHash);
      if (deployReceipt.status !== "0x1" || !deployReceipt.contractAddress) {
        setResults(fns.map(fn => ({ name: fn, passed: false, message: "Test contract deployment failed" })));
        return;
      }
      setDeployedAddr(deployReceipt.contractAddress);

      // 3. Call each test* function for real — pass = tx succeeds, fail = it reverts
      const testResults: TestResult[] = [];
      for (const fn of fns) {
        setProgress(`Running ${fn}()…`);
        try {
          const selRes = await fetch(`/api/contracts/selector?sig=${encodeURIComponent(fn+"()")}`);
          const { selector } = await selRes.json() as { selector?: string };
          if (!selector) { testResults.push({ name: fn, passed: false, message: "Couldn't compute selector" }); continue; }

          const txHash = await provider.request({
            method: "eth_sendTransaction",
            params: [{ from: address, to: deployReceipt.contractAddress, data: "0x"+selector }],
          }) as string;
          const receipt = await waitForReceipt(txHash);
          const passed = receipt.status === "0x1";
          testResults.push({
            name: fn, passed, txHash,
            gas: parseInt(receipt.gasUsed, 16),
            message: passed ? undefined : "Transaction reverted — a require()/assert failed",
          });
        } catch (e) {
          testResults.push({ name: fn, passed: false, message: (e as Error).message ?? String(e) });
        }
      }
      setResults(testResults);
    } catch (e) {
      setResults([{ name:"Error", passed:false, message:String((e as Error).message ?? e) }]);
    } finally { setLoading(false); setProgress(""); }
  }, [testCode, address]);

  const insertTemplate = () => {
    const name = activeFile?.name?.replace(".sol","") ?? "Contract";
    const code = `// SPDX-License-Identifier: MIT\npragma solidity ^0.8.20;\n\ncontract ${name}Test {\n    function testExample() public {\n        require(true, "Example test should pass");\n    }\n}`;
    setTestCode(code);
    setTab("write");
  };

  const passed = results?.filter(r => r.passed).length ?? 0;
  const total  = results?.length ?? 0;

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="px-4 pt-4 pb-3 border-b border-glow-border/40 flex-shrink-0">
        <div className="flex items-center gap-2 mb-2">
          <FlaskConical className="w-4 h-4 text-glow-accent"/>
          <span className="text-sm font-semibold text-glow-text">Unit Testing</span>
        </div>
        <div className="flex items-start gap-1.5 mb-2 p-2 bg-glow-surface border border-glow-border/40 rounded-lg">
          <AlertTriangle className="w-3 h-3 text-amber-400 flex-shrink-0 mt-0.5"/>
          <p className="text-[9px] text-glow-muted/60 leading-relaxed">Tests deploy and execute for real on Arc Testnet — each test costs a small amount of testnet gas and needs your wallet to sign.</p>
        </div>
        <div className="flex gap-1 mb-1">
          {(["run","write"] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={cn("px-3 py-1 rounded-lg text-xs font-medium capitalize transition-colors",
                tab===t?"bg-glow-accent/20 text-glow-accent-light":"text-glow-muted/60 hover:text-glow-text")}>
              {t==="write"?"Write Tests":"Run Tests"}
            </button>
          ))}
        </div>
      </div>

      {tab === "write" ? (
        <div className="flex-1 flex flex-col p-3 gap-2 overflow-hidden">
          <div className="flex items-center justify-between">
            <p className="text-[10px] text-glow-muted/60 uppercase tracking-wider">Test Code</p>
            <button onClick={insertTemplate} className="flex items-center gap-1 text-[10px] text-glow-accent hover:opacity-80">
              <Plus className="w-3 h-3"/>From file
            </button>
          </div>
          <textarea value={testCode} onChange={e => setTestCode(e.target.value)}
            className="flex-1 bg-glow-bg border border-glow-border rounded-xl p-3 text-[11px] font-mono text-glow-text resize-none focus:outline-none focus:border-glow-accent/50"/>
          <button onClick={() => { setTab("run"); runTests(); }}
            className="w-full py-2 bg-glow-gradient text-white text-xs font-semibold rounded-xl flex items-center justify-center gap-2">
            <Play className="w-3.5 h-3.5"/>Save &amp; Run
          </button>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {results && (
            <div className={cn("p-3 rounded-xl border text-center", passed===total?"bg-emerald-500/8 border-emerald-500/20":"bg-amber-500/8 border-amber-500/20")}>
              <p className={cn("text-lg font-bold", passed===total?"text-emerald-400":"text-amber-400")}>
                {passed}/{total} passed
              </p>
              <p className="text-[10px] text-glow-muted/60">{total-passed} failing</p>
              {deployedAddr && (
                <a href={`https://testnet.arcscan.app/address/${deployedAddr}`} target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-[10px] text-glow-accent hover:underline mt-1.5">
                  <ExternalLink className="w-2.5 h-2.5"/>View test contract on ArcScan
                </a>
              )}
            </div>
          )}

          <button onClick={runTests} disabled={loading}
            className="w-full flex items-center justify-center gap-2 py-2.5 bg-glow-gradient text-white text-xs font-semibold rounded-xl disabled:opacity-50">
            {loading ? <><Loader2 className="w-3.5 h-3.5 animate-spin"/>{progress || "Running…"}</> : <><Play className="w-3.5 h-3.5"/>Run Tests</>}
          </button>

          {results?.length === 0 && (
            <p className="text-xs text-glow-muted/50 text-center py-4">No test functions found. Name your functions test*().</p>
          )}

          {results?.map((r, i) => (
            <div key={i} className={cn("flex items-start gap-2.5 p-3 rounded-xl border text-xs",
              r.passed ? "bg-emerald-500/8 border-emerald-500/20" : "bg-red-500/8 border-red-500/20")}>
              {r.passed
                ? <CheckCircle className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5"/>
                : <XCircle    className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5"/>}
              <div className="flex-1 min-w-0">
                <p className="font-mono font-semibold text-glow-text truncate">{r.name}()</p>
                {r.message && <p className="text-red-400/80 mt-0.5 text-[10px] leading-relaxed">{r.message}</p>}
                {r.gas !== undefined && <p className="text-glow-muted/40 mt-0.5 text-[10px]">Gas used: {r.gas.toLocaleString()}</p>}
                {r.txHash && (
                  <a href={`https://testnet.arcscan.app/tx/${r.txHash}`} target="_blank" rel="noopener noreferrer"
                    className="text-[10px] text-glow-accent hover:underline mt-0.5 inline-block">View tx →</a>
                )}
              </div>
            </div>
          ))}

          {!results && !loading && (
            <div className="text-center py-8">
              <FlaskConical className="w-10 h-10 text-glow-muted/20 mx-auto mb-3"/>
              <p className="text-sm text-glow-muted/50">Write tests, then run them</p>
              <button onClick={() => setTab("write")}
                className="mt-3 text-xs text-glow-accent hover:underline">Open test editor</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
