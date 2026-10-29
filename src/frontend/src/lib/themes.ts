export type ThemeId =
  | "signature"
  | "midnight-muse"
  | "rose-quartz"
  | "cyber-minimalist";

export interface ThemeConfig {
  id: ThemeId;
  name: string;
  swatchGradient: string;
  bgColor: string;
  bgImage: string;
  cssVars: Record<string, string>;
}

// ── Signature: Serene Garden ────────────────────────────────────────────────
// Deep Forest Green #1B3022 | Soft Sage #B4C3A9 | Warm Sand #F5F2ED
// Texture: grainy recycled paper + leaf-pattern watermark
const signatureLeafSvg = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Cdefs%3E%3Cstyle%3E.leaf%7Bfill%3Anone%3Bstroke%3A%231B3022%3Bstroke-width%3A0.6%3Bopacity%3A0.06%7D%3C/style%3E%3C/defs%3E%3Cg transform%3D'translate(40%2C40)'%3E%3Cellipse cx%3D'0' cy%3D'0' rx%3D'18' ry%3D'8' class%3D'leaf' transform%3D'rotate(-30)'/%3E%3Cline x1%3D'0' y1%3D'-8' x2%3D'0' y2%3D'8' class%3D'leaf'/%3E%3C/g%3E%3Cg transform%3D'translate(130%2C90)'%3E%3Cellipse cx%3D'0' cy%3D'0' rx%3D'22' ry%3D'9' class%3D'leaf' transform%3D'rotate(20)'/%3E%3Cline x1%3D'0' y1%3D'-9' x2%3D'0' y2%3D'9' class%3D'leaf'/%3E%3C/g%3E%3Cg transform%3D'translate(80%2C160)'%3E%3Cellipse cx%3D'0' cy%3D'0' rx%3D'16' ry%3D'7' class%3D'leaf' transform%3D'rotate(50)'/%3E%3Cline x1%3D'0' y1%3D'-7' x2%3D'0' y2%3D'7' class%3D'leaf'/%3E%3C/g%3E%3C/svg%3E")`;
const grainNoise = (freq: string, opacity: string) =>
  `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='300'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='${freq}' numOctaves='4' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='300' height='300' filter='url(%23n)' opacity='${opacity}'/%3E%3C/svg%3E")`;

// ── Midnight Muse: Electric Noir ────────────────────────────────────────────
// True Black #000000 | Deep Royal Purple #2D0054 | Neon Cyan #00F5FF
// Texture: polished obsidian + star-field shimmer
const starFieldSvg = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='400'%3E%3Ccircle cx%3D'30' cy%3D'20' r%3D'1' fill%3D'%2300F5FF' opacity%3D'0.5'/%3E%3Ccircle cx%3D'120' cy%3D'60' r%3D'0.8' fill%3D'%2300F5FF' opacity%3D'0.4'/%3E%3Ccircle cx%3D'200' cy%3D'15' r%3D'1.2' fill%3D'white' opacity%3D'0.3'/%3E%3Ccircle cx%3D'310' cy%3D'45' r%3D'0.9' fill%3D'%2300F5FF' opacity%3D'0.45'/%3E%3Ccircle cx%3D'380' cy%3D'90' r%3D'1' fill%3D'white' opacity%3D'0.25'/%3E%3Ccircle cx%3D'60' cy%3D'130' r%3D'0.7' fill%3D'%2300F5FF' opacity%3D'0.4'/%3E%3Ccircle cx%3D'170' cy%3D'110' r%3D'1.1' fill%3D'white' opacity%3D'0.2'/%3E%3Ccircle cx%3D'260' cy%3D'150' r%3D'0.8' fill%3D'%2300F5FF' opacity%3D'0.5'/%3E%3Ccircle cx%3D'350' cy%3D'200' r%3D'1.3' fill%3D'white' opacity%3D'0.3'/%3E%3Ccircle cx%3D'90' cy%3D'220' r%3D'0.9' fill%3D'%2300F5FF' opacity%3D'0.35'/%3E%3Ccircle cx%3D'220' cy%3D'260' r%3D'1' fill%3D'white' opacity%3D'0.2'/%3E%3Ccircle cx%3D'320' cy%3D'290' r%3D'0.7' fill%3D'%2300F5FF' opacity%3D'0.45'/%3E%3Ccircle cx%3D'45' cy%3D'320' r%3D'1.2' fill%3D'white' opacity%3D'0.25'/%3E%3Ccircle cx%3D'150' cy%3D'370' r%3D'0.8' fill%3D'%2300F5FF' opacity%3D'0.4'/%3E%3Ccircle cx%3D'280' cy%3D'350' r%3D'1' fill%3D'white' opacity%3D'0.3'/%3E%3Ccircle cx%3D'370' cy%3D'340' r%3D'0.9' fill%3D'%2300F5FF' opacity%3D'0.5'/%3E%3C/svg%3E")`;

