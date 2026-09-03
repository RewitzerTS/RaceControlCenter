import { createRoot } from 'react-dom/client';
import { RosterWorkflowPanel } from '../src/operations/RosterWorkflowPanel';
import type { DriverAdminWorkspace } from '../src/operations/operations';
import '../src/styles.css';

const drivers = {
  drivers: [
    { id: 'human', display_name: 'Stammfahrer mit langem Anzeigenamen', ai_driver_reference: 'Lance Stroll', league_team: 'Team Kiesbett Connection', car_name: 'Aston Martin AMR25' },
    { id: 'sub', display_name: 'Ersatzfahrer Beispiel', ai_driver_reference: null, league_team: '', car_name: '' },
  ], ai_drivers: [{ id: 'ai', display_name: 'Charles Leclerc', league_team: 'Ferrari', car_name: 'Ferrari SF-25' }],
} as DriverAdminWorkspace;
const frame = new URLSearchParams(location.search).has('frame');
createRoot(document.getElementById('root')!).render(frame
  ? <main className="operations-page admin-management-page" style={{ padding: 12 }}><RosterWorkflowPanel drivers={drivers} onSaved={async () => {}} /></main>
  : <main style={{ padding: 16 }}><h1>Responsive QA — ausschließlich Testdaten</h1><div style={{ display: 'flex', gap: 24 }}>{[375, 430].map((width) => <section key={width}><h2>{width}px</h2><iframe title={`${width}px`} width={width} height={1100} src="/qa/roster-responsive.html?frame=1" style={{ border: '1px solid #555' }} /></section>)}</div></main>);
