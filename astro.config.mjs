// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import responsivePhotos from './scripts/responsive-photos.mjs';

export default defineConfig({
  site: 'https://cghoperations.com',
  trailingSlash: 'ignore',
  integrations: [sitemap({ filter: (page) => !page.includes('/thank-you') && !page.includes('/admin') && !page.includes('/app') }), responsivePhotos()],
  build: { inlineStylesheets: 'auto' },
});
