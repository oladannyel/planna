import type { Config } from "tailwindcss";

/**
 * Design tokens.
 *
 * Semantic colours (canvas, card, border, text-*, and the accent hues) resolve
 * through CSS custom properties declared in `globals.css`, so the same utility
 * class renders correctly in both themes. The variables hold raw RGB channels
 * rather than hex, which is what keeps Tailwind's opacity modifiers working —
 * `bg-purple/15` and `bg-card/50` both depend on it.
 *
 * The gray ramp, elevation scale and type scale are adapted from TailAdmin
 * (MIT, © 2023 TailAdmin) — see THIRD_PARTY_NOTICES.md.
 */
const semantic = (variable: string) => `rgb(var(${variable}) / <alpha-value>)`;

const config: Config = {
  darkMode: "class",
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/features/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // ─── Semantic surfaces and text (theme-aware) ───────────────────────
        canvas: semantic("--color-canvas"),
        card: semantic("--color-card"),
        border: semantic("--color-border"),
        "card-hover": semantic("--color-card-hover"),
        "text-primary": semantic("--color-text-primary"),
        "text-secondary": semantic("--color-text-secondary"),
        "text-muted": semantic("--color-text-muted"),

        // ─── Accents (theme-aware for contrast) ────────────────────────────
        purple: semantic("--color-purple"),
        teal: semantic("--color-teal"),
        amber: semantic("--color-amber"),
        danger: semantic("--color-danger"),

        // ─── Brand ramp — plAnna violet, brand-600 is the original #7C3AED ──
        brand: {
          25: "#FBFAFF",
          50: "#F5F3FF",
          100: "#EDE9FE",
          200: "#DDD6FE",
          300: "#C4B5FD",
          400: "#A78BFA",
          500: "#8B5CF6",
          600: "#7C3AED",
          700: "#6D28D9",
          800: "#5B21B6",
          900: "#4C1D95",
          950: "#2E1065",
        },

        // ─── Neutral ramp (TailAdmin / Untitled UI) ─────────────────────────
        gray: {
          25: "#FCFCFD",
          50: "#F9FAFB",
          100: "#F2F4F7",
          200: "#EAECF0",
          300: "#D0D5DD",
          400: "#98A2B3",
          500: "#667085",
          600: "#475467",
          700: "#344054",
          800: "#1D2939",
          900: "#101828",
          950: "#0C111D",
        },

        // ─── Status ramps ───────────────────────────────────────────────────
        success: {
          25: "#F6FEF9",
          50: "#ECFDF3",
          100: "#D1FADF",
          200: "#A6F4C5",
          300: "#6CE9A6",
          400: "#32D583",
          500: "#12B76A",
          600: "#039855",
          700: "#027A48",
          800: "#05603A",
          900: "#054F31",
        },
        warning: {
          25: "#FFFCF5",
          50: "#FFFAEB",
          100: "#FEF0C7",
          200: "#FEDF89",
          300: "#FEC84B",
          400: "#FDB022",
          500: "#F79009",
          600: "#DC6803",
          700: "#B54708",
          800: "#93370D",
          900: "#7A2E0E",
        },
        error: {
          25: "#FFFBFA",
          50: "#FEF3F2",
          100: "#FEE4E2",
          200: "#FECDCA",
          300: "#FDA29B",
          400: "#F97066",
          500: "#F04438",
          600: "#D92D20",
          700: "#B42318",
          800: "#912018",
          900: "#7A271A",
        },
      },

      /**
       * Two faces, deliberately.
       *
       * `font-sans` (Inter) is the default for body and dense UI: it is drawn
       * for small sizes, which is what task cards, tables and dates need.
       * `font-display` (Outfit) carries TailAdmin's character in headings and
       * large figures, where its geometry reads well.
       *
       * Every var() carries an inline fallback. A bare `var(--x)` naming an
       * undefined property invalidates the whole declaration at computed-value
       * time — font-family then falls back to the browser default serif rather
       * than to the next item in the list.
       */
      fontFamily: {
        sans: ["var(--font-inter, system-ui)", "system-ui", "sans-serif"],
        display: ["var(--font-outfit, var(--font-inter, system-ui))", "system-ui", "sans-serif"],
      },

      // ─── Type scale (TailAdmin) ───────────────────────────────────────────
      fontSize: {
        "title-sm": ["18px", { lineHeight: "28px" }],
        "title-md": ["20px", { lineHeight: "30px" }],
        "title-lg": ["24px", { lineHeight: "32px" }],
        "heading-six": ["24px", { lineHeight: "32px" }],
        "heading-five": ["32px", { lineHeight: "40px" }],
        "heading-four": ["40px", { lineHeight: "48px" }],
        "heading-three": ["48px", { lineHeight: "60px" }],
      },

      // ─── Elevation (TailAdmin) ────────────────────────────────────────────
      boxShadow: {
        "theme-xs": "0px 1px 2px 0px rgba(16, 24, 40, 0.05)",
        "theme-sm":
          "0px 1px 3px 0px rgba(16, 24, 40, 0.10), 0px 1px 2px 0px rgba(16, 24, 40, 0.06)",
        "theme-md":
          "0px 4px 8px -2px rgba(16, 24, 40, 0.10), 0px 2px 4px -2px rgba(16, 24, 40, 0.06)",
        "theme-lg":
          "0px 12px 16px -4px rgba(16, 24, 40, 0.08), 0px 4px 6px -2px rgba(16, 24, 40, 0.03)",
        "theme-xl":
          "0px 20px 24px -4px rgba(16, 24, 40, 0.08), 0px 8px 8px -4px rgba(16, 24, 40, 0.03)",
        "focus-ring": "0px 0px 0px 4px rgba(124, 58, 237, 0.12)",
      },

      borderRadius: {
        xl: "0.75rem",
        "2xl": "1rem",
      },

      screens: {
        "2xsm": "375px",
        xsm: "425px",
        "3xl": "2000px",
      },

      zIndex: {
        1: "1",
        9: "9",
        99: "99",
        999: "999",
        9999: "9999",
      },
    },
  },
  plugins: [],
};

export default config;
