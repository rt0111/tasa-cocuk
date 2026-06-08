/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        night: { bg: "#0b1026", card: "#141b3c", accent: "#6366f1" },
        day: { bg: "#fdf6e3", card: "#fffdf7", accent: "#d97706" },
      },
      keyframes: {
        pop: { "0%": { transform: "scale(.9)", opacity: 0 }, "100%": { transform: "scale(1)", opacity: 1 } },
      },
      animation: { pop: "pop .25s ease-out" },
    },
  },
  plugins: [],
};
