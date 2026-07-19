# GlowIDE

> AI-powered Web3 IDE and smart contract builder — built on Arc Testnet, powered by OpenRouter.

![GlowIDE](https://img.shields.io/badge/GlowIDE-Web3%20IDE-7c3aed?style=for-the-badge)
![Next.js](https://img.shields.io/badge/Next.js-14-black?style=for-the-badge&logo=next.js)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?style=for-the-badge&logo=typescript)

---

## ✨ Core Features
 
* **Monaco Editor** — A premium, desktop-grade editor running entirely in the browser. Supports full syntax highlighting and intelligent autocompletion for Solidity, TypeScript, JavaScript, Python, and HTML/CSS.
* **Context-Aware AI Assistant** — Powered by OpenRouter for multi-model streaming responses. Synced with the target infrastructure’s network rules and pre-trained on Arc documentation and USDC gas mechanics to support automated audits and 1-click complex architecture injections.
* **Smart Contract Tools** — A complete suite that abstracts away infrastructure bottlenecks. Allows builders to compile, deploy, verify, and interact with Solidity contracts on Arc Testnet instantly.
* **Arc Testnet Integration** — Native, zero-config network mapping configured for rapid smart contract execution with built-in gas engine management.
* **Circle Asset Architecture** — Built-in tracking and client-side balance transfers for Circle-issued assets on Arc Testnet, including USDC, EURC, and cirBTC.
* **Non-Custodial Wallet Authentication** — Secure client-side sandbox injections that connect MetaMask, WalletConnect, or any standard injected browser wallet without storing user transaction keys.
* **Customizable Workspace Environment** — Fine-grained control over the development environment, allowing runtime adjustments to AI system prompts, temperatures, and default model personas.

---

## ⛓ Arc Testnet Configuration

GlowIDE abstracts network bridging into a native one-click pipeline built on the following infrastructure parameters:

| Setting | Value |
|---|---|
| **Network Name** | Arc Testnet |
| **Chain ID** | 5042002 |
| **RPC URL** | https://rpc.testnet.arc.network |
| **Explorer** | https://testnet.arcscan.app |
| **Gas Token** | USDC |

---

## 🪙 Tracked Circle Assets

The workspace securely bridges and maps balance tracking for three primary Circle assets natively issued on the base chain:

| Asset | Symbol | Description |
|---|---|---|
| **USD Coin** | USDC | Native gas token utilized for automated engine execution on Arc Testnet |
| **Euro Coin** | EURC | Euro-backed programmable stablecoin layer |
| **Circle Bitcoin** | cirBTC | Wrapped Bitcoin primitive secured by Circle infrastructure |

---

## 🛠 Architectural Stack

GlowIDE utilizes an enterprise-grade, high-availability architecture designed to process state-heavy developer workloads with zero latency:

* **Frontend Framework:** Next.js 14 App Router (React Engine)
* **Core Language:** TypeScript 5 (Strict type safety)
* **Style Engine:** Tailwind CSS 
* **Editor Core:** Browser-native Monaco Editor instance
* **State Management:** Zustand + TanStack Query for deterministic mock-compilation and asynchronous UI states
* **Blockchain Communication:** wagmi v2 + viem for robust RPC pooling and client-side transaction auth
* **AI Translation Layer:** OpenRouter streaming architecture

---

## 📄 License

MIT
