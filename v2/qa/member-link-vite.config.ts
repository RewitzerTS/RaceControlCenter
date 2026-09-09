import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
export default defineConfig({
  plugins: [{ name: 'member-link-isolated-fixtures', enforce: 'pre', resolveId(id) {
    if (['/league/LeagueProvider', '/roles/RoleProvider', '/i18n/I18nProvider'].some((suffix) => id.endsWith(suffix))) return fileURLToPath(new URL('./member-link-fixture.ts', import.meta.url));
  } }, react()],
  server: { host: '127.0.0.1', port: 4174, strictPort: true },
});
