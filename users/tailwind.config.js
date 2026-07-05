/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          primary: '#5c2028',
          'primary-dark': '#42171d',
          accent: '#f2b134',
        },
        text: {
          heading: '#1e2537',
          body: '#5b6478',
          placeholder: '#9ca3af',
        },
        border: {
          input: '#d8dce3',
        },
        page: '#f3f4f7',
      },
    },
  },
  plugins: [],
}
