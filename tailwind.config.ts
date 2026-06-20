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

        brand: "#4f46e5", // indigo primary
        branddeep: "#4338ca", // indigo deep (numbers, links)
        brandsoft: "#eef0ff", // indigo wash
        brandsoft2: "#f6f5ff", // indigo wash 2
        brandborder: "#dcdcfa", // indigo soft border
        indigotext: "#312e81", // indigo-950 text

        night: "#161615", // dark hero / sidebar bg
        night2: "#1f1f1e",
        night3: "#232321",
        coal: "#2a2a28",
        coal2: "#4b4b48",
        coalline: "#34332f",

        muted: "#57534e",
        muted2: "#78716c",
        faint: "#a8a29e",
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
      },
    },
  },
  plugins: [],
};

export default config;
