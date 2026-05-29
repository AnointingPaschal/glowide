"use client";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useAccount } from "wagmi";
import { useEffect } from "react";
import { useWalletStore } from "@/store/walletStore";

/** Syncs wagmi/rainbowkit account state to our Zustand store */
export function WalletButton() {
  const { address, chainId, isConnected } = useAccount();
  const { setAddress, setChainId, setConnected, disconnect } = useWalletStore();

  useEffect(() => {
    if (isConnected && address) {
      setAddress(address);
      setChainId(chainId ?? null);
      setConnected(true);
    } else {
      disconnect();
    }
  }, [isConnected, address, chainId, setAddress, setChainId, setConnected, disconnect]);

  return (
    <ConnectButton
      accountStatus="avatar"
      chainStatus="icon"
      showBalance={false}
    />
  );
}
