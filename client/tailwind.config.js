/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        base: 'var(--color-base)',
        surface: 'var(--color-surface)',
        'surface-alt': 'var(--color-surface-alt)',
        card: 'var(--color-card)',
        subtle: 'var(--color-subtle)',
        'subtle-hover': 'var(--color-subtle-hover)',
        'th-border': 'var(--color-border)',
        'th-border-strong': 'var(--color-border-strong)',
        'tx-primary': 'var(--color-text-primary)',
        'tx-secondary': 'var(--color-text-secondary)',
        'tx-tertiary': 'var(--color-text-tertiary)',
        'tx-muted': 'var(--color-text-muted)',
        'tx-faint': 'var(--color-text-faint)',
        'tx-ghost': 'var(--color-text-ghost)',
        'modal-overlay': 'var(--color-modal-overlay)',
      },
    },
  },
  plugins: [],
}
