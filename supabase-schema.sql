-- ═════════════════════════════════════════════════════════════════
-- OTIMIZA3 - Schema Supabase
-- Fluxo de movimentação: Realtime + Audit Log + Triggers
-- ═════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────────
-- FUNÇÃO: atualiza updated_at automaticamente em qualquer UPDATE
-- Necessário para que o Realtime detecte mudanças de outros clientes
-- ─────────────────────────────────────────────────────────────────
create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ─────────────────────────────────────────────────────────────────
-- TABELA: buildings
-- ─────────────────────────────────────────────────────────────────
create table if not exists buildings (
  id         bigint primary key generated always as identity,
  name       text not null unique,
  address    text,
  observations text,
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  sync_status text not null default 'synced',
  synced_at  timestamptz
);

-- Trigger: garante que updated_at seja atualizado em qualquer client
drop trigger if exists trg_buildings_updated_at on buildings;
create trigger trg_buildings_updated_at
  before update on buildings
  for each row execute function set_updated_at();

-- CRÍTICO: sem isso, Realtime envia "old: null" em UPDATE e DELETE,
-- impossibilitando identificar qual registro mudou
alter table buildings replica identity full;

-- ─────────────────────────────────────────────────────────────────
-- TABELA: ctos
-- ─────────────────────────────────────────────────────────────────
create table if not exists ctos (
  id           bigint primary key generated always as identity,
  code         text not null unique,
  building_id  bigint not null references buildings(id) on delete cascade,
  floor        text,
  power        text,
  ports        integer,
  splitter     text,
  technical_info text,
  observations text,
  created_by   text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  sync_status  text not null default 'synced',
  synced_at    timestamptz
);

drop trigger if exists trg_ctos_updated_at on ctos;
create trigger trg_ctos_updated_at
  before update on ctos
  for each row execute function set_updated_at();

alter table ctos replica identity full;

-- ─────────────────────────────────────────────────────────────────
-- TABELA: audit_logs (fluxo de movimentações entre dispositivos)
-- Registra toda criação, edição e exclusão para sincronizar
-- o histórico entre celular e notebook
-- ─────────────────────────────────────────────────────────────────
create table if not exists audit_logs (
  id          bigint primary key generated always as identity,
  building_id bigint references buildings(id) on delete set null,
  cto_id      bigint,
  action      text not null,
  technician  text,
  registration text,
  details     text,
  timestamp   timestamptz not null default now(),
  created_at  timestamptz not null default now()
);

alter table audit_logs replica identity full;

-- ─────────────────────────────────────────────────────────────────
-- ÍNDICES DE PERFORMANCE
-- ─────────────────────────────────────────────────────────────────
create index if not exists idx_buildings_updated_at on buildings(updated_at desc);
create index if not exists idx_buildings_name       on buildings(name);

create index if not exists idx_ctos_building_id on ctos(building_id);
create index if not exists idx_ctos_updated_at  on ctos(updated_at desc);
create index if not exists idx_ctos_code        on ctos(code);

create index if not exists idx_audit_logs_building_id on audit_logs(building_id);
create index if not exists idx_audit_logs_timestamp   on audit_logs(timestamp desc);
create index if not exists idx_audit_logs_action      on audit_logs(action);
create index if not exists idx_audit_logs_technician  on audit_logs(technician);

-- ─────────────────────────────────────────────────────────────────
-- ROW LEVEL SECURITY
-- ─────────────────────────────────────────────────────────────────
alter table buildings  enable row level security;
alter table ctos       enable row level security;
alter table audit_logs enable row level security;

-- buildings
drop policy if exists "allow_public_buildings_select" on buildings;
drop policy if exists "allow_public_buildings_insert" on buildings;
drop policy if exists "allow_public_buildings_update" on buildings;
drop policy if exists "allow_public_buildings_delete" on buildings;

create policy "allow_public_buildings_select"
  on buildings for select using (true);

create policy "allow_public_buildings_insert"
  on buildings for insert with check (true);

create policy "allow_public_buildings_update"
  on buildings for update using (true) with check (true);

create policy "allow_public_buildings_delete"
  on buildings for delete using (true);

-- ctos
drop policy if exists "allow_public_ctos_select" on ctos;
drop policy if exists "allow_public_ctos_insert" on ctos;
drop policy if exists "allow_public_ctos_update" on ctos;
drop policy if exists "allow_public_ctos_delete" on ctos;

create policy "allow_public_ctos_select"
  on ctos for select using (true);

create policy "allow_public_ctos_insert"
  on ctos for insert with check (true);

create policy "allow_public_ctos_update"
  on ctos for update using (true) with check (true);

create policy "allow_public_ctos_delete"
  on ctos for delete using (true);

-- audit_logs: leitura e inserção públicas, sem update/delete
-- (log imutável — ninguém pode alterar o histórico)
drop policy if exists "allow_public_audit_select" on audit_logs;
drop policy if exists "allow_public_audit_insert" on audit_logs;

create policy "allow_public_audit_select"
  on audit_logs for select using (true);

create policy "allow_public_audit_insert"
  on audit_logs for insert with check (true);

-- ─────────────────────────────────────────────────────────────────
-- HABILITAR REALTIME (execute no SQL Editor do Supabase)
--
-- O Supabase tem uma publication padrão chamada supabase_realtime.
-- As tabelas precisam estar registradas nela para receber eventos
-- de INSERT, UPDATE e DELETE em tempo real.
--
-- IMPORTANTE: verifique se as tabelas já estão na publication antes
-- de executar (evita erro de "already member"):
--   select * from pg_publication_tables where pubname = 'supabase_realtime';
-- ─────────────────────────────────────────────────────────────────
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and tablename = 'buildings'
  ) then
    alter publication supabase_realtime add table buildings;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and tablename = 'ctos'
  ) then
    alter publication supabase_realtime add table ctos;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and tablename = 'audit_logs'
  ) then
    alter publication supabase_realtime add table audit_logs;
  end if;
end;
$$;
