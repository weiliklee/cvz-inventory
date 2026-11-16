-- Run this once in the Supabase SQL Editor for this project.
--
-- Problem: stock movements and PO receiving are currently done as two or
-- more separate insert/update calls from the browser (see src/App.jsx
-- addMovement / receivePOAction). The new stock value is computed
-- client-side from whatever the browser last loaded, so two staff acting
-- at the same time (or a slow network round-trip) can lose an update, and
-- nothing stops a PO from being received twice or stock being sold past
-- zero.
--
-- Fix: move both operations into single Postgres functions that lock the
-- affected row(s) with `for update` and do the read-check-write as one
-- atomic unit, called from the client via supabase.rpc(...).

-- 1. record_stock_movement: atomically adjusts a product's stock and logs
--    the movement. Locks the product row so concurrent movements can't
--    race, and rejects an "out" movement that would take stock negative
--    instead of silently clamping it to 0.
create or replace function record_stock_movement(
  p_movement_id text,
  p_product_id text,
  p_type text,
  p_qty numeric,
  p_reason text default null,
  p_reference text default null,
  p_notes text default null,
  p_date timestamptz default now()
)
returns jsonb
language plpgsql
set search_path = public
as $$
declare
  v_stock numeric;
  v_name text;
  v_sku text;
  v_new_stock numeric;
  v_date timestamptz := coalesce(p_date, now());
begin
  if p_type not in ('in', 'out') then
    raise exception 'Invalid movement type "%": must be "in" or "out"', p_type;
  end if;

  if p_qty is null or p_qty <= 0 then
    raise exception 'Quantity must be greater than zero';
  end if;

  select stock, name, sku into v_stock, v_name, v_sku
  from products
  where id = p_product_id
  for update;

  if not found then
    raise exception 'Product % not found', p_product_id;
  end if;

  v_new_stock := v_stock + (case when p_type = 'in' then p_qty else -p_qty end);

  if v_new_stock < 0 then
    raise exception 'Insufficient stock for %: % in stock, cannot remove %', v_name, v_stock, p_qty;
  end if;

  update products set stock = v_new_stock where id = p_product_id;

  insert into movements (id, product_id, product_name, sku, type, qty, reason, reference, notes, date)
  values (p_movement_id, p_product_id, v_name, v_sku, p_type, p_qty, p_reason, p_reference, p_notes, v_date);

  return jsonb_build_object(
    'id', p_movement_id, 'productId', p_product_id, 'productName', v_name, 'sku', v_sku,
    'type', p_type, 'qty', p_qty, 'reason', p_reason, 'reference', p_reference, 'notes', p_notes,
    'date', v_date, 'newStock', v_new_stock
  );
end;
$$;

grant execute on function record_stock_movement(text, text, text, numeric, text, text, text, timestamptz) to authenticated;

-- 2. receive_purchase_order: atomically marks a PO received and applies
--    all its line items to stock. Locks the PO row so it can't be received
--    twice (double crediting stock), and locks each product row while
--    updating it, all in one transaction — if any line item's product is
--    missing, the whole receive is rolled back rather than left half-done.
create or replace function receive_purchase_order(p_po_id text)
returns jsonb
language plpgsql
set search_path = public
as $$
declare
  v_po record;
  v_item jsonb;
  v_product_id text;
  v_qty numeric;
  v_stock numeric;
  v_name text;
  v_sku text;
  v_new_stock numeric;
  v_received_date timestamptz := now();
  v_movement_id text;
  v_movements jsonb := '[]'::jsonb;
  v_stock_updates jsonb := '[]'::jsonb;
begin
  select id, po_number, status, items into v_po
  from purchase_orders
  where id = p_po_id
  for update;

  if not found then
    raise exception 'Purchase order not found';
  end if;

  if v_po.status <> 'ordered' then
    raise exception 'Purchase order % has already been % and cannot be received again', v_po.po_number, v_po.status;
  end if;

  for v_item in select jsonb_array_elements(coalesce(v_po.items, '[]'::jsonb)) loop
    v_product_id := v_item->>'productId';
    v_qty := nullif(v_item->>'qty', '')::numeric;

    if v_product_id is null or v_qty is null or v_qty <= 0 then
      continue;
    end if;

    select stock, name, sku into v_stock, v_name, v_sku
    from products
    where id = v_product_id
    for update;

    if not found then
      raise exception 'Product % (from PO %) not found', v_product_id, v_po.po_number;
    end if;

    v_new_stock := v_stock + v_qty;
    update products set stock = v_new_stock where id = v_product_id;

    v_movement_id := 'mov_' || replace(gen_random_uuid()::text, '-', '');
    insert into movements (id, product_id, product_name, sku, type, qty, reason, reference, notes, date)
    values (v_movement_id, v_product_id, v_name, v_sku, 'in', v_qty, 'Purchase order', v_po.po_number, '', v_received_date);

    v_movements := v_movements || jsonb_build_object(
      'id', v_movement_id, 'productId', v_product_id, 'productName', v_name, 'sku', v_sku,
      'type', 'in', 'qty', v_qty, 'reason', 'Purchase order', 'reference', v_po.po_number,
      'notes', '', 'date', v_received_date
    );
    v_stock_updates := v_stock_updates || jsonb_build_object('id', v_product_id, 'stock', v_new_stock);
  end loop;

  update purchase_orders set status = 'received', received_date = v_received_date where id = p_po_id;

  return jsonb_build_object(
    'poId', p_po_id, 'poNumber', v_po.po_number, 'receivedDate', v_received_date,
    'movements', v_movements, 'stockUpdates', v_stock_updates
  );
end;
$$;

grant execute on function receive_purchase_order(text) to authenticated;

-- 3. Defense-in-depth: DB-level invariants so a bad value can't get in
--    through any other path either (bulk import/restore, a future feature,
--    manual SQL). Each is wrapped so one already-violated constraint
--    (pre-existing bad data) doesn't stop the rest of this script.
do $$
begin
  alter table products add constraint products_stock_non_negative check (stock >= 0);
exception
  when duplicate_object then null;
  when check_violation then raise notice 'Skipped products_stock_non_negative: existing rows violate it. Fix negative stock first, then re-run this block.';
end $$;

do $$
begin
  alter table movements add constraint movements_qty_positive check (qty > 0);
exception
  when duplicate_object then null;
  when check_violation then raise notice 'Skipped movements_qty_positive: existing rows violate it.';
end $$;

do $$
begin
  alter table movements add constraint movements_type_valid check (type in ('in', 'out'));
exception
  when duplicate_object then null;
  when check_violation then raise notice 'Skipped movements_type_valid: existing rows violate it.';
end $$;

do $$
begin
  alter table purchase_orders add constraint purchase_orders_status_valid check (status in ('ordered', 'received', 'cancelled'));
exception
  when duplicate_object then null;
  when check_violation then raise notice 'Skipped purchase_orders_status_valid: existing rows violate it.';
end $$;
