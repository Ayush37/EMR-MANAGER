/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        aws: {
          squid: '#232F3E',
          smile: '#FF9900',
          blue: '#146EB4',
          lightblue: '#4B9BFF',
        }
      }
    },
  },
  plugins: [],
}