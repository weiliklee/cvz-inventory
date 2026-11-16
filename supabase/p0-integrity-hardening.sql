-- STATUS: NOT YET APPLIED unless noted otherwise. App.jsx has not been wired to these functions yet.
-- Run in the Supabase SQL Editor AFTER supabase-auth-setup.sql.
-- Adds performed_by on movements, and two transactional functions.
-- Both are SECURITY INVOKER, so existing RLS (editor-only writes) still applies.

alter table movements add column if not exists performed_by uuid references auth.users(id) on delete set null;

create or replace function record_stock_movement(
  p_id text,
  p_product_id text,
  p_type text,
  p_qty integer,
  p_reason text,
  p_reference text,
  p_notes text,
  p_date timestamptz default now()
)
returns products
language plpgsql
as $$
declare
  v_product products;
  v_new_stock integer;
begin
  if p_type not in ('in', 'out') then
    raise exception 'Invalid movement type: %', p_type;
  end if;
  if p_qty is null or p_qty <= 0 then
    raise exception 'Quantity must be greater than 0';
  end if;

  select * into v_product from products where id = p_product_id for update;
  if not found then
    raise exception 'Product % not found', p_product_id;
  end if;

  v_new_stock := v_product.stock + (case when p_type = 'in' then p_qty else -p_qty end);

  if v_new_stock < 0 then
    raise exception 'Insufficient stock for %: have %, tried to remove %', v_product.name, v_product.stock, p_qty;
  end if;

  insert into movements (id, product_id, product_name, sku, type, qty, reason, reference, notes, date, performed_by)
  values (p_id, p_product_id, v_product.name, v_product.sku, p_type, p_qty, p_reason, p_reference, p_notes, p_date, auth.uid());

  update products set stock = v_new_stock where id = p_product_id;

  select * into v_product from products where id = p_product_id;
  return v_product;
end;
$$;

create or replace function receive_purchase_order(p_po_id text)
returns purchase_orders
language plpgsql
as $$
declare
  v_po purchase_orders;
  v_item jsonb;
  v_product products;
  v_new_stock integer;
begin
  select * into v_po from purchase_orders where id = p_po_id for update;
  if not found then
    raise exception 'Purchase order % not found', p_po_id;
  end if;
  if v_po.status = 'received' then
    raise exception 'Purchase order % has already been received', v_po.po_number;
  end if;
  if v_po.status = 'cancelled' then
    raise exception 'Purchase order % is cancelled and cannot be received', v_po.po_number;
  end if;

  for v_item in select * from jsonb_array_elements(v_po.items)
  loop
    select * into v_product from products where id = (v_item->>'productId') for update;
    if not found then
      raise exception 'Product % (in this PO) no longer exists', v_item->>'productId';
    end if;

    v_new_stock := v_product.stock + (v_item->>'qty')::integer;

    insert into movements (id, product_id, product_name, sku, type, qty, reason, reference, notes, date, performed_by)
    values (
      gen_random_uuid()::text, v_product.id, v_product.name, v_product.sku,
      'in', (v_item->>'qty')::integer, 'Purchase order', v_po.po_number, '', now(), auth.uid()
    );

    update products set stock = v_new_stock where id = v_product.id;
  end loop;

  update purchase_orders set status = 'received', received_date = now() where id = p_po_id;

  select * into v_po from purchase_orders where id = p_po_id;
  return v_po;
end;
$$;
