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
  usdcLogoUrl:   "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Ccircle cx='16' cy='16' r='16' fill='%232775CA'/%3E%3Cpath fill='white' d='M16 5.2c-5.99 0-10.8 4.81-10.8 10.8S10.01 26.8 16 26.8 26.8 21.99 26.8 16 21.99 5.2 16 5.2zm1.44 14.4v1.44c0 .72-.36 1.08-1.08 1.08h-.72c-.72 0-1.08-.36-1.08-1.08v-1.44c-2.16-.36-3.6-1.8-3.6-3.6 0-.72.36-1.08 1.08-1.08h1.08c.72 0 1.08.36 1.08 1.08 0 .72.72 1.44 1.8 1.44s1.8-.36 1.8-1.08c0-.72-.36-1.08-1.8-1.44-2.16-.72-3.6-1.44-3.6-3.6 0-1.8 1.44-3.24 3.24-3.6V9.08c0-.72.36-1.08 1.08-1.08h.72c.72 0 1.08.36 1.08 1.08v1.44c1.8.36 3.24 1.8 3.24 3.24 0 .72-.36 1.08-1.08 1.08h-.72c-.72 0-1.08-.36-1.08-1.08 0-.72-.72-1.44-1.8-1.44-.72 0-1.8.36-1.8 1.08 0 .72.72 1.08 1.8 1.44 2.52.72 3.6 1.8 3.6 3.6 0 1.8-1.44 3.24-3.24 3.6z'/%3E%3C/svg%3E",
  eurcLogoUrl:   "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Ccircle cx='16' cy='16' r='16' fill='%231A56DB'/%3E%3Ctext x='16' y='21' font-size='16' font-weight='bold' text-anchor='middle' fill='white' font-family='Arial'%3E€%3C/text%3E%3C/svg%3E",
  cirBTCLogoUrl: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Ccircle cx='16' cy='16' r='16' fill='%23F7931A'/%3E%3Ctext x='16' y='22' font-size='18' font-weight='bold' text-anchor='middle' fill='white' font-family='Arial'%3E₿%3C/text%3E%3C/svg%3E",
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
