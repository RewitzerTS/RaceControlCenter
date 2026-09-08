import { useEffect, useState } from 'react';
import { useLeague } from '../league/LeagueProvider';
import { useI18n } from '../i18n/I18nProvider';
import type { LeagueSupabaseClient } from '../lib/supabase';
import { profileMessages } from './profileMessages';
import { historyMessages } from './historyMessages';
import './racing.css';
import './profiles.css';
import './history.css';

export const ruleKeys = ['ai_strength', 'race_distance', 'vehicle_performance', 'fastest_lap_point', 'damage', 'safety_car', 'red_flag', 'ghosting', 'assists', 'qualifying'] as const;
const defaultFaqs = [
  { question: 'Wie melde ich mich für ein Rennen an oder ab?', answer: 'Bitte die Anmeldung erfolgt über eine Umfrage auf Whatsapp. Eine Abmeldung sollte spätestens fünf Minuten vor Rennbeginn ebenfalls über Whatsapp erfolgen, damit das Rennen pünktlich starten kann.' },
  { question: 'Was passiert, wenn ich kurzfristig nicht teilnehmen kann?', answer: 'Das ist nicht schlimm, dein Ersatzfahrer wird sich für dich ins Cockpit setzen. Die Punkte werden in der Ergebnisübersicht dann entsprechend markiert.' },
  { question: 'Wann werden Rennergebnisse und Tabellen aktualisiert?', answer: 'Sobald die Stewards alle Vorfälle abschließend besprochen und mögliche Konsequenzen verhängt haben.' },
  { question: 'Wo reiche ich einen Vorfall ein und welche Infos brauche ich dafür?', answer: 'Vorfälle reichst du als Videoclip direkt über die Whatsapp Gruppe mit dem Vermerk „bewerten“ ein.' },
  { question: 'Wo werden Entscheidungen der Rennleitung veröffentlicht?', answer: 'Die Entscheidungen findest du über den Kalender, indem du das entsprechende Rennen öffnest.' },
];
export function normalizeRules(value: unknown) {
  const object = (input: unknown): Record<string, unknown> => input && typeof input === 'object' && !Array.isArray(input) ? input as Record<string, unknown> : {};
  const settings = object(value), rules = object(settings.rules);
  const faqs = Array.isArray(settings.faqs) && settings.faqs.length ? settings.faqs : defaultFaqs;
  return { rules: Object.fromEntries(ruleKeys.map((key) => [key, ['string', 'number', 'boolean'].includes(typeof rules[key]) ? String(rules[key]).trim() : ''])), faqs: faqs.map((faq) => object(faq)).map((faq) => ({ question: typeof faq.question === 'string' ? faq.question.trim() : '', answer: typeof faq.answer === 'string' ? faq.answer.trim() : '' })).filter((faq) => faq.question && faq.answer) };
}
export async function loadRules(client: LeagueSupabaseClient, slug: string, signal: AbortSignal) {
  const response = await client.from('leagues').select('settings').eq('slug', slug).abortSignal(signal).single();
  signal.throwIfAborted(); if (response.error) throw response.error;
  return normalizeRules(response.data.settings);
}
export function RacingRules() {
  const { client, leagueSlug } = useLeague(), { language } = useI18n(), c = profileMessages[language], h = historyMessages[language];
  const [data, setData] = useState<ReturnType<typeof normalizeRules> | null>(null), [error, setError] = useState(false), [retry, setRetry] = useState(0);
  useEffect(() => { const abort = new AbortController(); setData(null); setError(false); void loadRules(client, leagueSlug, abort.signal).then((value) => { if (!abort.signal.aborted) setData(value); }).catch(() => { if (!abort.signal.aborted) setError(true); }); return () => abort.abort(); }, [client, leagueSlug, retry]);
  return <section className="native-racing native-profile" data-native-racing="rules" aria-labelledby="rules-title"><h1 id="rules-title">{h.rules}</h1>{error ? <div role="alert"><p>{h.rulesError}</p><button onClick={() => setRetry((n) => n + 1)} type="button">{c.retry}</button></div> : !data ? <p role="status">{c.loading}</p> : <div className="profile-columns"><section className="profile-section"><h2>{h.ruleHeading}</h2><dl className="history-facts">{[...ruleKeys].sort((a, b) => h[a].localeCompare(h[b], language)).map((key) => <div key={key}><dt>{h[key]}</dt><dd>{data.rules[key] || h.unspecified}</dd></div>)}</dl></section><section className="profile-section history-faq"><h2>{h.faq}</h2>{data.faqs.length ? data.faqs.map((faq, index) => <details key={index}><summary>{faq.question}</summary><p>{faq.answer}</p></details>) : <p>{h.emptyFaq}</p>}</section></div>}</section>;
}
