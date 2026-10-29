-- Apply manually to a Supabase development project first. Never run against unrelated data.
begin;
create table public.workspaces (
  owner_id uuid primary key references auth.users(id) on delete cascade,
  revision bigint not null default 1 check (revision > 0),
  document jsonb not null check (jsonb_typeof(document) = 'object' and document->>'version' = '1'),
  updated_at timestamptz not null default now(),
  constraint document_size_limit check (octet_length(document::text) <= 1100000)
);
alter table public.workspaces enable row level security;
alter table public.workspaces force row level security;
revoke all on public.workspaces from anon, authenticated;
grant select on public.workspaces to authenticated;
grant all on public.workspaces to service_role;
create policy own_workspace_read on public.workspaces for select to authenticated using ((select auth.uid()) = owner_id);

-- Only the validated server API may mutate documents. The owner comes from verified Auth.
create function public.save_workspace(p_owner uuid, p_revision bigint, p_document jsonb)
returns table(revision bigint, document jsonb)
language plpgsql security invoker set search_path = '' as $$
begin
  if p_revision = 0 then
    return query insert into public.workspaces as w(owner_id,revision,document)
      values(p_owner,1,p_document) on conflict(owner_id) do nothing returning w.revision,w.document;
  else
    return query update public.workspaces as w set document=p_document,revision=w.revision+1,updated_at=now()
      where w.owner_id=p_owner and w.revision=p_revision returning w.revision,w.document;
  end if;
end;
$$;
create function public.delete_workspace(p_owner uuid, p_revision bigint) returns boolean
language plpgsql security invoker set search_path = '' as $$
declare removed integer;
begin
  delete from public.workspaces where owner_id=p_owner and revision=p_revision;
  get diagnostics removed = row_count;
  return removed = 1;
end;
$$;
revoke all on function public.save_workspace(uuid,bigint,jsonb) from public,anon,authenticated;
revoke all on function public.delete_workspace(uuid,bigint) from public,anon,authenticated;
grant execute on function public.save_workspace(uuid,bigint,jsonb) to service_role;
grant execute on function public.delete_workspace(uuid,bigint) to service_role;
commit;
