import type { Config } from "tailwindcss";

// Color tokens map 1:1 to the Demoless design export palette.
// Components should use these named tokens for color and Tailwind
// arbitrary values (e.g. text-[54px]) for one-off sizes/shadows.
const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#1c1c1a", // primary text / near-black
        ink2: "#44403c", // form label text
        paper: "#fafaf9", // app background

        brand: "#3138cc", // indigo primary — pulled bluer, used sparingly (DESIGN.md)
        branddeep: "#262aa6", // indigo deep (numbers, links)
        brandsoft: "#eaecfb", // indigo wash
        brandsoft2: "#f4f5fc", // indigo wash 2
        brandborder: "#d2d4f2", // indigo soft border
        indigotext: "#232a78", // deep indigo text

        night: "#161615", // dark hero / sidebar bg
        night2: "#1f1f1e",
        night3: "#232321",
        coal: "#2a2a28",
        coal2: "#4b4b48",
        coalline: "#34332f",

        // ── Instrument layer — COMMITTED LIGHT system (cobalt) ──────────────
        // Light tiered base (Stripe-style) + cobalt accent. Names kept from the
        // earlier dark build; values are now the user-approved light palette.
        // (Dashboard-only tokens — the landing still uses paper/ink/brand above.)
        obsidian: "#F6F7F9", // canvas — app ground (tinted off-white, not pure white)
        slate: "#FFFFFF", // panel — raised card
        slate2: "#EDF0F4", // sunk — nested fill / row hover / rails
        slate3: "#F1F4F7", // field — input / control fill
        edge: "#E3E7EC", // hairline border
        edge2: "#ECEFF3", // subtler divider
        // Text ramp on light (cool near-black, never pure #000)
        chalk: "#0E1116", // primary text — ink
        ash: "#525B68", // secondary text
        ember: "#657080", // tertiary / mono labels, AA on light surfaces
        // Cobalt accent
        brandlit: "#3A41D6", // accent — actions, active, AI presence, one series
        brandlit2: "#2A2FA8", // accent-deep — hover / links on light
        accentsoft: "#E7E8FB", // accent tint — selected row, featured-card wash, chips
        accentink: "#1B1D66", // deep accent text on tint
        goodlit: "#16A34A", // qualified / positive
        goodsofter: "#E6F4EA", // good tint (badge bg)
        warnlit: "#C2710C", // objection / caution
        warnsofter: "#FBF1E3", // warn tint (glyph bg)
        dangerlit: "#DC2626", // needs-a-human
        livelit: "#16A34A", // active / streaming / speaking-now

        muted: "#57534e",
        muted2: "#78716c",
        faint: "#6B7280",
        faint2: "#8a8782",
        dim: "#6b6b66",

        line: "#e7e5e4",
        line2: "#ece9e6",
        line3: "#e3e0dc",
        hair: "#f0efed",

        wash: "#faf9f8",
        wash2: "#f5f5f4",
        wash3: "#f6f5f3",
        wash4: "#fcfbfa",
        chip: "#f3f2f0",

        good: "#15803d",
        goodsoft: "#e7f6ec",
        warn: "#b45309",
        warnsoft: "#fcf3e6",
        danger: "#dc2626",
        live: "#22c55e",

        barlo: "#ece9fe",
        barmid: "#ddd9fb",
        barhi: "#c9c3f7",

        stone300: "#d6d3d1",
        stone350: "#cfcdc8",
        nav: "#94a3b8",
      },
      fontFamily: {
        sans: ["var(--font-hanken)", "system-ui", "sans-serif"],
        mono: ["var(--font-jetbrains)", "monospace"],
        serif: ["var(--font-serif)", "Georgia", "serif"],
      },
    },
  },
  plugins: [],
};

export default config;
