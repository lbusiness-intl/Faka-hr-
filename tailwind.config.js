/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Light theme surfaces
        sage: {
          50: '#F2F7F3',
          100: '#E8F1E9',
          200: '#D6E6D8',
          300: '#B8D6BC',
          400: '#8FBF96',
          500: '#6BA374',
          600: '#4F8758',
          700: '#3D6B45',
          800: '#2D4D33',
          900: '#1E3322',
          950: '#0F1F12',
        },
        coral: {
          50: '#EAF3FF',
          100: '#D2E7FF',
          200: '#A6CEFF',
          300: '#70AFFF',
          400: '#3D8DFF',
          500: '#0070E0',
          600: '#0058B3',
          700: '#004389',
          800: '#003087',
          900: '#00215E',
        },
        // Ink (dark theme surfaces)
        ink: {
          900: '#0a0f14',
          800: '#0f1620',
          700: '#161e2a',
          600: '#1e2735',
          500: '#2a3445',
        },
        emerald: {
          400: '#34d399',
          500: '#10b981',
          600: '#059669',
        },
        teal: {
          300: '#5EEAD4',
          400: '#2DD4BF',
          500: '#14b8a6',
          600: '#0d9488',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        display: ['Inter', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        glow: '0 0 40px -10px rgba(0,112,224,0.45)',
        card: '0 1px 3px rgba(16,24,40,0.04), 0 8px 24px -12px rgba(16,24,40,0.10)',
        'card-dark': '0 1px 3px rgba(0,0,0,0.3), 0 12px 32px -12px rgba(0,0,0,0.5)',
      },
      keyframes: {
        'fade-in': { '0%': { opacity: '0', transform: 'translateY(8px)' }, '100%': { opacity: '1', transform: 'translateY(0)' } },
        'scale-in': { '0%': { opacity: '0', transform: 'scale(0.96)' }, '100%': { opacity: '1', transform: 'scale(1)' } },
        float: { '0%,100%': { transform: 'translateY(0)' }, '50%': { transform: 'translateY(-10px)' } },
        shimmer: { '0%': { backgroundPosition: '-1000px 0' }, '100%': { backgroundPosition: '1000px 0' } },
        'slide-up': { '0%': { opacity: '0', transform: 'translateY(40px)' }, '100%': { opacity: '1', transform: 'translateY(0)' } },
        'slide-left': { '0%': { opacity: '0', transform: 'translateX(40px)' }, '100%': { opacity: '1', transform: 'translateX(0)' } },
        'slide-right': { '0%': { opacity: '0', transform: 'translateX(-40px)' }, '100%': { opacity: '1', transform: 'translateX(0)' } },
        'pulse-glow': { '0%,100%': { boxShadow: '0 0 20px rgba(0,112,224,0.2)' }, '50%': { boxShadow: '0 0 40px rgba(0,112,224,0.4)' } },
        'bar-grow': { '0%': { transform: 'scaleY(0)' }, '100%': { transform: 'scaleY(1)' } },
        'count-up': { '0%': { opacity: '0' }, '100%': { opacity: '1' } },
      },
      animation: {
        'fade-in': 'fade-in 0.5s ease-out',
        'scale-in': 'scale-in 0.3s ease-out',
        float: 'float 6s ease-in-out infinite',
        shimmer: 'shimmer 2.5s linear infinite',
        'slide-up': 'slide-up 0.6s ease-out forwards',
        'slide-left': 'slide-left 0.6s ease-out forwards',
        'slide-right': 'slide-right 0.6s ease-out forwards',
        'pulse-glow': 'pulse-glow 3s ease-in-out infinite',
        'bar-grow': 'bar-grow 0.8s ease-out forwards',
      },
    },
  },
  plugins: [],
};
