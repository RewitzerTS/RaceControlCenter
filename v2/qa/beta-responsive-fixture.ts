import { messages } from '../src/i18n/messages';
import { client as membersClient } from './member-link-fixture';
export type { MessageKey } from '../src/i18n/messages';
const leagues = Array.from({ length: 12 }, (_, i) => ({ id: 'qa-' + i, slug: i ? 'qa-liga-' + i : 'qa-only', name: i ? 'RaceVora Testliga mit langem Namen ' + i : 'Race Control Center', status: 'active' }));
export const client = {
  from: () => {
    const query: any = { select: () => query, eq: () => query, in: () => query, order: async () => ({ data: leagues, error: null }) };
    return query;
  },
  rpc: async (name: string, args: any) => {
    if (name === 'get_my_league_join_requests') return { data: [], error: null };
    if (name === 'get_owner_control_snapshot') return { data: { counts: { leagues: 12, global_drivers: 20, pending_jobs: 0, failed_jobs: 0 }, leagues, flags: [] }, error: null };
    return membersClient.rpc(name, args);
  },
};
export function useLeague() { return { client, leagueSlug: 'qa-only', setLeagueSlug: () => {}, branding: { name: 'Race Control Center' } }; }
export function useRole() { return { role: 'platform_owner' }; }
const user = { id: 'qa-user', email: 'qa@example.invalid', user_metadata: { display_name: 'QA Fahrer', theme_preset: 0 } };
export function useAuth() { return { loading: false, user, updateThemePreset: async () => {}, updateCustomTheme: async () => {}, updateDisplayName: async () => {} }; }
export function useDriverIdentity() { return { loading: false, identity: { id: 'qa-identity', public_id: 12345, status: 'active' } }; }
export function useI18n() {
  const t = (key: string, values: Record<string,string|number> = {}) => ((messages.de as Record<string,string>)[key] || key).replace(/\{(\w+)\}/g, (match, field) => String(values[field] ?? match));
  return { language: 'de', t, plural: (key: string, count: number) => t(key + (count === 1 ? '.one' : '.other'), { count }), formatNumber: String, formatDate: String, formatTime: String };
}
