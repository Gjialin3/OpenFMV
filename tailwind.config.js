/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ['class'],
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        openfmv: {
          accent: 'rgb(var(--accent-primary-rgb) / <alpha-value>)',
          'accent-hover': 'rgb(var(--accent-hover-rgb) / <alpha-value>)',
          'accent-dim': 'rgb(var(--accent-dim-rgb) / <alpha-value>)',
          canvas: 'rgb(var(--bg-canvas-rgb) / <alpha-value>)',
          sidebar: 'rgb(var(--bg-sidebar-rgb) / <alpha-value>)',
          node: 'rgb(var(--bg-node-rgb) / <alpha-value>)',
          'node-header': 'rgb(var(--bg-node-header-rgb) / <alpha-value>)',
          border: 'rgb(var(--border-node-rgb) / <alpha-value>)',
          divider: 'rgb(var(--border-divider-rgb) / <alpha-value>)',
          text: 'rgb(var(--text-main-rgb) / <alpha-value>)',
          sub: 'rgb(var(--text-sub-rgb) / <alpha-value>)',
          muted: 'rgb(var(--text-muted-rgb) / <alpha-value>)',
        }
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
        'openfmv-tool': 'var(--radius-openfmv-tool)',
        'openfmv-control': 'var(--radius-openfmv-control)',
        'openfmv-card': 'var(--radius-openfmv-card)',
        'openfmv-panel': 'var(--radius-openfmv-panel)',
        'openfmv-pill': 'var(--radius-openfmv-pill)',
      },
      height: {
        'openfmv-tool': 'var(--density-openfmv-tool)',
        'openfmv-editor': 'var(--density-openfmv-editor)',
        'openfmv-control': 'var(--density-openfmv-control)',
        'openfmv-action': 'var(--density-openfmv-action)',
      },
      minHeight: {
        'openfmv-tool': 'var(--density-openfmv-tool)',
        'openfmv-editor': 'var(--density-openfmv-editor)',
        'openfmv-control': 'var(--density-openfmv-control)',
        'openfmv-action': 'var(--density-openfmv-action)',
      },
      width: {
        'openfmv-tool': 'var(--density-openfmv-tool)',
        'openfmv-editor': 'var(--density-openfmv-editor)',
        'openfmv-control': 'var(--density-openfmv-control)',
        'openfmv-action': 'var(--density-openfmv-action)',
      },
      spacing: {
        'openfmv-tool': 'var(--space-openfmv-tool)',
        'openfmv-compact': 'var(--space-openfmv-compact)',
        'openfmv-control': 'var(--space-openfmv-control)',
        'openfmv-workspace': 'var(--space-openfmv-workspace)',
      }
    },
  },
  plugins: [require('tailwindcss-animate')],
}
