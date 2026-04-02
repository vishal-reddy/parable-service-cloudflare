/** @type {import('tailwindcss').Config} */
export default {
  content: ["./src/**/*.{ts,tsx}"],
  darkMode: "selector",
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Titillium Web"', "sans-serif"],
      },
    },
  },
  plugins: [],
};
