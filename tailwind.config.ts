import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#f5f9f7",
          100: "#d8ebe0",
          200: "#b6d8c4",
          300: "#8ec3a3",
          400: "#5fa57b",
          500: "#3f885f",
          600: "#2f6f4d",
          700: "#25583e",
          800: "#1f4733",
          900: "#19392a"
        },
        ink: "#101828",
        sand: "#f7f3ec"
      },
      boxShadow: {
        panel: "0 20px 45px -24px rgba(16, 24, 40, 0.24)"
      },
      backgroundImage: {
        "hero-grid":
          "radial-gradient(circle at top left, rgba(63, 136, 95, 0.14), transparent 32%), linear-gradient(180deg, rgba(255,255,255,0.92), rgba(247,243,236,0.95))"
      }
    }
  },
  plugins: []
};

export default config;
