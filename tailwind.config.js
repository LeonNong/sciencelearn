/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        pixel: ['"Press Start 2P"', 'monospace'],
      },
      colors: {
        primary: {
          50:  '#eff6ff',
          100: '#dbeafe',
          400: '#60a5fa',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
          900: '#1e3a8a',
        },
        science: { bio: '#10b981', chem: '#8b5cf6', phys: '#f59e0b' },
        // Pixel palette
        pixel: {
          bg:     '#0f0f1a',
          panel:  '#1a1a2e',
          border: '#3b82f6',
          shadow: '#1d4ed8',
          green:  '#22c55e',
          red:    '#ef4444',
          yellow: '#eab308',
        }
      },
      boxShadow: {
        pixel:    '4px 4px 0 #1d4ed8',
        'pixel-sm': '3px 3px 0 #1d4ed8',
        'pixel-green': '4px 4px 0 #15803d',
        'pixel-red':   '4px 4px 0 #b91c1c',
      }
    }
  },
  plugins: []
}
