/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#0d1b2a",
        steel: "#1b263b",
        fog: "#e0e1dd",
        amber: "#f4a261",
        mint: "#2a9d8f",
        danger: "#c1121f",
      },
      fontFamily: {
        display: ["Sora", "system-ui", "sans-serif"],
        body: ["IBM Plex Sans", "Segoe UI", "sans-serif"],
      },
      boxShadow: {
        soft: "0 20px 45px rgba(13, 27, 42, 0.14)",
      },
      keyframes: {
        rise: {
          "0%": { opacity: 0, transform: "translateY(16px)" },
          "100%": { opacity: 1, transform: "translateY(0)" },
        },
      },
      animation: {
        rise: "rise 500ms ease-out both",
      },
    },
  },
  plugins: [],
};
