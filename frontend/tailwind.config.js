/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        go: "#22c55e",
        pivot: "#eab308",
        kill: "#ef4444",
      },
      animation: {
        "pulse-slow": "pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "fade-in": "fadeIn 0.5s ease-out",
        "slide-up": "slideUp 0.4s ease-out",
        "verdict-reveal": "verdictReveal 0.8s cubic-bezier(0.16, 1, 0.3, 1)",
        "score-count": "scoreCount 1.2s cubic-bezier(0.16, 1, 0.3, 1)",
        "verdict-glow": "verdictGlow 2s ease-in-out infinite",
      },
      keyframes: {
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        slideUp: {
          "0%": { opacity: "0", transform: "translateY(20px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        verdictReveal: {
          "0%": { opacity: "0", transform: "scale(0.3)" },
          "50%": { opacity: "1", transform: "scale(1.1)" },
          "100%": { opacity: "1", transform: "scale(1)" },
        },
        scoreCount: {
          "0%": { opacity: "0", transform: "translateY(30px) scale(0.5)" },
          "100%": { opacity: "1", transform: "translateY(0) scale(1)" },
        },
        verdictGlow: {
          "0%, 100%": { boxShadow: "0 0 20px var(--verdict-glow-color, rgba(239,68,68,0.3))" },
          "50%": { boxShadow: "0 0 40px var(--verdict-glow-color, rgba(239,68,68,0.5))" },
        },
      },
    },
  },
  plugins: [],
};
