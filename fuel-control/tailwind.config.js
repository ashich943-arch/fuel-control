/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        obsidian: "#F3F4F6",
        panel: "#FFFFFF",
        panelLight: "#FAFAFB",
        hairline: "#EAEAEF",
        gold: "#E5484D",
        goldLight: "#FF6B6B",
        goldDim: "#B4363B",
        emerald: "#1F8A5F",
        emeraldLight: "#22C55E",
        warn: "#D97706",
        warnLight: "#F5A623",
        ivory: "#1A1D1F",
        muted: "#6B7280",
        mutedDim: "#9CA3AF",
      },
      fontFamily: {
        display: ["'Inter'", "sans-serif"],
        sans: ["'Inter'", "sans-serif"],
        mono: ["'JetBrains Mono'", "monospace"],
      },
      boxShadow: {
        goldglow: "0 8px 20px -6px rgba(229,72,77,0.35)",
        panel: "0 1px 2px rgba(16,24,40,0.04), 0 8px 24px -12px rgba(16,24,40,0.08)",
      },
      backgroundImage: {
        vignette: "none",
      },
    },
  },
  plugins: [],
};
