-- Restore the migrated RCC rules and FAQ content in the V2 league settings.
-- Public pages read this native V2 source; admins already update it through update_league_rules().

update public.leagues
set settings = jsonb_set(
  jsonb_set(
    settings,
    '{rules}',
    '{"damage":"standard","assists":"Alle erlaubt","ghosting":"an","red_flag":"erhöht","qualifying":"keins","safety_car":"erhöht","ai_strength":"85","race_distance":"50%","fastest_lap_point":"ja","vehicle_performance":"Reale Leistung"}'::jsonb,
    true
  ),
  '{faqs}',
  '[{"id":"faq-registration","answer":"Bitte die Anmeldung erfolgt über eine Umfrage auf Whatsapp. Eine Abmeldung sollte spätestens fünf Minuten vor Rennbeginn ebenfalls über Whatsapp erfolgen, damit das Rennen pünktlich starten kann.","question":"Wie melde ich mich für ein Rennen an oder ab?"},{"id":"faq-short-notice","answer":"Das ist nicht schlimm, dein Ersatzfahrer wird sich für dich ins Cockpit setzen. Die Punkte werden in der Ergebnisübersicht dann entsprechend markiert.","question":"Was passiert, wenn ich kurzfristig nicht teilnehmen kann?"},{"id":"faq-results-update","answer":"Sobald die Stewards alle Vorfälle abschließend besprochen und mögliche Konsequenzen verhängt haben.","question":"Wann werden Rennergebnisse und Tabellen aktualisiert?"},{"id":"faq-incident-submission","answer":"Vorfälle reichst du als Videoclip direkt über die Whatsapp Gruppe mit dem Vermerk „bewerten“ ein.","question":"Wo reiche ich einen Vorfall ein und welche Infos brauche ich dafür?"},{"id":"faq-decisions","answer":"Die Entscheidungen findest du über den Kalender, indem du das entsprechende Rennen öffnest.","question":"Wo werden Entscheidungen der Rennleitung veröffentlicht?"}]'::jsonb,
  true
)
where slug = 'rcc';
