import { useI18n } from '../i18n/I18nProvider';
import { simpleStewardMessages } from './simpleStewardMessages';
import type { DriverStewardDecision, SimplePenaltyType, StewardPenalty } from './stewardWorkspace';
import './simpleSteward.css';

export function DriverDecisionList({ outcomes, penalties, drivers, races = [] }: {
  outcomes: DriverStewardDecision[]; penalties: StewardPenalty[];
  drivers: { id: string; display_name: string }[]; races?: { id: string; grand_prix_name: string }[];
}) {
  const { language, formatNumber } = useI18n(), c = simpleStewardMessages[language];
  return <div>{outcomes.map((outcome) => {
    const penalty = penalties.find((p) => p.driver_id === outcome.driver_id);
    const isTime = outcome.penalty_type === 'time_penalty' || outcome.penalty_type === 'time_credit';
    return <section className="steward-driver-outcome" key={outcome.driver_id}>
      <h4>{drivers.find((d) => d.id === outcome.driver_id)?.display_name || '—'}</h4>
      <strong>{c[outcome.penalty_type as SimplePenaltyType] || outcome.penalty_type}
        {outcome.amount != null && ` · ${isTime ? outcome.penalty_type === 'time_credit' ? '−' : '+' : ''}${formatNumber(outcome.amount)} ${isTime ? 's' : c.places}`}</strong>
      <p>{outcome.reasoning}</p>
      {isTime && <small>{penalty?.applied_result_version_id ? c.applied : c.pending}</small>}
      {outcome.target_race_id && <p>{c.target}: {races.find((r) => r.id === outcome.target_race_id)?.grand_prix_name || '—'}<br />{c.gridHint}</p>}
    </section>;
  })}</div>;
}
