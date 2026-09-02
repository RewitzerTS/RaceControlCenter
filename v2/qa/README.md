# Local Instagram editor QA

Start `npm run dev` and open `/qa/instagram.html` or `/qa/instagram-responsive.html`.
These are local component harnesses, not production routes or Vite build entries.
They render the editor without account data, using the same component as the protected owner route.
The shipped `/owner/instagram` route and page both require the existing platform-owner gate.

Check text insertion, white/gradient styles, dragging and arrow keys, duplicate/remove/undo,
independent feed/story layouts, overlong content warning, repeated download, share/cancel,
and 430/768/1280px layouts. Native target apps vary by OS; do not treat successful share-dialog opening as a completed Instagram publication.

The preview and export share a single canvas. Selection outlines are HTML overlays and must never appear in the PNG.
Drafts are held in memory for the editing session, not uploaded or persisted. Download before leaving.
