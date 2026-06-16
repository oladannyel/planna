import type { Config } from "tailwindcss";

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
        // Backgrounds (dark-first) — spec §11
        canvas: "#0F0F13",
        card: "#17171F",
        border: "#1E1E2E",
        // Text
        "text-primary": "#F8FAFC",
        "text-secondary": "#94A3B8",
        "text-muted": "#475569",
        // Accents
        purple: "#7C3AED",
        teal: "#0D9488",
        amber: "#D97706",
        danger: "#DC2626",
      },
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
      },
      borderRadius: {
        xl: "0.75rem",
      },
    },
  },
  plugins: [],
};
export default config;
