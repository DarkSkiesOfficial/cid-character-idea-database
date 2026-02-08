/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/renderer/src/**/*.{js,ts,jsx,tsx}', './src/renderer/index.html'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        surface: {
          50: '#f8f9fa',
          100: '#f1f3f5',
          200: '#e9ecef',
          300: '#dee2e6',
          400: '#ced4da',
          500: '#adb5bd',
          600: '#868e96',
          700: '#495057',
          800: '#343a40',
          900: '#212529',
          950: '#121416'
        },
        accent: {
          400: '#a78bfa',
          500: '#8b5cf6',
          600: '#7c3aed'
        },
        status: {
          'waiting-bg': 'rgba(234, 179, 8, 0.15)',
          'waiting': '#facc15',
          'waiting-dim': '#fbbf24',
          'active-bg': 'rgba(34, 197, 94, 0.15)',
          'active': '#4ade80',
          'active-dim': '#22c55e'
        }
      },
      fontFamily: {
        display: ['"Playfair Display"', 'Georgia', 'serif']
      }
    }
  },
  plugins: []
}
