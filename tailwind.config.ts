import type { Config } from 'tailwindcss'

// Tailwind CSS v4 primarily configures via CSS and the Vite plugin.
// This minimal config exists to satisfy tooling (e.g. shadcn/ui registry)
// and for future extension if needed.
export default {
  // Intentionally minimal; theme tokens are defined in src/index.css using @theme.
} satisfies Config

