import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
export default defineConfig({
  plugins: [{ name: 'beta-isolated-fixtures', enforce: 'pre', resolveId(id) {
    if (['/league/LeagueProvider', './LeagueProvider', '/roles/RoleProvider', '/i18n/I18nProvider', '/auth/AuthProvider', '/driver/DriverIdentityProvider', './DriverIdentityProvider'].some((suffix) => id.endsWith(suffix))) return fileURLToPath(new URL('./beta-responsive-fixture.ts', import.meta.url));
  } }, react()],
  server: { host: '127.0.0.1', port: 4175, strictPort: true },
});
