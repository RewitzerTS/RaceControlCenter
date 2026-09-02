# RaceVora Instagram assets

- `feed-v1.png` and `story-v1.png`: original, unchanged user-supplied RaceVora templates (RV_Insta_Feed.png and RV_Insta_Story.png).
- Source dimensions: 1122 × 1402 and 941 × 1672. The renderer maps the complete background into 1080 × 1350 / 1080 × 1920 exports without cropping.
- SHA-256 feed: `37559b958c2537057d9fae92f5dbf43726d511f2e604d21ac6c3e97c5771e25c`
- SHA-256 story: `c8b1c6eb63bf81a77c194bd91575a73e0500b159adeed3186f86d3540598b4b4`
- `InterVariable.woff2`: unmodified Inter font from https://github.com/rsms/inter/blob/master/docs/font-files/InterVariable.woff2. License: SIL OFL, included in `Inter-OFL.txt`. Loaded locally only by the Instagram editor to keep canvas measurements consistent across devices.
- White lettering uses Inter weight 900. Gradient lettering uses the RaceVora landing-page spectrum, independent of league branding.

Use versioned background filenames if templates are changed: `/assets/*` is served with immutable caching.
