import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const migration = fs.readFileSync(path.join(root, 'supabase/migrations/20260820192437_v2_social_graphics.sql'), 'utf8');
const landscapeMigration = fs.readFileSync(path.join(root, 'supabase/migrations/20260830093000_add_landscape_social_graphics.sql'), 'utf8');
const page = fs.readFileSync(path.join(root, 'src/graphics/GraphicsStudioPage.tsx'), 'utf8');
const graphics = fs.readFileSync(path.join(root, 'src/graphics/graphics.ts'), 'utf8');
const renderer = fs.readFileSync(path.join(root, 'src/graphics/renderPng.ts'), 'utf8');
const portraitTemplate = fs.readFileSync(path.join(root, 'src/graphics/templates/race-result-portrait.svg'), 'utf8');

const requirements = [
  [migration.includes('social_graphic_renders'), 'render manifests'],
  [migration.includes("graphic_type in ('race_result', 'podium', 'winner', 'driver_standings', 'team_standings', 'achievement')"), 'six launch templates'],
  [migration.includes("graphic_format in ('square', 'portrait', 'story', 'landscape')"), 'four launch formats'],
  [landscapeMigration.includes("graphic_format in ('square', 'portrait', 'story', 'landscape')"), 'existing database landscape upgrade'],
  [migration.includes('result_version_id'), 'result version binding'],
  [migration.includes("event_record.event_type in ('result.revised', 'result.voided')"), 'revision invalidation'],
  [migration.includes("perform private.complete_domain_event_processing(p_processing_id, 'graphics'"), 'independent downstream processor'],
  [migration.includes("where flag_key = 'graphics_enabled'"), 'server feature flag'],
  [page.includes('renderGraphicPng') && page.includes('recordGraphicRender') && !page.includes("t('graphics.copy')"), 'compact PNG render and manifest flow'],
  [page.includes('graphicPages.map') && page.includes('graphics-page-navigation'), 'multi-page preview and export flow'],
  [page.includes('graphics-race-picker') && page.includes('selectedResultVersionId') && graphics.includes('loadGraphicsResultOptions') && graphics.includes('loadGraphicsResult') && graphics.includes("eq('status', 'active')"), 'official race selection for result-bound graphics'],
  [page.includes('graphicBranding') && page.includes('branding: graphicBranding'), 'league-specific graphic header binding'],
  [graphics.includes("['square', 'portrait', 'story', 'landscape']"), 'landscape format selection'],
  [graphics.includes('paginateGraphicModel') && !graphics.includes("slice(0, 8)"), 'complete balanced race-result pagination'],
  [renderer.includes("canvas.toBlob") && renderer.includes("'image/png'"), 'PNG renderer'],
  [renderer.includes('readGraphicTheme') && renderer.includes('resolveRaceResultPortraitTemplate'), 'personal-theme SVG renderer'],
  [renderer.includes('drawLeagueIdentity') && renderer.includes('drawRaceVoraFooter') && renderer.includes('RACE TO RESULT') && renderer.includes('@RACE.VORA'), 'league header and fixed RaceVora footer'],
  [portraitTemplate.includes('data-rv-template="race-result-portrait"') && portraitTemplate.includes('id="slot-table"') && portraitTemplate.includes('data-max-rows="11"'), 'editable 4:5 race-result pilot template'],
  [renderer.includes('square: { width: 1080, height: 1080 }') && renderer.includes('story: { width: 1080, height: 1920 }') && renderer.includes('landscape: { width: 1920, height: 1080 }'), 'exact dimensions'],
];

const missing = requirements.filter(([ok]) => !ok).map(([, label]) => label);
if (missing.length) throw new Error(`Social Graphics contract missing: ${missing.join(', ')}`);
console.log('Social Graphics contract passed: deterministic PNG templates, version binding, revision status and downstream isolation are present.');