// ── Rose Quartz: Sunset Glow ────────────────────────────────────────────────
// Vibrant Terracotta #E2725B | Golden Hour Orange #FFBA08 | Soft Cream #FFF8E7
// Texture: iridescent watercolor bleed
const watercolorSvg = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='600' height='400'%3E%3Cdefs%3E%3CradialGradient id='w1' cx%3D'20%25' cy%3D'30%25' r%3D'40%25'%3E%3Cstop offset%3D'0' stop-color%3D'%23FFBA08' stop-opacity%3D'0.12'/%3E%3Cstop offset%3D'1' stop-color%3D'%23FFBA08' stop-opacity%3D'0'/%3E%3C/radialGradient%3E%3CradialGradient id%3D'w2' cx%3D'75%25' cy%3D'20%25' r%3D'35%25'%3E%3Cstop offset%3D'0' stop-color%3D'%23E2725B' stop-opacity%3D'0.1'/%3E%3Cstop offset%3D'1' stop-color%3D'%23E2725B' stop-opacity%3D'0'/%3E%3C/radialGradient%3E%3CradialGradient id%3D'w3' cx%3D'50%25' cy%3D'80%25' r%3D'45%25'%3E%3Cstop offset%3D'0' stop-color%3D'%23FFBA08' stop-opacity%3D'0.08'/%3E%3Cstop offset%3D'1' stop-color%3D'%23FFBA08' stop-opacity%3D'0'/%3E%3C/radialGradient%3E%3C/defs%3E%3Crect width%3D'600' height%3D'400' fill%3D'url(%23w1)'/%3E%3Crect width%3D'600' height%3D'400' fill%3D'url(%23w2)'/%3E%3Crect width%3D'600' height%3D'400' fill%3D'url(%23w3)'/%3E%3C/svg%3E")`;

// ── Cyber Minimalist: Modern Tech ────────────────────────────────────────────
// Stark White #FFFFFF | Cool Slate Grey #8E9AAF | Sharp Cobalt Blue #2563EB
// Texture: brushed aluminum + geometric grid overlay
const gridSvg = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='80' height='80'%3E%3Cpath d%3D'M80 0H0V80' fill%3D'none' stroke%3D'%23FF2E63' stroke-width%3D'0.4' opacity%3D'0.1'/%3E%3Ccircle cx%3D'0' cy%3D'0' r%3D'1.2' fill%3D'%23FF2E63' opacity%3D'0.15'/%3E%3Ccircle cx%3D'80' cy%3D'0' r%3D'1.2' fill%3D'%23FF2E63' opacity%3D'0.15'/%3E%3Ccircle cx%3D'0' cy%3D'80' r%3D'1.2' fill%3D'%23FF2E63' opacity%3D'0.15'/%3E%3C/svg%3E")`;

