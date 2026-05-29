import { useState, useEffect } from "react";

export interface SiteSettings {
  siteName: string; siteTagline: string; siteDescription: string;
  logoUrl: string; primaryColor: string;
  usdcLogoUrl: string; eurcLogoUrl: string; cirBTCLogoUrl: string;
}

const DEFAULTS: SiteSettings = {
  siteName: "GlowIDE", siteTagline: "AI-Powered Web3 IDE",
  siteDescription: "Build smarter on Web3", logoUrl: "",
  primaryColor: "#7c3aed",
  usdcLogoUrl:   "https://www.circle.com/hubfs/USDC/USDC_icon_1.svg",
  eurcLogoUrl:   "https://www.circle.com/hubfs/EURC/EURC_icon.svg",
  cirBTCLogoUrl: "https://cryptologos.cc/logos/bitcoin-btc-logo.svg",
};

let _cache: SiteSettings | null = null;

export function useSiteSettings() {
  const [s, set] = useState<SiteSettings>(_cache ?? DEFAULTS);
  useEffect(() => {
    if (_cache) return;
    fetch("/api/admin/public-settings")
      .then(r => r.json())
      .then(d => {
        _cache = {
          siteName:      d.site_name        || DEFAULTS.siteName,
          siteTagline:   d.site_tagline     || DEFAULTS.siteTagline,
          siteDescription: d.site_description || DEFAULTS.siteDescription,
          logoUrl:       d.logo_url         || "",
          primaryColor:  d.primary_color    || DEFAULTS.primaryColor,
          usdcLogoUrl:   d.usdc_logo_url    || DEFAULTS.usdcLogoUrl,
          eurcLogoUrl:   d.eurc_logo_url    || DEFAULTS.eurcLogoUrl,
          cirBTCLogoUrl: d.cirbtc_logo_url  || DEFAULTS.cirBTCLogoUrl,
        };
        set(_cache);
      }).catch(() => {});
  }, []);
  return s;
}
