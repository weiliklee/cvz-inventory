-- CVZ Inventory — base tables.
-- Run FIRST on a fresh Supabase project, then run supabase-auth-setup.sql.
-- Row Level Security policies are NOT defined here; they live in
-- supabase-auth-setup.sql (any signed-in user reads, only editors write).

create table if not exists products (
  id text primary key,
  name text not null,
  sku text,
  category text,
  material text,
  color text,
  dimensions text,
  cost_price numeric default 0,
  sell_price numeric default 0,
  stock integer default 0,
  reorder_level integer default 0,
  supplier text,
  created_at timestamptz default now()
);

create table if not exists movements (
  id text primary key,
  product_id text references products(id) on delete set null,
  product_name text,
  sku text,
  type text check (type in ('in','out')),
  qty integer not null,
  reason text,
  reference text,
  notes text,
  date timestamptz default now()
);

create table if not exists purchase_orders (
  id text primary key,
  po_number text,
  supplier text,
  status text default 'ordered',
  items jsonb,
  date timestamptz default now(),
  received_date timestamptz
);

alter table products enable row level security;
alter table movements enable row level security;
alter table purchase_orders enable row level security;
