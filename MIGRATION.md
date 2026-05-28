# GlowIDE — Update Migration Guide

## What Changed

### 1. Sidebar → Removed
The left sidebar is gone. All navigation moves to the top bar.

### 2. TopBar — Full Navigation
The topbar now contains all navigation links:
- **Desktop (lg+)**: Full text labels
- **Tablet (md–lg)**: Icon-only nav
- **Mobile**: Hamburger → slide-in drawer

### 3. Chat = Homepage
`/` now redirects to `/chat` via a server-side redirect. The chat page is the default landing.

### 4. Standalone Wallet Connect (no third party)
`WalletButton` uses EIP-1193 (`window.ethereum`) directly:
- Works with MetaMask, Coinbase Wallet, Brave Wallet, Rainbow, and any injected provider
- Detects existing connection on mount (silent, no prompt)
- Auto-switches to Arc Testnet (5042002); adds it if not present
- Listens to `accountsChanged`, `chainChanged`, `disconnect` events
- No wagmi, no WalletConnect SDK

### 5. Providers — wagmi removed
`Providers.tsx` is now just `QueryClientProvider + Toaster`. Remove wagmi-related dependencies if you want a leaner bundle (optional — they won't break anything if left).

---

## Files to Replace

| File | Status |
|---|---|
| `app/page.tsx` | **Replace** — redirects to `/chat` |
| `app/chat/page.tsx` | **Replace** — mobile-responsive with drawer sidebar |
| `app/editor/page.tsx` | **Replace** — mobile detection + warning |
| `app/globals.css` | **Replace** — `100dvh` support, mobile tap improvements |
| `components/layout/AppLayout.tsx` | **Replace** — no sidebar |
| `components/layout/TopBar.tsx` | **Replace** — full nav + hamburger |
| `components/wallet/WalletButton.tsx` | **Replace** — standalone EIP-1193 |
| `components/providers/Providers.tsx` | **Replace** — wagmi removed |
| `store/walletStore.ts` | **Replace** — persist address only (session re-established silently) |

## Files to Delete
- `components/layout/Sidebar.tsx` — no longer used

---

## Mobile Breakpoints Used

| Breakpoint | Description |
|---|---|
| `< md (768px)` | Mobile: hamburger nav, smaller text, 100dvh |
| `md–lg (768–1024px)` | Tablet: icon-only topbar nav |
| `≥ lg (1024px+)` | Desktop: full text nav |

---

## Wallet Connect — How It Works

```
User clicks "Connect"
  → eth_requestAccounts (prompts wallet)
  → eth_chainId (check current chain)
  → if chain ≠ 5042002:
      → wallet_switchEthereumChain
      → if error 4902 (chain not added):
          → wallet_addEthereumChain (Arc Testnet)
  → Store address + chainId in Zustand (persisted to localStorage)
  → On next page load: eth_accounts (silent, no prompt)
      → if accounts returned, auto-reconnect
```

No private keys are ever accessed. The app is read-only until the user initiates a transaction (which triggers wallet approval).

---

## Dependencies — Safe to Remove (Optional)

```bash
npm uninstall wagmi @wagmi/core @walletconnect/modal
```

These were previously used for wallet connection. The standalone EIP-1193 approach replaces them. `viem` can be kept for Arc Testnet utilities.
