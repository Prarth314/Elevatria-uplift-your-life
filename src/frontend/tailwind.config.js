import typography from "@tailwindcss/typography";
import containerQueries from "@tailwindcss/container-queries";
import animate from "tailwindcss-animate";

/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ["class"],
  content: ["index.html", "src/**/*.{js,ts,jsx,tsx,html,css}"],
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      fontFamily: {
        serif: ["'Instrument Serif'", "Georgia", "serif"],
        sans: ["'Outfit'", "system-ui", "sans-serif"],
        display: ["'Fraunces'", "'Instrument Serif'", "Georgia", "serif"],
      },
      colors: {
        border: "oklch(var(--border))",
        input: "oklch(var(--input))",
        ring: "oklch(var(--ring) / <alpha-value>)",
        background: "oklch(var(--background))",
        foreground: "oklch(var(--foreground))",
        primary: {
          DEFAULT: "oklch(var(--primary) / <alpha-value>)",
          foreground: "oklch(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "oklch(var(--secondary) / <alpha-value>)",
          foreground: "oklch(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "oklch(var(--destructive) / <alpha-value>)",
          foreground: "oklch(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "oklch(var(--muted) / <alpha-value>)",
          foreground: "oklch(var(--muted-foreground) / <alpha-value>)",
        },
        accent: {
          DEFAULT: "oklch(var(--accent) / <alpha-value>)",
          foreground: "oklch(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "oklch(var(--popover))",
          foreground: "oklch(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "oklch(var(--card))",
          foreground: "oklch(var(--card-foreground))",
        },
        chart: {
          1: "oklch(var(--chart-1))",
          2: "oklch(var(--chart-2))",
          3: "oklch(var(--chart-3))",
          4: "oklch(var(--chart-4))",
          5: "oklch(var(--chart-5))",
        },
        sidebar: {
          DEFAULT: "oklch(var(--sidebar))",
          foreground: "oklch(var(--sidebar-foreground))",
          primary: "oklch(var(--sidebar-primary))",
          "primary-foreground": "oklch(var(--sidebar-primary-foreground))",
          accent: "oklch(var(--sidebar-accent))",
          "accent-foreground": "oklch(var(--sidebar-accent-foreground))",
          border: "oklch(var(--sidebar-border))",
          ring: "oklch(var(--sidebar-ring))",
        },
        sage: {
          DEFAULT: "oklch(var(--sage))",
          light: "oklch(var(--sage-light))",
          dark: "oklch(var(--sage-dark))",
        },
        cream: "oklch(var(--cream))",
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
        xl: "1.25rem",
        "2xl": "1.5rem",
        "3xl": "2rem",
      },
      boxShadow: {
        xs: "0 1px 2px 0 rgba(0,0,0,0.05)",
        card: "0 4px 24px 0 oklch(0.22 0 0 / 0.06), 0 1px 4px 0 oklch(0.22 0 0 / 0.04)",
        "card-lg": "0 8px 40px 0 oklch(0.22 0 0 / 0.08), 0 2px 8px 0 oklch(0.22 0 0 / 0.05)",
        sage: "0 4px 20px oklch(0.68 0.06 140 / 0.25)",
        sunlight: "0 8px 24px oklch(0.72 0.04 85 / 0.18), 0 2px 6px oklch(0.72 0.04 85 / 0.10)",
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        "fade-in": {
          from: { opacity: "0", transform: "translateY(8px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "fade-in-scale": {
          from: { opacity: "0", transform: "scale(0.95)" },
          to: { opacity: "1", transform: "scale(1)" },
        },
        "slide-up": {
          from: { opacity: "0", transform: "translateY(20px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        sparkle: {
          "0%, 100%": { transform: "rotate(0deg) scale(1)", opacity: "1" },
          "50%": { transform: "rotate(180deg) scale(1.1)", opacity: "0.8" },
        },
        float: {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%": { transform: "translateY(-6px)" },
        },
        "shimmer-pass": {
          "0%": { left: "-100%" },
          "100%": { left: "200%" },
        },
        "affirmation-zen": {
          from: { opacity: "0", transform: "translateY(14px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "vision-float": {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%": { transform: "translateY(-5px)" },
        },
        "sparkle-pulse": {
          "0%, 100%": { opacity: "1", transform: "scale(1) rotate(0deg)" },
          "25%": { opacity: "0.6", transform: "scale(1.2) rotate(90deg)" },
          "50%": { opacity: "1", transform: "scale(0.8) rotate(180deg)" },
          "75%": { opacity: "0.7", transform: "scale(1.15) rotate(270deg)" },
        },
        "page-enter": {
          from: { opacity: "0", transform: "translateY(16px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "fade-in": "fade-in 0.4s ease-out",
        "fade-in-scale": "fade-in-scale 0.35s ease-out",
        "slide-up": "slide-up 0.5s ease-out",
        sparkle: "sparkle 3s ease-in-out infinite",
        float: "float 3s ease-in-out infinite",
        "shimmer-pass": "shimmer-pass 1s ease-in-out 5s infinite",
        "affirmation-zen": "affirmation-zen 1.4s ease-out forwards",
        "vision-float": "vision-float 3s ease-in-out infinite",
        "sparkle-pulse": "sparkle-pulse 1.8s ease-in-out infinite",
        "page-enter": "page-enter 0.5s cubic-bezier(0.22, 1, 0.36, 1) forwards",
      },
    },
  },
  plugins: [typography, containerQueries, animate],
};
