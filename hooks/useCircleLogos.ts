"use client";
import { useSiteSettings } from "./useSiteSettings";
import { LOGOS, CIRCLE_ASSETS, NETWORKS } from "@/lib/circle-chains";

/**
 * Returns resolved logo URLs for all Circle assets and Arc network.
 * Admin-uploaded logos take priority over inline SVG fallbacks.
 */
export function useCircleLogos() {
  const s = useSiteSettings();
  return {
    USDC:   s.usdcLogoUrl   || CIRCLE_ASSETS.USDC.logo,
    EURC:   s.eurcLogoUrl   || CIRCLE_ASSETS.EURC.logo,
    cirBTC: s.cirBTCLogoUrl || CIRCLE_ASSETS.cirBTC.logo,
    USYC:   s.usycLogoUrl   || LOGOS.usyc,
    ARC:    s.arcLogoUrl    || LOGOS.arc,
    // site logo
    site:   s.logoUrl,
    // resolve for any network id
    forNetwork: (networkId: string) => {
      if (networkId === "arc-testnet") return s.arcLogoUrl || LOGOS.arc;
      return NETWORKS.find(n => n.id === networkId)?.logo ?? LOGOS.eth;
    },
    // resolve for any asset symbol
    forAsset: (symbol: string): string => {
      const sym = symbol.toUpperCase();
      if (sym === "USDC")   return s.usdcLogoUrl   || CIRCLE_ASSETS.USDC.logo;
      if (sym === "EURC")   return s.eurcLogoUrl   || CIRCLE_ASSETS.EURC.logo;
      if (sym === "CIRBTC") return s.cirBTCLogoUrl || CIRCLE_ASSETS.cirBTC.logo;
      if (sym === "USYC")   return s.usycLogoUrl   || LOGOS.usyc;
      return "";
    },
  };
}
