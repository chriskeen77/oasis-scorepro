/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        terminal: {
          bg: '#080d18',
          card: '#0d1526',
          cardHover: '#111f35',
          border: '#1a2d47',
          borderActive: '#2563eb',
        },
        bull: '#10b981',
        bear: '#ef4444',
        neutral: '#f59e0b',
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'Fira Code', 'Consolas', 'monospace'],
      },
    },
  },
  plugins: [],
}
