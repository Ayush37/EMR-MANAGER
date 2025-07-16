/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'aws-squid': '#232F3E',
        'aws-blue': '#146EB4',
        'aws-smile': '#FF9900',
      }
    },
  },
  plugins: [],
}