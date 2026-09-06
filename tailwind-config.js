// Tailwind CSS Configuration
tailwind.config = {
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        vault: {
          950: '#06090e',
          900: '#0a0f18',
          850: '#0f172a',
          800: '#141e33',
          750: '#1c2842',
          700: '#233252',
          cyan: '#06b6d4',
          cyanGlow: '#22d3ee',
          electric: '#3b82f6',
          emerald: '#10b981',
          warning: '#f59e0b',
          danger: '#ef4444'
        }
      },
      fontFamily: {
        heading: ['Outfit', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
        sans: ['Inter', 'sans-serif']
      },
      animation: {
        'pulse-slow': 'pulse 4s cubic-bezier(0.4, 0, 0.6, 1) infinite'
      }
    }
  }
};
