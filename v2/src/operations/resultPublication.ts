export type PublishedResultReceipt = {
  id: string;
  race_id: string;
  status: 'active';
};

function normalizedLeagueSlug(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9-]/g, '');
}

function removeMatchingStorageKeys(storage: Storage | undefined, matches: (key: string) => boolean) {
  if (!storage) return;
  const keys: string[] = [];
  for (let index = 0; index < storage.length; index += 1) {
    const key = storage.key(index);
    if (key && matches(key)) keys.push(key);
  }
  keys.forEach((key) => storage.removeItem(key));
}

export function invalidatePublishedResultCaches(leagueSlug: string) {
  if (typeof window === 'undefined') return;
  const slug = normalizedLeagueSlug(leagueSlug);
  if (!slug) return;

  removeMatchingStorageKeys(window.localStorage, (key) => (
    key.match(/^rcc_query_cache_v\d+:([^:]+):/)?.[1] === slug
  ));
  removeMatchingStorageKeys(window.sessionStorage, (key) => (
    key.match(/^rcc\.standings\.view\.v\d+:([^:]+):/)?.[1] === slug
  ));

  window.dispatchEvent(new CustomEvent('racevora:result-published', {
    detail: { leagueSlug: slug },
  }));
}
