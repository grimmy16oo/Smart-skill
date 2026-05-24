/** @type {import('tailwindcss').Config} */
import daisyui from "daisyui";

export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],

  theme: {
    extend: {

      // ─────────────────────────────
      // FONTS
      // ─────────────────────────────
      fontFamily: {
        display: ['"Playfair Display"', "serif"],
        body: ['"DM Sans"', "sans-serif"],
      },

      // ─────────────────────────────
      // COLORS
      // ─────────────────────────────
      colors: {
        primaryGlow: "#8b6fff",
        secondaryGlow: "#ff8b8b",
      },

      // ─────────────────────────────
      // SHADOWS
      // ─────────────────────────────
      boxShadow: {
        glow: "0 0 40px rgba(124, 92, 255, 0.35)",
        glowLg: "0 0 70px rgba(124, 92, 255, 0.45)",
        soft: "0 10px 30px rgba(0,0,0,0.08)",
        card: "0 8px 30px rgba(0,0,0,0.12)",
      },

      // ─────────────────────────────
      // BACKDROP BLUR
      // ─────────────────────────────
      backdropBlur: {
        xs: "2px",
      },

      // ─────────────────────────────
      // ANIMATIONS
      // ─────────────────────────────
      animation: {
        float: "float 6s ease-in-out infinite",
        pulseSlow: "pulseSlow 4s ease-in-out infinite",
        gradient: "gradientMove 10s ease infinite",
        cardEnter: "cardEnter 0.45s ease-out",
        fadeUp: "fadeUp 0.6s ease forwards",
      },

      // ─────────────────────────────
      // KEYFRAMES
      // ─────────────────────────────
      keyframes: {

        float: {
          "0%, 100%": {
            transform: "translateY(0px)",
          },
          "50%": {
            transform: "translateY(-10px)",
          },
        },

        pulseSlow: {
          "0%, 100%": {
            opacity: "0.6",
            transform: "scale(1)",
          },
          "50%": {
            opacity: "1",
            transform: "scale(1.05)",
          },
        },

        gradientMove: {
          "0%, 100%": {
            backgroundPosition: "0% 50%",
          },
          "50%": {
            backgroundPosition: "100% 50%",
          },
        },

        cardEnter: {
          "0%": {
            transform: "scale(0.95) translateY(10px)",
            opacity: "0",
          },
          "100%": {
            transform: "scale(1) translateY(0)",
            opacity: "1",
          },
        },

        fadeUp: {
          "0%": {
            opacity: "0",
            transform: "translateY(20px)",
          },
          "100%": {
            opacity: "1",
            transform: "translateY(0px)",
          },
        },
      },

      // ─────────────────────────────
      // BACKGROUND SIZE
      // ─────────────────────────────
      backgroundSize: {
        "200": "200% 200%",
      },
    },
  },

  plugins: [daisyui],

  daisyui: {
    themes: [

      // ─────────────────────────────
      // LIGHT THEME
      // ─────────────────────────────
      {
        skilllight: {

          primary: "#6c47ff",
          "primary-content": "#ffffff",

          secondary: "#ff6b6b",
          "secondary-content": "#ffffff",

          accent: "#ffd93d",
          "accent-content": "#1a1a2e",

          neutral: "#1a1a2e",
          "neutral-content": "#ffffff",

          "base-100": "#fafafa",
          "base-200": "#f4f4f8",
          "base-300": "#e8e8f0",

          "base-content": "#1a1a2e",

          info: "#3abff8",
          success: "#36d399",
          warning: "#fbbd23",
          error: "#f87272",
        },
      },

      // ─────────────────────────────
      // DARK THEME
      // ─────────────────────────────
      {
        skilldark: {

          primary: "#7c5cff",
          "primary-content": "#ffffff",

          secondary: "#ff6b6b",
          "secondary-content": "#ffffff",

          accent: "#ffd93d",
          "accent-content": "#1a1a2e",

          neutral: "#0f0f1a",
          "neutral-content": "#ffffff",

          "base-100": "#13131f",
          "base-200": "#1a1a2e",
          "base-300": "#22223a",

          "base-content": "#e8e8f0",

          info: "#3abff8",
          success: "#36d399",
          warning: "#fbbd23",
          error: "#f87272",
        },
      },
    ],

    defaultTheme: "skilldark",
  },
};
