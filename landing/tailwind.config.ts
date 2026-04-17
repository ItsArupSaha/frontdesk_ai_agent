import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      boxShadow: {
        glow: "0 0 20px rgba(124,58,237,0.22)",
        orb: "0 0 90px rgba(124,58,237,0.30), 0 0 180px rgba(124,58,237,0.16)",
      },
      transitionTimingFunction: {
        premium: "cubic-bezier(0.22, 1, 0.36, 1)",
      },
      backgroundImage: {
        "purple-gradient": "linear-gradient(135deg, #7C3AED 0%, #8B5CF6 100%)",
      },
    },
  },
  plugins: [],
} satisfies Config;
