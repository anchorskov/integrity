// astro.config.mjs
import { defineConfig } from 'astro/config';

// Pure static output — API lives in the separate Hono Worker under worker/.
// Add @astrojs/cloudflare only if a page ever needs real SSR.
export default defineConfig({
  site: 'https://thefourthbranch.net',
  output: 'static',
  vite: {
    server: {
      proxy: {
        // Run `cd worker && npx wrangler dev` in a second terminal to back this.
        '/api': {
          target: 'http://localhost:8787',
          changeOrigin: true,
        },
      },
    },
  },
});
