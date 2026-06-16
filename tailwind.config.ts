import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        background: "#0f0f0f",
        surface: "#181818",
        accent: "#1db954",
        muted: "#b3b3b3",
        border: "#282828"
      },
      boxShadow: {
        player: "0 -10px 30px rgba(0, 0, 0, 0.35)"
      }
    }
  },
  plugins: [require("tailwindcss-animate")]
};

export default config;
