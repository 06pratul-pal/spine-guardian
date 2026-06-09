/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        base: '#0a0a0f',
        surface: '#111118',
        card: '#1a1a24',
        'card-hover': '#1e1e2e',
        accent: '#7c3aed',
        'accent-light': '#a78bfa',
        'accent-dim': 'rgba(124, 58, 237, 0.15)',
        border: '#2a2a3a',
        'text-primary': '#e4e4f0',
        'text-secondary': '#8b8ba0',
        'text-muted': '#4a4a5a',
      },
    },
  },
  plugins: [],
};
