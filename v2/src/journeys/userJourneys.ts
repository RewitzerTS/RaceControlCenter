import type { AppRole } from '../roles/roleMapping';

export type JourneyId = 'signed-out' | 'driver' | 'steward' | 'league-admin' | 'platform-owner';
export type UserJourney = {
  id: JourneyId;
  role: AppRole | null;
  entry: string;
  checkpoints: readonly string[];
  completion: string;
  invariant: string;
};

export const USER_JOURNEYS: readonly UserJourney[] = [
  {
    id: 'signed-out', role: null, entry: '/',
    checkpoints: ['safe signed-out state', 'language selection', 'no privileged navigation'],
    completion: 'A visitor sees a useful sign-in state without private data.',
    invariant: 'No authenticated or tenant-private payload is rendered.',
  },
  {
    id: 'driver', role: 'driver', entry: '/',
    checkpoints: ['/racing', '/career', '/vora', '/profile', '/notifications'],
    completion: 'A linked driver can understand the latest result, progression and next action.',
    invariant: 'Career values come only from the authenticated global Driver Identity.',
  },
  {
    id: 'steward', role: 'steward', entry: '/stewarding',
    checkpoints: ['case', 'evidence', 'vote', 'decision', 'result revision'],
    completion: 'A Steward decision publishes a new immutable official result version.',
    invariant: 'Evidence and decisions remain tenant-bound and append-only.',
  },
  {
    id: 'league-admin', role: 'league_admin', entry: '/admin',
    checkpoints: ['league snapshot', 'audit trail', '/admin/graphics'],
    completion: 'League operations and a deterministic graphic use the current official result.',
    invariant: 'Administration never escapes the requested league.',
  },
  {
    id: 'platform-owner', role: 'platform_owner', entry: '/owner',
    checkpoints: ['global control', '/owner/demo', '/stewarding', '/admin/graphics'],
    completion: 'The owner verifies the complete isolated Demo championship journey.',
    invariant: 'Demo progression never contributes to global Driver progression.',
  },
] as const;

export function journeyForRole(role: AppRole | null): UserJourney {
  const journey = USER_JOURNEYS.find((candidate) => candidate.role === role);
  if (!journey) throw new Error(`No user journey declared for role ${role ?? 'signed-out'}.`);
  return journey;
}
