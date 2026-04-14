alter table if exists public.league_content
  add column if not exists faq_items jsonb not null default '[]'::jsonb;

update public.league_content
set faq_items = jsonb_build_array(
  jsonb_build_object(
    'id', 'faq-registration',
    'question', 'Wie melde ich mich für ein Rennen an oder ab?',
    'answer', 'Bitte die Anmeldung erfolgt über eine Umfrage auf Whatsapp. Eine Abmeldung sollte spätestens fünf Minuten vor Rennbeginn ebenfalls über Whatsapp erfolgen, damit das Rennen pünktlich starten kann.'
  ),
  jsonb_build_object(
    'id', 'faq-short-notice',
    'question', 'Was passiert, wenn ich kurzfristig nicht teilnehmen kann?',
    'answer', 'Das ist nicht schlimm, dein Ersatzfahrer wird sich für dich ins Cockpit setzen. Die Punkte werden in der Ergebnisübersicht dann entsprechend markiert.'
  ),
  jsonb_build_object(
    'id', 'faq-results-update',
    'question', 'Wann werden Rennergebnisse und Tabellen aktualisiert?',
    'answer', 'Sobald die Stewards alle Vorfälle abschließend besprochen und mögliche Konsequenzen verhängt haben.'
  ),
  jsonb_build_object(
    'id', 'faq-incident-submission',
    'question', 'Wo reiche ich einen Vorfall ein und welche Infos brauche ich dafür?',
    'answer', 'Vorfälle reichst du als Videoclip direkt über die Whatsapp Gruppe mit dem Vermerk „bewerten“ ein.'
  ),
  jsonb_build_object(
    'id', 'faq-decisions',
    'question', 'Wo werden Entscheidungen der Rennleitung veröffentlicht?',
    'answer', 'Die Entscheidungen findest du über den Kalender, indem du das entsprechende Rennen öffnest.'
  )
)
where id = 'default'
  and (
    faq_items is null
    or jsonb_typeof(faq_items) <> 'array'
    or jsonb_array_length(faq_items) = 0
  );
