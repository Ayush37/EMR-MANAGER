/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      animation: {
        'spin-slow': 'spin 3s linear infinite',
      },
      colors: {
        'aws-orange': '#FF9900',
        'aws-squid-ink': '#232F3E',
        'aws-blue': '#146EB4',
      }
    },
  },
  plugins: [],
}