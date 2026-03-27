import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        cream: {
          50: "#FDFBF7",
          100: "#F5F0E8",
          200: "#EDE8DD",
          300: "#E5DFD1",
          400: "#D6CEBC",
          500: "#C4BBAA",
          600: "#A09882",
          700: "#6B5B3E",
          800: "#4A3F2F",
          900: "#2C2518",
        },
        gold: {
          50: "#FDF8F0",
          100: "#FAEEDA",
          200: "#F5DDB5",
          300: "#E8C48A",
          400: "#C4A060",
          500: "#A0825C",
          600: "#8A6D48",
          700: "#6B5234",
          800: "#4D3A24",
          900: "#2F2316",
        },
        priority: {
          urgent: "#E24B4A",
          high: "#D85A30",
          medium: "#BA7517",
          low: "#1D9E75",
        },
        tag: {
          work: "#E24B4A",
          personal: "#1D9E75",
          project: "#7F77DD",
          meeting: "#BA7517",
        },
        status: {
          planned: "#EEEDFE",
          "planned-text": "#534AB7",
          active: "#E6F1FB",
          "active-text": "#185FA5",
          done: "#E1F5EE",
          "done-text": "#0F6E56",
        },
      },
      fontFamily: {
        serif: ["Cormorant Garamond", "Georgia", "serif"],
        sans: ["DM Sans", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "monospace"],
      },
      borderRadius: {
        DEFAULT: "8px",
        lg: "12px",
        xl: "16px",
      },
      boxShadow: {
        card: "0 1px 3px rgba(107, 91, 62, 0.08)",
        "card-hover": "0 4px 12px rgba(107, 91, 62, 0.12)",
        sidebar: "1px 0 0 0 #D6CEBC",
      },
      animation: {
        "fade-in": "fadeIn 0.2s ease-out",
        "slide-up": "slideUp 0.3s ease-out",
        "slide-right": "slideRight 0.2s ease-out",
      },
      keyframes: {
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        slideUp: {
          "0%": { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        slideRight: {
          "0%": { opacity: "0", transform: "translateX(-8px)" },
          "100%": { opacity: "1", transform: "translateX(0)" },
        },
      },
    },
  },
  plugins: [],
};

export default config;
