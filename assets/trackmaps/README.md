# RaceVora vector circuit maps

25 coordinate-based SVG circuit diagrams, shared by Home, the calendar, track
profiles and legacy Racing views. The old PNGs remain as recoverable references;
neither track catalog points to them anymore. Madrid now has its own outline,
not Barcelona's former placeholder.

Geometry: [Tomislav Bacinger, f1-circuits](https://github.com/bacinger/f1-circuits),
MIT license (see LICENSE.txt), pinned revision
`394d8fbe70ef2c0b0c8d23ff7bee61fa09606055`.
The matching 25 GeoJSON features are retained in source/circuits.geojson.

Regenerate offline with `node v2/scripts/generate-trackmaps.mjs` from the repository
root. `--fetch` refreshes only from that exact pinned revision, never floating HEAD.

Every source vertex is preserved. Longitude is corrected for latitude in a local
geographic projection, then each circuit is rotated and uniformly scaled to a
tight frame. No invented splines, stretched axes, AI approximations or sector
boundaries are used. Orientation can differ from the old TV-style diagram.
The standalone SVG gradient is default RaceVora branding, not sector information.
Native Home, calendar (including its dialog), track cards and profiles use the
SVG's alpha as a CSS mask with the live personal `--brand-accent` and
`--brand-primary` colors. WebKit masking is included for Safari. Theme changes
repaint immediately without reloading or altering the circuit geometry.
These are unofficial schematic outlines, not certified surveying data.

The source reflects current Albert Park, Barcelona, Singapore and Yas Marina
layouts; visual review compares all 24 existing raster references plus Madrid.
At thumbnail widths the line grows optically without changing its centerline.
