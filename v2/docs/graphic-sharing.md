# Sharing generated graphics

Driver graphics (`/profile/graphics`) and league graphics (`/admin/graphics`) use the shared `GraphicShareActions` component. The owner Instagram editor already provides native single-image sharing and remains unchanged.

- PNG files are prepared before the share button becomes enabled. `navigator.share({files})` runs directly within the click handler to preserve transient user activation.
- A single-page graphic offers Share. Multi-page graphics offer Share this image, Share all images, and Download this image; the existing complete ZIP download remains available.
- `navigator.canShare` checks the actual files individually and together. Devices supporting only one image can share each page separately. Unsupported browsers retain downloads and an explanatory message.
- Cancellation is quiet. Other sharing failures allow retry/download without initiating a download automatically. A successful promise means handoff to the operating system, not publication in a destination app.
- Preparation is invalidated by selection, format, language, branding, data and theme changes; late results from obsolete preparations are discarded.
- Sharing adds no uploads, database writes, authentication scopes or social platform integrations. Existing download/audit behavior is unchanged.

Validation: TypeScript check, Staging build, 16 focused unit tests (including existing Instagram behavior), desktop/mobile browser tests with real PNG rendering and simulated Web Share API. Browser tests cover selected-page filenames, PNG type/size, click activation, multi-file capability, driver access, format changes and download fallback. Actual Instagram/WhatsApp destination behavior must be checked on an installed target app; browser automation does not publish content.

References: https://developer.mozilla.org/en-US/docs/Web/API/Navigator/share and https://developer.mozilla.org/en-US/docs/Web/API/Navigator/canShare

Production publication was approved on 2026-10-28. This change requires no database migration. Release evidence records the deployed commit and final verification separately.
