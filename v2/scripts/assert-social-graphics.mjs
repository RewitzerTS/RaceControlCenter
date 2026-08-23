import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const migration = fs.readFileSync(path.join(root, 'supabase/migrations/20260820192159_v2_social_graphics.sql'), 'utf8');
const page = fs.readFileSync(path.join(root, 'src/graphics/GraphicsStudioPage.tsx'), 'utf8');
const renderer = fs.readFileSync(path.join(root, 'src/graphics/renderPng.ts'), 'utf8');

const requirements = [
  [migration.includes('social_graphic_renders'), 'render manifests'],
  [migration.includes("graphic_type in ('race_result', 'podium', 'winner', 'driver_standings', 'team_standings', 'achievement')"), 'six launch templates'],
  [migration.includes("graphic_format in ('square', 'portrait', 'story')"), 'three launch formats'],
  [migration.includes('result_version_id'), 'result version binding'],
  [migration.includes("event_record.event_type in ('result.revised', 'result.voided')"), 'revision invalidation'],
  [migration.includes("perform private.complete_domain_event_processing(p_processing_id, 'graphics'"), 'independent downstream processor'],
  [migration.includes("where flag_key = 'graphics_enabled'"), 'server feature flag'],
  [page.includes('renderGraphicPng') && page.includes('recordGraphicRender'), 'PNG render and manifest flow'],
  [renderer.includes("canvas.toBlob") && renderer.includes("'image/png'"), 'PNG renderer'],
  [renderer.includes('square: { width: 1080, height: 1080 }') && renderer.includes('story: { width: 1080, height: 1920 }'), 'exact dimensions'],
];

const missing = requirements.filter(([ok]) => !ok).map(([, label]) => label);
if (missing.length) throw new Error(`Social Graphics contract missing: ${missing.join(', ')}`);
console.log('Social Graphics contract passed: deterministic PNG templates, version binding, revision status and downstream isolation are present.');
