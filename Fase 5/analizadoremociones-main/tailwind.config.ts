import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
    extend: {
      colors: {
        // Base palette
        base:     '#0a0a0f',
        surface:  '#12121a',
        card:     '#1a1a2e',
        elevated: '#22223a',

        // Emotion colours
        'em-alegria':     '#FBBF24',
        'em-confianza':   '#34D399',
        'em-miedo':       '#A78BFA',
        'em-expectacion': '#38BDF8',
        'em-tristeza':    '#60A5FA',
        'em-rechazo':     '#F87171',
        'em-incierto':    '#A1A1AA',

        // Accent
        'accent-cyan':   '#06b6d4',
        'accent-purple': '#8b5cf6',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
      borderColor: {
        subtle:  'rgba(255,255,255,0.06)',
        default: 'rgba(255,255,255,0.10)',
        strong:  'rgba(255,255,255,0.16)',
      },
      backgroundImage: {
        'accent-gradient': 'linear-gradient(135deg, #06b6d4, #8b5cf6)',
      },
      animation: {
        'fade-in': 'fadeIn 0.5s ease-out',
        'slide-up': 'slideUp 0.5s ease-out',
      },
      keyframes: {
        fadeIn: {
          '0%':   { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%':   { opacity: '0', transform: 'translateY(12px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: [],
};
export default config;
