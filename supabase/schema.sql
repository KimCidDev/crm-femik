-- =============================================================================
-- CRM FEMIK — esquema do banco (Supabase / Postgres)
-- Cole tudo no Supabase: SQL Editor → New query → Run. Pode rodar mais de uma vez.
-- =============================================================================

create extension if not exists pgcrypto;

-- --- perfis (um por usuário do Supabase Auth) --------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  name text not null default '',
  email text not null default '',
  role text not null default 'tecnico' check (role in ('admin', 'comercial', 'analista', 'tecnico')),
  location text not null default '',
  active boolean not null default true,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  created_by uuid, updated_by uuid
);

-- --- leads e clientes ---------------------------------------------------------
create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),
  company text not null,
  contact_name text default '', phone text default '', whatsapp text default '', email text default '',
  country text default '', city text default '', segment text default '',
  service_interest text default '', source text default '',
  owner_id uuid references public.profiles (id) on delete set null,
  stage text not null default 'novo' check (stage in ('novo','contato','reuniao','diagnostico','proposta','negociacao','ganho','perdido')),
  status text not null default 'lead' check (status in ('lead','cliente')),
  lost_reason text default '',
  value_estimate numeric(12,2), currency text default 'BRL' check (currency in ('BRL','CAD','EUR')),
  next_action text default '', next_action_date date,
  notes text default '', consent boolean not null default false,
  stage_changed_at timestamptz default now(), won_at timestamptz, lost_at timestamptz, last_contact_at timestamptz,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  created_by uuid references public.profiles (id) on delete set null, updated_by uuid references public.profiles (id) on delete set null
);
create index if not exists leads_owner_idx on public.leads (owner_id);
create index if not exists leads_stage_idx on public.leads (stage);

-- --- histórico de atendimento -----------------------------------------------------
create table if not exists public.interactions (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads (id) on delete cascade,
  type text not null default 'nota', summary text not null default '',
  at timestamptz not null default now(), user_id uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), created_by uuid, updated_by uuid
);
create index if not exists interactions_lead_idx on public.interactions (lead_id);

-- --- agenda e tarefas -------------------------------------------------------------
create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid references public.leads (id) on delete cascade,
  title text not null, kind text not null default 'tarefa' check (kind in ('tarefa','reuniao','followup')),
  due_date date not null, due_time text default '',
  owner_id uuid references public.profiles (id) on delete set null,
  done boolean not null default false, done_at timestamptz, notes text default '',
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), created_by uuid, updated_by uuid
);
create index if not exists tasks_owner_idx on public.tasks (owner_id, done, due_date);

-- --- catálogo de serviços -----------------------------------------------------
create table if not exists public.services (
  id uuid primary key default gen_random_uuid(),
  name text not null, category text default '', unit text default 'unico' check (unit in ('unico','mensal','hora')),
  price_brl numeric(12,2), price_cad numeric(12,2), price_eur numeric(12,2), active boolean not null default true,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), created_by uuid, updated_by uuid
);

-- --- propostas ------------------------------------------------------------------
create table if not exists public.proposals (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads (id) on delete cascade,
  number text not null unique, title text default '',
  status text not null default 'rascunho' check (status in ('rascunho','enviada','negociacao','aceita','recusada','expirada')),
  currency text not null default 'BRL' check (currency in ('BRL','CAD','EUR')), language text not null default 'pt',
  items jsonb not null default '[]'::jsonb, sent_at date, valid_until date, notes text default '',
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), created_by uuid, updated_by uuid
);

-- --- contratos (clientes ativos) ------------------------------------------------
create table if not exists public.contracts (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads (id) on delete cascade,
  services text default '', value numeric(12,2), monthly_value numeric(12,2),
  currency text not null default 'BRL' check (currency in ('BRL','CAD','EUR')),
  start_date date, end_date date, project_owner_id uuid references public.profiles (id) on delete set null,
  project_status text not null default 'planejamento' check (project_status in ('planejamento','andamento','pausado','concluido')),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), created_by uuid, updated_by uuid
);

-- --- documentos (metadados; o arquivo fica no Storage, bucket "documentos") ---
create table if not exists public.files (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads (id) on delete cascade,
  kind text not null default 'outro', name text not null, size bigint default 0, mime text default '',
  path text default '', data_url text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), created_by uuid, updated_by uuid
);

-- --- registro de alterações (preenchido só por trigger) ----------------------
create table if not exists public.audit_log (
  id uuid primary key default gen_random_uuid(),
  at timestamptz not null default now(),
  user_id uuid, table_name text not null, record_id uuid, record_label text default '', lead_id uuid,
  action text not null, fields text[] default '{}'
);
create index if not exists audit_at_idx on public.audit_log (at desc);

-- =============================================================================
-- Funções auxiliares
-- =============================================================================
create or replace function public.crm_role() returns text
language sql stable security definer set search_path = public as $$
  select role from public.profiles where id = auth.uid() and active
$$;

-- carimbo de quem criou / alterou (não confia no que vem do navegador)
create or replace function public.crm_stamp() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.updated_at := now();
  new.updated_by := auth.uid();
  if tg_op = 'INSERT' then
    new.created_at := coalesce(new.created_at, now());
    new.created_by := auth.uid();
  else
    new.created_at := old.created_at;
    new.created_by := old.created_by;
  end if;
  return new;
end $$;

-- registro de alterações
create or replace function public.crm_audit() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  j jsonb := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;
  changed text[] := '{}';
