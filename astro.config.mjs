import { defineConfig } from 'astro/config';
import vercel from '@astrojs/vercel';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://www.zubnikliniky.cz',
  output: 'static',
  adapter: vercel(),
  trailingSlash: 'never',
  integrations: [sitemap({ filter: (p) => !p.includes('/admin') && !p.includes('/hledat') && !p.includes('/recenze/') })],
});
