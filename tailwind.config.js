/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: {
          50:  'rgb(var(--primary-50) / <alpha-value>)',
          100: 'rgb(var(--primary-100) / <alpha-value>)',
          200: 'rgb(var(--primary-200) / <alpha-value>)',
          300: 'rgb(var(--primary-300) / <alpha-value>)',
          400: 'rgb(var(--primary-400) / <alpha-value>)',
          500: 'rgb(var(--primary-500) / <alpha-value>)',
          600: 'rgb(var(--primary-600) / <alpha-value>)',
          700: 'rgb(var(--primary-700) / <alpha-value>)',
          800: 'rgb(var(--primary-800) / <alpha-value>)',
        },
        surface: {
          base:   'rgb(var(--bg-base) / <alpha-value>)',
          card:   'rgb(var(--bg-card) / <alpha-value>)',
          subtle: 'rgb(var(--bg-subtle) / <alpha-value>)',
        },
        content: {
          strong: 'rgb(var(--text-strong) / <alpha-value>)',
          body:   'rgb(var(--text-body) / <alpha-value>)',
          muted:  'rgb(var(--text-muted) / <alpha-value>)',
        },
        edge: {
          base: 'rgb(var(--border-base) / <alpha-value>)',
        },
      },
    },
  },
  plugins: [],
};
