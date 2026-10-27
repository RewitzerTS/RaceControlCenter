begin;
do $$ declare body text; changed text; begin
 body:=pg_get_functiondef('private.save_steward_group_case_revision(uuid,uuid[],uuid[],text,text,jsonb,boolean,uuid,text,integer,uuid,text)'::regprocedure);
 changed:=replace(body,'dd.amount=amount','dd.amount=(entry->>''amount'')::numeric');
 if changed=body then raise exception 'Grid correction guard source mismatch'; end if;
 execute changed;
end $$;
commit;
