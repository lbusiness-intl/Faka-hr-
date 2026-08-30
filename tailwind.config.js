/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Neutral surfaces — clean, near-white/gray, minimal saturation
        // (Factorial-style: whitespace-led, not color-led)
        sage: {
          50: '#FAFAFB',
          100: '#F4F4F6',
          200: '#E7E7EC',
          300: '#D3D3DA',
          400: '#A3A3AF',
          500: '#75757F',
          600: '#54545F',
          700: '#40404A',
          800: '#2A2A33',
          900: '#1C1C23',
          950: '#121217',
        },
        // Primary brand accent — warm coral-red, used sparingly
        // against a mostly neutral canvas (Factorial-style restraint)
        coral: {
          50: '#FDF1F1',
          100: '#FBE1E2',
          200: '#F7C4C8',
          300: '#F19AA1',
          400: '#EA6874',
          500: '#E23A50', // primary CTA red
          600: '#C82644',
          700: '#A61C3B',
          800: '#821736',
          900: '#5E1230',
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
        sans: ['Plus Jakarta Sans', 'system-ui', 'sans-serif'],
        display: ['Plus Jakarta Sans', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        glow: '0 2px 8px -2px rgba(226,58,80,0.18)',
        card: '0 1px 2px rgba(16,24,40,0.04), 0 1px 3px rgba(16,24,40,0.05)',
        'card-dark': '0 1px 2px rgba(0,0,0,0.25), 0 4px 16px -8px rgba(0,0,0,0.4)',
        popover: '0 4px 6px -2px rgba(16,24,40,0.05), 0 12px 16px -4px rgba(16,24,40,0.08)',
      },
      keyframes: {
        'fade-in': { '0%': { opacity: '0', transform: 'translateY(8px)' }, '100%': { opacity: '1', transform: 'translateY(0)' } },
        'scale-in': { '0%': { opacity: '0', transform: 'scale(0.96)' }, '100%': { opacity: '1', transform: 'scale(1)' } },
        float: { '0%,100%': { transform: 'translateY(0)' }, '50%': { transform: 'translateY(-10px)' } },
        shimmer: { '0%': { backgroundPosition: '-1000px 0' }, '100%': { backgroundPosition: '1000px 0' } },
        'slide-up': { '0%': { opacity: '0', transform: 'translateY(40px)' }, '100%': { opacity: '1', transform: 'translateY(0)' } },
        'slide-left': { '0%': { opacity: '0', transform: 'translateX(40px)' }, '100%': { opacity: '1', transform: 'translateX(0)' } },
        'slide-right': { '0%': { opacity: '0', transform: 'translateX(-40px)' }, '100%': { opacity: '1', transform: 'translateX(0)' } },
        'pulse-glow': { '0%,100%': { boxShadow: '0 0 20px rgba(226,58,80,0.2)' }, '50%': { boxShadow: '0 0 40px rgba(226,58,80,0.4)' } },
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
