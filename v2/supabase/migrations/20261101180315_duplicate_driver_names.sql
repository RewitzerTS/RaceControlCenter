-- A name is not an identity. Keep IDs, gamertag uniqueness, links and all results.
alter table public.drivers drop constraint drivers_league_display_name_unique;
create index drivers_league_display_name_idx on public.drivers(league_id,display_name);

-- Older import clients can submit a name without an ID. Never choose arbitrarily
-- when that name now belongs to multiple drivers; an explicit ID always wins.
do $patch$
declare body text; needle text; replacement text;
begin
  body:=pg_get_functiondef('public.create_league_result_draft(uuid,jsonb,text)'::regprocedure);
  needle:=$old$    select d.*
    into target_driver
    from public.drivers d
    where d.league_id = target_league_id
      and (
        d.id::text = nullif(row_item->>'driver_id', '')
        or (nullif(row_item->>'driver_id', '') is null
          and nullif(btrim(row_item->>'driver_name'), '') is not null
          and (lower(d.display_name) = lower(btrim(row_item->>'driver_name'))
            or lower(d.gamertag) = lower(btrim(row_item->>'driver_name'))))
      )
    limit 1;$old$;
  replacement:=$new$    begin
      select d.* into strict target_driver
      from public.drivers d
      where d.league_id = target_league_id
        and (
          d.id::text = nullif(row_item->>'driver_id', '')
          or (nullif(row_item->>'driver_id', '') is null
            and nullif(btrim(row_item->>'driver_name'), '') is not null
            and (lower(d.display_name) = lower(btrim(row_item->>'driver_name'))
              or lower(d.public_name) = lower(btrim(row_item->>'driver_name'))
              or lower(d.gamertag) = lower(btrim(row_item->>'driver_name'))))
        );
    exception
      when too_many_rows then
        raise exception using errcode='22023', message=format('Mehrere Fahrer passen zu Zeile %s. Bitte den Fahrer anhand seines Gamertags ausdrücklich auswählen.',row_no);
      when no_data_found then
        raise exception using errcode='P0002', message=format('Unknown driver in row %s.',row_no);
    end;$new$;
  if position(needle in body)=0 then raise exception 'Unexpected result draft driver lookup'; end if;
  execute replace(body,needle,replacement);
end; $patch$;
