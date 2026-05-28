/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,jsx}',
    './components/**/*.{js,jsx}',
  ],
  theme: {
    extend: {
      colors: {
        'bg-primary': '#0a0a0f',
        'bg-secondary': '#111118',
        'bg-tertiary': '#1a1a24',
        'border': '#2a2a35',
        'text-primary': '#e8e6e0',
        'text-secondary': '#8a8899',
        'text-muted': '#555566',
        'accent': '#d4a843',
        'positive': '#52c47a',
        'negative': '#e05252',
        'neutral': '#8a8899',
      },
      fontFamily: {
        mono: ['"IBM Plex Mono"', 'monospace'],
        serif: ['"Playfair Display"', 'serif'],
        sans: ['"DM Sans"', 'sans-serif'],
      },
      borderRadius: {
        DEFAULT: '4px',
        sm: '2px',
        md: '4px',
        lg: '4px',
      },
    },
  },
  plugins: [],
};
