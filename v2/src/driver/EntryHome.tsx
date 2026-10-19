import { NavLink } from 'react-router-dom';
import { useI18n } from '../i18n/I18nProvider';
import { useDriverIdentity } from './DriverIdentityProvider';
import { entryCopy } from './entryCopy';
import { LeagueJoinRequestStatusList } from './LeagueJoinRequestStatusList';
import './entry.css';

export function EntryHome({ member }: { member: boolean }) {
  const { language } = useI18n();
  const { identity } = useDriverIdentity();
  const c = entryCopy[language];
  return <main className="entry-page" id="main-content">
    <header className="entry-heading"><h1>{member ? c.linking : c.starter}</h1><p>{member ? c.linkingHint : c.starterHint}</p></header>
    {identity?.racevoraId && <div className="entry-identity"><span>{c.id}</span><strong>{identity.racevoraId}</strong><small>{c.idHint}</small></div>}
    <div className="entry-actions"><NavLink className="primary-action" to={member ? '/profile' : '/onboarding'}>{member ? c.profileLink : c.setup}</NavLink>{!member && <NavLink className="text-action" to="/leagues/new">{c.create}</NavLink>}</div>
    <section><h2>{c.requests}</h2><LeagueJoinRequestStatusList /></section>
  </main>;
}
