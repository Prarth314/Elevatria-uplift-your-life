-- Apply after 001. Server-only, atomic per-account rate limits and non-reused revisions.
begin;
create sequence public.workspace_revision_seq as bigint minvalue 1 maxvalue 9007199254740991 no cycle;
select setval('public.workspace_revision_seq', greatest(coalesce((select max(revision) from public.workspaces),0)+1,1), false);
revoke all on sequence public.workspace_revision_seq from public,anon,authenticated;
grant usage,select on sequence public.workspace_revision_seq to service_role;

create table public.workspace_request_limits (
  owner_id uuid primary key references auth.users(id) on delete cascade,
  window_start timestamptz not null,
  request_count integer not null check(request_count > 0)
);
alter table public.workspace_request_limits enable row level security;
alter table public.workspace_request_limits force row level security;
revoke all on public.workspace_request_limits from public,anon,authenticated;
grant all on public.workspace_request_limits to service_role;

create function public.check_workspace_rate_limit(p_owner uuid) returns void
language plpgsql security invoker set search_path='' as $$
declare requests integer;
begin
  insert into public.workspace_request_limits as bucket(owner_id,window_start,request_count)
    values(p_owner,clock_timestamp(),1)
    on conflict(owner_id) do update set
      window_start=case when bucket.window_start <= clock_timestamp()-interval '1 minute' then clock_timestamp() else bucket.window_start end,
      request_count=case when bucket.window_start <= clock_timestamp()-interval '1 minute' then 1 else bucket.request_count+1 end
    returning request_count into requests;
  if requests > 60 then raise exception using errcode='P0001',message='RATE_LIMITED'; end if;
end;
$$;
revoke all on function public.check_workspace_rate_limit(uuid) from public,anon,authenticated;
grant execute on function public.check_workspace_rate_limit(uuid) to service_role;

-- Prevent clients from bypassing API validation, caching rules, or rate limits with direct reads.
revoke all on public.workspaces from public,anon,authenticated;
create function public.read_workspace(p_owner uuid) returns table(revision bigint,document jsonb)
language plpgsql security invoker set search_path='' as $$
begin
  perform public.check_workspace_rate_limit(p_owner);
  return query select w.revision,w.document from public.workspaces w where w.owner_id=p_owner;
end;
$$;
revoke all on function public.read_workspace(uuid) from public,anon,authenticated;
grant execute on function public.read_workspace(uuid) to service_role;

create or replace function public.save_workspace(p_owner uuid,p_revision bigint,p_document jsonb)
returns table(revision bigint,document jsonb)
language plpgsql security invoker set search_path='' as $$
begin
  perform public.check_workspace_rate_limit(p_owner);
  if p_revision=0 then
    return query insert into public.workspaces as w(owner_id,revision,document)
      values(p_owner,nextval('public.workspace_revision_seq'),p_document)
      on conflict(owner_id) do nothing returning w.revision,w.document;
  else
    return query update public.workspaces as w set document=p_document,revision=nextval('public.workspace_revision_seq'),updated_at=clock_timestamp()
      where w.owner_id=p_owner and w.revision=p_revision returning w.revision,w.document;
  end if;
end;
$$;
create or replace function public.delete_workspace(p_owner uuid,p_revision bigint) returns boolean
language plpgsql security invoker set search_path='' as $$
declare removed integer;
begin
  perform public.check_workspace_rate_limit(p_owner);
  delete from public.workspaces where owner_id=p_owner and revision=p_revision;
  get diagnostics removed=row_count;
  return removed=1;
end;
$$;
commit;