export const THEMES: ThemeConfig[] = [
  {
    id: "signature",
    name: "Signature",
    swatchGradient:
      "linear-gradient(135deg, #1B3022 0%, #B4C3A9 55%, #F5F2ED 100%)",
    bgColor: "oklch(0.965 0.007 85)",
    bgImage: `${signatureLeafSvg}, ${grainNoise("0.72", "0.042")}, linear-gradient(160deg, #F5F2ED 0%, #EBE6DC 100%)`,
    cssVars: {},
  },
  {
    id: "midnight-muse",
    name: "Midnight Muse",
    swatchGradient:
      "linear-gradient(135deg, #000000 0%, #2D0054 55%, #00F5FF 100%)",
    bgColor: "oklch(0.05 0.01 300)",
    bgImage: `${starFieldSvg}, ${grainNoise("0.65", "0.03")}, linear-gradient(160deg, #000000 0%, #0D0020 60%, #120033 100%)`,
    cssVars: {
      "--background": "0.05 0.01 300",
      "--foreground": "0.95 0.02 198",
      "--card": "0.10 0.10 295",
      "--card-foreground": "0.95 0.02 198",
      "--primary": "0.91 0.15 198",
      "--primary-foreground": "0.05 0.01 300",
      "--secondary": "0.14 0.12 295",
      "--secondary-foreground": "0.88 0.05 198",
      "--muted": "0.12 0.09 295",
      "--muted-foreground": "0.65 0.05 220",
      "--accent": "0.91 0.15 198",
      "--accent-foreground": "0.05 0.01 300",
      "--border": "0.22 0.14 295",
      "--input": "0.16 0.10 295",
      "--ring": "0.91 0.15 198",
      "--sage": "0.91 0.15 198",
      "--sage-light": "0.60 0.10 200",
      "--sage-dark": "0.40 0.12 295",
      "--cream": "0.05 0.01 300",
      "--warm-text": "0.95 0.02 198",
      "--warm-muted": "0.65 0.05 220",
      "--surface": "0.10 0.10 295",
      "--surface-elevated": "0.14 0.12 295",
      "--glass-border": "rgba(0, 245, 255, 0.5)",
      "--glass-bg": "rgba(45, 0, 84, 0.45)",
    },
  },
  {
    id: "rose-quartz",
    name: "Rose Quartz",
    swatchGradient:
      "linear-gradient(135deg, #4A2C2A 0%, #8E5B5B 55%, #D9C5B2 100%)",
    bgColor: "#4A2C2A",
    bgImage: `${watercolorSvg}, ${grainNoise("0.8", "0.025")}, linear-gradient(160deg, #4A2C2A 0%, #3A2020 100%)`,
    cssVars: {
      "--background": "0.98 0.025 88",
      "--foreground": "0.24 0.04 32",
      "--card": "1 0.01 88",
      "--card-foreground": "0.24 0.04 32",
      "--primary": "0.62 0.13 32",
      "--primary-foreground": "1 0 0",
      "--secondary": "0.93 0.04 80",
      "--secondary-foreground": "0.28 0.05 32",
      "--muted": "0.95 0.03 85",
      "--muted-foreground": "0.52 0.06 40",
      "--accent": "0.84 0.17 80",
      "--accent-foreground": "0.22 0.05 32",
      "--border": "0.88 0.06 45",
      "--input": "0.90 0.04 55",
      "--ring": "0.62 0.13 32",
      "--sage": "0.62 0.13 32",
      "--sage-light": "0.84 0.17 80",
      "--sage-dark": "0.42 0.10 32",
      "--cream": "0.98 0.025 88",
      "--warm-text": "0.24 0.04 32",
      "--warm-muted": "0.52 0.06 40",
      "--surface": "1 0.01 88",
      "--surface-elevated": "0.97 0.03 80",
      "--glass-border": "rgba(142, 91, 91, 0.5)",
      "--glass-bg": "rgba(74, 44, 42, 0.6)",
    },
  },
  {
    id: "cyber-minimalist",
    name: "Cyber Pink",
    swatchGradient:
      "linear-gradient(135deg, #1A1A1D 0%, #FF2E63 55%, #F9ED69 100%)",
    bgColor: "#0F0F12",
    bgImage: `${gridSvg}, linear-gradient(160deg, #0F0F12 0%, #1A0A10 100%)`,
    cssVars: {
      "--background": "0.07 0.005 300",
      "--foreground": "0.95 0.12 88",
      "--card": "0.16 0.008 300",
      "--card-foreground": "0.95 0.12 88",
      "--primary": "0.58 0.22 5",
      "--primary-foreground": "0.12 0.005 300",
      "--secondary": "0.20 0.01 300",
      "--secondary-foreground": "0.88 0.10 88",
      "--muted": "0.18 0.008 300",
      "--muted-foreground": "0.65 0.08 10",
      "--accent": "0.92 0.18 98",
      "--accent-foreground": "0.12 0.005 300",
      "--border": "0.28 0.01 300",
      "--input": "0.22 0.01 300",
      "--ring": "0.58 0.22 5",
      "--sage": "0.58 0.22 5",
      "--sage-light": "0.75 0.15 5",
      "--sage-dark": "0.40 0.18 5",
      "--cream": "0.12 0.005 300",
      "--warm-text": "0.95 0.12 88",
      "--warm-muted": "0.65 0.08 10",
      "--surface": "0.16 0.008 300",
      "--surface-elevated": "0.20 0.01 300",
      "--glass-border": "rgba(255, 46, 99, 0.4)",
      "--glass-bg": "rgba(15, 15, 18, 0.85)",
      "--glass-shadow": "0 0 10px #FF2E63",
      "--grid-color": "rgba(255, 46, 99, 0.1)",
    },
  },
];
