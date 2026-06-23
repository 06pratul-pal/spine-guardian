/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        base: '#040d1a',
        surface: '#071628',
        card: '#0a1e34',
        'card-hover': '#0d2440',
        accent: '#0ea5e9',
        'accent-light': '#38bdf8',
        'accent-dim': 'rgba(14, 165, 233, 0.15)',
        border: '#0f2d4a',
        'text-primary': '#e2eaf5',
        'text-secondary': '#7aa0c0',
        'text-muted': '#3a5570',
      },
    },
  },
  plugins: [],
};
