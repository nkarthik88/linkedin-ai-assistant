/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./index.html", "./privacy.html", "./terms.html"],
  theme: {
    extend: {
      colors: {
        linkedin: "#0A66C2",
        "linkedin-dark": "#004182",
        "linkedin-light": "#E8F4FC",
      },
      fontFamily: {
        sans: ["-apple-system", "BlinkMacSystemFont", "Segoe UI", "Roboto", "Helvetica Neue", "Arial", "sans-serif"],
      },
      keyframes: {
        fadeUp: {
          "0%": { opacity: "0", transform: "translateY(16px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        fadeUp: "fadeUp 0.5s ease forwards",
      },
    },
  },
};
