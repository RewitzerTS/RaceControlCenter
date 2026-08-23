# Phase 29 — Verified RCC import evidence

Status: complete on 2026-08-21. Production traffic remains on V1 while V2 is tested.

## Authorization and isolation

- The user explicitly authorized copying the real `rcc` production data from the V1 Supabase project into the separate V2 Supabase project.
- The source project was read only. No V1 schema, row, Auth setting, Storage object, Worker route or domain was changed.
- The target was the dedicated V2 project. The import failed closed if `rcc` already existed or if any expected count differed.
- The previously existing `demo` tenant remains separate from `rcc`.

## Imported scope

| Record type | Verified rows |
| --- | ---: |
| League | 1 |
| Season | 1 |
| Races | 24 |
| Drivers | 20 |
| Race results | 451 |
| Active V2 result versions | 24 |
| Immutable V2 result-version rows | 451 |

The common V1/V2 fields for league, season, races, drivers and race results were serialized deterministically and compared with source/target MD5 checksums. All five comparisons matched. V2-only lifecycle fields were excluded from the cross-version comparison.

## Recovery evidence

- Fresh encrypted off-site backup run: GitHub Actions run `32516982864`.
- Encrypted R2 object: `daily/2026/08/21/racevora-backup-20260821T191052Z.tar.gz.gpg`.
- V1 recovery branch: `recovery/v1-production-2026-08-21` at `2da639e9b4907e226c1a2c9858320e4b73bebee0`.
- Local V1 recovery ZIP SHA-256: `5076DE7CCCD483685481F5680E1E65D892A10A0D26280E68E9A707E34E1A7132`.

## Remaining cutover gates

The data import does not itself authorize V1 retirement. Before changing `racevora.com`, the separate V2 production Worker must pass Auth, `rcc`, legal-route, rollback, Core Web Vitals and functional smoke checks. V1 stays active and deployable throughout the observation window.