begin
  if tg_op = 'UPDATE' then
    select coalesce(array_agg(n.key), '{}') into changed
      from jsonb_each(to_jsonb(new)) n
     where n.value is distinct from (to_jsonb(old) -> n.key)
       and n.key not in ('updated_at', 'updated_by');
    if array_length(changed, 1) is null then return new; end if;
  end if;
  insert into public.audit_log (user_id, table_name, record_id, record_label, lead_id, action, fields)
  values (
    auth.uid(), tg_table_name, (j ->> 'id')::uuid,
    coalesce(j ->> 'company', j ->> 'title', j ->> 'name', left(j ->> 'summary', 60), ''),
    case when tg_table_name = 'leads' then (j ->> 'id')::uuid else (j ->> 'lead_id')::uuid end,
    lower(tg_op), changed
  );
  return coalesce(new, old);
end $$;

-- perfil automático para cada novo usuário; o primeiro vira administrador
create or replace function public.crm_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, name, role)
  values (
    new.id, coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data ->> 'name', split_part(coalesce(new.email, ''), '@', 1)),
    case when exists (select 1 from public.profiles) then 'tecnico' else 'admin' end
  )
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists crm_on_auth_user on auth.users;
create trigger crm_on_auth_user after insert on auth.users for each row execute function public.crm_new_user();

do $$
declare t text;
begin
  foreach t in array array['profiles','leads','interactions','tasks','services','proposals','contracts','files'] loop
    execute format('drop trigger if exists crm_stamp on public.%I', t);
    execute format('create trigger crm_stamp before insert or update on public.%I for each row execute function public.crm_stamp()', t);
    execute format('drop trigger if exists crm_audit on public.%I', t);
    execute format('create trigger crm_audit after insert or update or delete on public.%I for each row execute function public.crm_audit()', t);
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;
alter table public.audit_log enable row level security;

-- =============================================================================
-- Permissões (RLS)
--   admin: tudo · comercial: escreve no comercial · analista: lê
--   tecnico: lê e atualiza contratos (status do projeto) · todos: as próprias tarefas
-- =============================================================================
do $$
declare t text;
begin
  foreach t in array array['profiles','leads','interactions','tasks','services','proposals','contracts','files','audit_log'] loop
    execute format('drop policy if exists crm_select on public.%I', t);
    execute format('create policy crm_select on public.%I for select to authenticated using (public.crm_role() is not null)', t);
  end loop;
  foreach t in array array['leads','interactions','proposals','files'] loop
    execute format('drop policy if exists crm_insert on public.%I', t);
    execute format('create policy crm_insert on public.%I for insert to authenticated with check (public.crm_role() in (''admin'',''comercial''))', t);
    execute format('drop policy if exists crm_update on public.%I', t);
    execute format('create policy crm_update on public.%I for update to authenticated using (public.crm_role() in (''admin'',''comercial''))', t);
    execute format('drop policy if exists crm_delete on public.%I', t);
    execute format('create policy crm_delete on public.%I for delete to authenticated using (public.crm_role() = ''admin'' or (%L = ''files'' and public.crm_role() = ''comercial''))', t, t);
  end loop;
end $$;

drop policy if exists crm_insert on public.tasks;
create policy crm_insert on public.tasks for insert to authenticated
  with check (public.crm_role() in ('admin','comercial') or (public.crm_role() is not null and owner_id = auth.uid()));
drop policy if exists crm_update on public.tasks;
create policy crm_update on public.tasks for update to authenticated
  using (public.crm_role() in ('admin','comercial') or owner_id = auth.uid());
drop policy if exists crm_delete on public.tasks;
create policy crm_delete on public.tasks for delete to authenticated
  using (public.crm_role() = 'admin' or created_by = auth.uid());

drop policy if exists crm_insert on public.contracts;
create policy crm_insert on public.contracts for insert to authenticated with check (public.crm_role() in ('admin','comercial'));
drop policy if exists crm_update on public.contracts;
create policy crm_update on public.contracts for update to authenticated using (public.crm_role() in ('admin','comercial','tecnico'));
drop policy if exists crm_delete on public.contracts;
create policy crm_delete on public.contracts for delete to authenticated using (public.crm_role() = 'admin');

drop policy if exists crm_write on public.services;
create policy crm_write on public.services for all to authenticated using (public.crm_role() = 'admin') with check (public.crm_role() = 'admin');

drop policy if exists crm_update on public.profiles;
create policy crm_update on public.profiles for update to authenticated using (public.crm_role() = 'admin');

grant usage on schema public to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
revoke all on all tables in schema public from anon;

-- =============================================================================
-- Tempo real (Kanban e listas atualizam sozinhos para toda a equipe)
-- =============================================================================
do $$
declare t text;
begin
  foreach t in array array['profiles','leads','interactions','tasks','services','proposals','contracts','files','audit_log'] loop
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;

-- =============================================================================
-- Storage: bucket privado "documentos" (contratos, propostas, arquivos)
-- =============================================================================
insert into storage.buckets (id, name, public, file_size_limit)
values ('documentos', 'documentos', false, 52428800)
on conflict (id) do nothing;

drop policy if exists crm_docs_read on storage.objects;
create policy crm_docs_read on storage.objects for select to authenticated
  using (bucket_id = 'documentos' and public.crm_role() is not null);
drop policy if exists crm_docs_write on storage.objects;
create policy crm_docs_write on storage.objects for insert to authenticated
  with check (bucket_id = 'documentos' and public.crm_role() in ('admin','comercial'));
drop policy if exists crm_docs_delete on storage.objects;
create policy crm_docs_delete on storage.objects for delete to authenticated
  using (bucket_id = 'documentos' and public.crm_role() in ('admin','comercial'));
