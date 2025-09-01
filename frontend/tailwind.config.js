/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        ndi: {
          blue: '#0070f3',
          green: '#00d084',
          red: '#ff0000',
        }
      }
    },
  },
  plugins: [],
}