import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
export default defineConfig({
  plugins: [{ name: 'roster-isolated-fixtures', enforce: 'pre', resolveId(id) {
    if (id.endsWith('/league/LeagueProvider') || id.endsWith('/i18n/I18nProvider')) return fileURLToPath(new URL('./roster-fixtures.ts', import.meta.url));
  } }, react()],
  server: { host: '127.0.0.1', port: 4173 },
});
