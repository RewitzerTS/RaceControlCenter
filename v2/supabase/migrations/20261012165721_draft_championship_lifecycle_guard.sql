-- Historical/discarded drafts must not be offered as current grid guidance.
begin;
do $$ declare body text; changed text; begin
  body:=pg_get_functiondef('public.get_result_draft_championship_preview(uuid)'::regprocedure);
  changed:=replace(body,
    'if source.status not in (''draft'',''validated'') or source.previous_version_id is distinct from race.current_result_version_id then',
    'if source.status<>''validated'' or source.previous_version_id is distinct from race.current_result_version_id
      or exists(select 1 from private.result_draft_discards where result_version_id=source.id)
      or exists(select 1 from private.steward_publication_receipts where source_version_id=source.id) then');
  if changed=body then raise exception 'Preview lifecycle guard source mismatch'; end if;
  execute changed;
end $$;
commit;
