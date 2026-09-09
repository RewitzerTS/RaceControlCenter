import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { OwnerControlPage } from '../src/operations/OwnerControlPage';
import { LeagueMembersPage } from '../src/operations/LeagueMembersPage';
import { ProfilePage } from '../src/driver/ProfilePage';
import { LeagueSwitcher } from '../src/league/LeagueSwitcher';
import '../src/styles.css';
import '../src/beta-ux.css';
import '../src/operations/beta-responsive.css';
function Fixture() {
  const [open, setOpen] = useState(false);
  const mode = new URLSearchParams(location.search).get('view');
  return <BrowserRouter><div className="app-shell">
    <header className="site-header"><div className="header-inner container">
      <div className="brand"><span className="brand-text"><strong className="brand-title">Race Control Center</strong></span></div>
      <button className="mobile-toggle" aria-label="Menü öffnen" onClick={() => setOpen(!open)}>Menü</button>
      <nav className={'main-navigation main-nav' + (open ? ' main-navigation--open' : '')}>
        <div className="header-tools"><div className="navigation-league-switcher"><LeagueSwitcher isPlatformOwner userId="qa-user" /></div></div>
      </nav>
    </div></header>
    <div className="shell-frame">{mode === 'profile' ? <ProfilePage /> : mode === 'members' ? <LeagueMembersPage /> : <OwnerControlPage />}</div>
  </div></BrowserRouter>;
}
createRoot(document.getElementById('root')!).render(<Fixture />);

