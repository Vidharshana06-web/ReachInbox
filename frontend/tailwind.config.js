/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#f5f7ff',
          100: '#ebf0ff',
          500: '#4f46e5', // Primary indigo
          600: '#4338ca',
          700: '#3730a3',
        },
        slate: {
          900: '#0f172a',
          950: '#020617',
        }
      },
    },
  },
  plugins: [],
}
