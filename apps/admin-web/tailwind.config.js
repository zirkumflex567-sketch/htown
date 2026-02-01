/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        display: ['"Space Grotesk"', 'system-ui', 'sans-serif'],
        body: ['"Inter"', 'system-ui', 'sans-serif']
      },
      colors: {
        slate: {
          950: '#0b0f14'
        },
        panel: {
          900: '#121821',
          800: '#18212c',
          700: '#243041'
        },
        accent: {
          500: '#33d6a6',
          600: '#2ab48a'
        },
        warning: {
          500: '#f0b429'
        },
        danger: {
          500: '#f97066'
        }
      }
    }
  },
  plugins: []
};
