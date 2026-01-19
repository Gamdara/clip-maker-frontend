/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: 'hsl(220, 20%, 6%)',
        foreground: 'hsl(0, 0%, 98%)',
        card: 'hsl(220, 18%, 10%)',
        'card-foreground': 'hsl(0, 0%, 98%)',
        primary: 'hsl(16, 90%, 60%)',
        'primary-foreground': 'hsl(0, 0%, 100%)',
        secondary: 'hsl(220, 15%, 15%)',
        'secondary-foreground': 'hsl(0, 0%, 98%)',
        muted: 'hsl(220, 15%, 18%)',
        'muted-foreground': 'hsl(220, 10%, 55%)',
        border: 'hsl(220, 15%, 18%)',
        input: 'hsl(220, 15%, 15%)',
        ring: 'hsl(16, 90%, 60%)',
        destructive: 'hsl(0, 84%, 60%)',
        coral: {
          400: 'hsl(16, 90%, 60%)',
          500: 'hsl(16, 90%, 50%)',
        },
        amber: {
          400: 'hsl(35, 95%, 55%)',
          500: 'hsl(35, 95%, 50%)',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        lg: '0.75rem',
        xl: '1rem',
        '2xl': '1.5rem',
      },
      boxShadow: {
        glow: '0 0 60px -12px hsl(16, 90%, 60%, 0.4)',
        card: '0 4px 24px -4px hsl(0, 0%, 0%, 0.5)',
        elevated: '0 20px 40px -8px hsl(0, 0%, 0%, 0.6)',
      },
      backgroundImage: {
        'gradient-primary': 'linear-gradient(135deg, hsl(16, 90%, 60%) 0%, hsl(35, 95%, 55%) 100%)',
        'gradient-glow': 'linear-gradient(135deg, hsl(16, 90%, 60%, 0.3) 0%, hsl(35, 95%, 55%, 0.1) 100%)',
        'gradient-surface': 'linear-gradient(180deg, hsl(220, 18%, 12%) 0%, hsl(220, 20%, 8%) 100%)',
      },
      keyframes: {
        fadeIn: {
          from: { opacity: '0', transform: 'translateY(10px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        scaleIn: {
          from: { opacity: '0', transform: 'scale(0.95)' },
          to: { opacity: '1', transform: 'scale(1)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-10px)' },
        },
        spinSlow: {
          from: { transform: 'rotate(0deg)' },
          to: { transform: 'rotate(360deg)' },
        },
      },
      animation: {
        fadeIn: 'fadeIn 0.5s ease-out',
        scaleIn: 'scaleIn 0.3s ease-out',
        float: 'float 6s ease-in-out infinite',
        spinSlow: 'spinSlow 8s linear infinite',
      },
    },
  },
  plugins: [],
}
