import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { LeagueMembersPage } from '../src/operations/LeagueMembersPage';
import '../src/styles.css';
import '../src/beta-ux.css';
import '../src/operations/beta-responsive.css';
createRoot(document.getElementById('root')!).render(<BrowserRouter><div className="app-shell"><div className="shell-frame"><LeagueMembersPage /></div></div></BrowserRouter>);
