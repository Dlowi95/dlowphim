import { heroui } from "@heroui/react";
import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./node_modules/@heroui/theme/dist/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        bungee: ["var(--font-bungee)", "sans-serif"],
        cinzel: ["var(--font-cinzel)", "serif"],
        creepster: ["var(--font-creepster)", "cursive"],
        marker: ["var(--font-marker)", "cursive"],
        pacifico: ["var(--font-pacifico)", "cursive"],
      }
    },
  },
  darkMode: "class",
  plugins: [heroui() as any],
};

export default config;