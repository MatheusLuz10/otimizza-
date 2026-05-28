create table if not exists buildings (
  id bigint primary key generated always as identity,
  name text not null unique,
  address text,
  observations text,
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  sync_status text not null default 'synced',
  synced_at timestamptz
);

create table if not exists ctos (
  id bigint primary key generated always as identity,
  code text not null unique,
  building_id bigint not null references buildings(id) on delete cascade,
  floor text,
  power text,
  ports integer,
  splitter text,
  technical_info text,
  observations text,
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  sync_status text not null default 'synced',
  synced_at timestamptz
);

create index if not exists idx_buildings_updated_at on buildings(updated_at desc);
create index if not exists idx_ctos_building_id on ctos(building_id);
create index if not exists idx_ctos_updated_at on ctos(updated_at desc);

alter table buildings disable row level security;
alter table ctos disable row level security;
