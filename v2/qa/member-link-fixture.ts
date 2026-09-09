const members = [
  { user_id: 'qa-one', email: 'fahrer.mit.langem.namen@example.test', identity_status: 'active', role: 'driver', driver_id: null, driver_name: null },
  { user_id: 'qa-two', email: 'zweiter.fahrer@example.test', identity_status: 'active', role: 'driver', driver_id: 'existing', driver_name: 'Bereits verknüpfter Fahrer' },
];
const drivers = [{ id: 'qa-driver', display_name: 'RCC Fahrer mit langem Anzeigenamen', gamertag: 'Racer_One', number: 27, is_active: true }];
export const client = { rpc: async (name: string, args: { p_user_id: string; p_driver_id: string }) => {
  if (name === 'get_league_member_admin_workspace') return { data: { league: { slug: 'qa-only' }, members, join_requests: [] }, error: null };
  if (name === 'get_linkable_league_drivers') return { data: new URLSearchParams(location.search).has('empty') ? [] : drivers, error: null };
  if (name === 'link_league_member_driver') {
    if (new URLSearchParams(location.search).has('conflict')) return { data: null, error: { message: 'MEMBER_DRIVER_TAKEN' } };
    if (args.p_user_id !== 'qa-one' || args.p_driver_id !== 'qa-driver') throw new Error('Unexpected QA mapping');
    Object.assign(members[0], { driver_id: drivers[0].id, driver_name: drivers[0].display_name });
    return { data: { driver_id: drivers[0].id }, error: null };
  }
  throw new Error(`Unsupported QA operation: ${name}`);
} };
export function useLeague() { return { client, leagueSlug: 'qa-only' }; }
export function useRole() { return { role: 'league_admin' }; }
export function useI18n() { return { language: 'de', t: (key: string) => ({ driverRole: 'Fahrer', stewardRole: 'Steward', leagueAdminRole: 'Ligaleitung' })[key] || key, formatDate: String, formatTime: String }; }
