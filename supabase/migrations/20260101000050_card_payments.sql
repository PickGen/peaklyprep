-- PeaklyPrep: online card payments (Lemon Squeezy) ----------------------------------------------------
-- A paid order arrives from the payment provider at /api/lemonsqueezy-webhook (a Vercel function). The
-- function checks the provider's signature and then calls record_card_payment() below with the service
-- role key. The payment is stored next to the manual requests in payment_requests, so the admin pages
-- ("Заявки на оплату", "Статистика") show it without any changes. Safe to re-run.

-- 1. Where a payment came from. 'manual' = card transfer + receipt, checked by the admin.
alter table public.payment_requests
  add column if not exists provider        text not null default 'manual',
  add column if not exists external_id     text,
  add column if not exists subscription_id uuid references public.subscriptions (id) on delete set null;

-- One row per provider order: the provider may deliver the same notification more than once.
create unique index if not exists payment_requests_external_idx
  on public.payment_requests (provider, external_id)
  where external_id is not null;

-- 2. A student may only file a manual request that still waits for the admin.
--    (Before this, the policy also accepted a row that was already marked "approved".)
drop policy if exists "requests insert" on public.payment_requests;
create policy "requests insert" on public.payment_requests
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and status = 'pending'
    and provider = 'manual'
    and external_id is null
    and subscription_id is null
    and admin_note is null
  );

-- 3. Record a paid order and open access.
--    p_grant = true  -> the payment is stored as approved and the subscription starts at once
--                       (after the current one, if it is still active);
--    p_grant = false -> the payment is stored as pending, for the admin to look at.
--    The student is found by id; if the id did not come with the order, by the e-mail used at checkout.
create or replace function public.record_card_payment(
  p_provider    text,
  p_external_id text,
  p_user_id     uuid,
  p_email       text,
  p_plan        text,
  p_amount_usd  numeric,
  p_grant       boolean default true,
  p_note        text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_months  int;
  v_user    uuid;
  v_status  text;
  v_base    timestamptz;
  v_expires timestamptz;
  v_sub     uuid;
begin
  if coalesce(trim(p_provider), '') = '' or coalesce(trim(p_external_id), '') = '' then
    raise exception 'provider and external id are required';
  end if;
  v_months := case p_plan when '1m' then 1 when '3m' then 3 when '6m' then 6 when '12m' then 12 else null end;
  if v_months is null then
    raise exception 'Unknown plan: %', p_plan;
  end if;

  select status into v_status
  from public.payment_requests
  where provider = p_provider and external_id = p_external_id;
  if found then
    return jsonb_build_object('result', 'duplicate', 'status', v_status);
  end if;

  select id into v_user from public.profiles where id = p_user_id;
  if v_user is null and coalesce(trim(p_email), '') <> '' then
    select id into v_user
    from public.profiles
    where lower(email) = lower(trim(p_email))
    order by created_at
    limit 1;
  end if;
  if v_user is null then
    return jsonb_build_object('result', 'no_user');
  end if;

  if coalesce(p_grant, true) then
    -- one payment at a time per student, so two orders in the same second both extend the plan
    perform pg_advisory_xact_lock(hashtext(v_user::text));
    select greatest(now(), coalesce(max(expires_at), now())) into v_base
    from public.subscriptions
    where user_id = v_user and expires_at > now();
    v_expires := v_base + make_interval(months => v_months);
    insert into public.subscriptions (user_id, plan, starts_at, expires_at, source)
    values (v_user, p_plan, now(), v_expires, p_provider)
    returning id into v_sub;
  end if;

  insert into public.payment_requests (user_id, plan, amount_usd, status, admin_note, provider, external_id, subscription_id)
  values (
    v_user,
    p_plan,
    greatest(coalesce(p_amount_usd, 0), 0),
    case when v_sub is null then 'pending' else 'approved' end,
    p_note,
    p_provider,
    p_external_id,
    v_sub
  );

  return jsonb_build_object(
    'result', case when v_sub is null then 'review' else 'granted' end,
    'user_id', v_user,
    'expires_at', v_expires
  );
exception
  when unique_violation then
    -- the same order was being recorded by a parallel delivery; this block's changes are rolled back
    return jsonb_build_object('result', 'duplicate');
end;
$$;

-- 4. A refund. Full refund: the payment no longer counts as earned and the access it opened ends now.
--    Partial refund: only a note for the admin.
create or replace function public.refund_card_payment(
  p_provider    text,
  p_external_id text,
  p_full        boolean default true,
  p_note        text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_req  public.payment_requests%rowtype;
  v_note text := coalesce(nullif(trim(p_note), ''), 'Refund');
begin
  select * into v_req
  from public.payment_requests
  where provider = p_provider and external_id = p_external_id
  for update;
  if not found then
    return jsonb_build_object('result', 'not_found');
  end if;

  if not coalesce(p_full, true) then
    if position(v_note in coalesce(v_req.admin_note, '')) = 0 then
      update public.payment_requests set admin_note = concat_ws(' · ', admin_note, v_note) where id = v_req.id;
    end if;
    return jsonb_build_object('result', 'noted');
  end if;

  if v_req.status = 'rejected' then
    return jsonb_build_object('result', 'duplicate');
  end if;

  update public.payment_requests
  set status = 'rejected', admin_note = concat_ws(' · ', admin_note, v_note)
  where id = v_req.id;

  if v_req.subscription_id is not null then
    update public.subscriptions
    set expires_at = now()
    where id = v_req.subscription_id and expires_at > now();
  end if;

  return jsonb_build_object('result', 'refunded', 'user_id', v_req.user_id);
end;
$$;

-- Only the server (service role key) may call these two: never a visitor or a signed-in student.
revoke all on function public.record_card_payment(text, text, uuid, text, text, numeric, boolean, text) from public, anon, authenticated;
revoke all on function public.refund_card_payment(text, text, boolean, text) from public, anon, authenticated;
grant execute on function public.record_card_payment(text, text, uuid, text, text, numeric, boolean, text) to service_role;
grant execute on function public.refund_card_payment(text, text, boolean, text) to service_role;

-- check: payments by source (only 'manual' until the first card payment arrives)
select provider, status, count(*) as payments
from public.payment_requests
group by provider, status
order by provider, status;
