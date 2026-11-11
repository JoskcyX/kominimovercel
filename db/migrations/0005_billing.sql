-- ═══════════════════════════════════════════════════════════════════════════════════════════
-- 0005 · Plans, subscriptions and referrals
-- Nothing here is writable by an ordinary user session. (The old schema let any signed-in tutor
-- UPDATE their own `plan` to 'pro' and rewrite their referral earnings from the browser.)
-- Money records keep their history if an account is deleted (FKs SET NULL, no personal data).
-- ═══════════════════════════════════════════════════════════════════════════════════════════
CREATE TABLE public.referral_earnings (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id  uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  referred_id  uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  amount_cents integer NOT NULL DEFAULT 0 CHECK (amount_cents >= 0),
  currency     text NOT NULL DEFAULT 'NGN',
  status       text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','paid')),
  created_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (referrer_id, referred_id)
);
CREATE TABLE public.subscription_events (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tutor_id     uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  event        text NOT NULL,
  amount_cents integer NOT NULL DEFAULT 0,
  currency     text NOT NULL DEFAULT 'NGN',
  meta         jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at   timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.referral_earnings   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read own earnings" ON public.referral_earnings FOR SELECT TO app_runtime
  USING (referrer_id = app.uid() OR referred_id = app.uid() OR app.is_admin());
CREATE POLICY "read own subscription events" ON public.subscription_events FOR SELECT TO app_runtime
  USING (tutor_id = app.uid() OR app.is_admin());
GRANT SELECT ON public.referral_earnings, public.subscription_events TO app_runtime;   -- read-only

-- Attach a referrer to the signed-in user, once, atomically. Self-referral and unknown codes are ignored.
CREATE OR REPLACE FUNCTION public.attribute_referral(_code text) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE _ref uuid;
BEGIN
  IF app.uid() IS NULL THEN RETURN false; END IF;
  SELECT id INTO _ref FROM public.profiles WHERE referral_code = lower(btrim(_code)) AND id <> app.uid();
  IF _ref IS NULL THEN RETURN false; END IF;
  UPDATE public.profiles SET referred_by = _ref WHERE id = app.uid() AND referred_by IS NULL;
  RETURN FOUND;
END $$;

CREATE OR REPLACE FUNCTION public.my_referral_summary()
RETURNS TABLE (referral_code text, total_referred bigint, pro_referred bigint, earnings_pending_cents bigint, earnings_paid_cents bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT p.referral_code,
    (SELECT count(*) FROM public.profiles r WHERE r.referred_by = p.id),
    (SELECT count(*) FROM public.profiles r WHERE r.referred_by = p.id AND r.plan = 'pro'),
    coalesce((SELECT sum(e.amount_cents) FROM public.referral_earnings e WHERE e.referrer_id = p.id AND e.status = 'pending'), 0),
    coalesce((SELECT sum(e.amount_cents) FROM public.referral_earnings e WHERE e.referrer_id = p.id AND e.status = 'paid'), 0)
  FROM public.profiles p WHERE p.id = app.uid()
$$;

CREATE OR REPLACE FUNCTION public.my_referral_list()
RETURNS TABLE (display_name text, plan text, joined_at timestamptz, earnings_cents bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT r.display_name, r.plan, r.created_at,
         coalesce((SELECT sum(e.amount_cents) FROM public.referral_earnings e WHERE e.referred_id = r.id AND e.referrer_id = app.uid()), 0)
  FROM public.profiles r WHERE r.referred_by = app.uid() ORDER BY r.created_at DESC
$$;

-- Applies a plan change: updates the profile, resizes the tutor's classes, records the event.
CREATE OR REPLACE FUNCTION app.apply_plan(_user uuid, _plan text, _member_limit integer) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  IF _plan NOT IN ('free','pro') OR _member_limit < 1 THEN RAISE EXCEPTION 'bad plan arguments'; END IF;
  UPDATE public.profiles SET plan = _plan WHERE id = _user;
  UPDATE public.classes SET member_limit = _member_limit WHERE tutor_id = _user;
END $$;

-- Called by the (future) payment webhook only: requires the trusted "payment" context.
CREATE OR REPLACE FUNCTION public.activate_tutor_pro(_tutor_id uuid, _amount_cents integer, _currency text,
                                                     _referral_split numeric, _pro_member_limit integer) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE _referrer uuid; _cut integer;
BEGIN
  IF app.system_context() <> 'payment' THEN RAISE EXCEPTION 'forbidden'; END IF;
  PERFORM app.apply_plan(_tutor_id, 'pro', _pro_member_limit);
  SELECT referred_by INTO _referrer FROM public.profiles WHERE id = _tutor_id;
  INSERT INTO public.subscription_events (tutor_id, event, amount_cents, currency) VALUES (_tutor_id, 'activated', _amount_cents, _currency);
  IF _referrer IS NOT NULL THEN
    _cut := round(_amount_cents * _referral_split);
    INSERT INTO public.referral_earnings (referrer_id, referred_id, amount_cents, currency, status)
    VALUES (_referrer, _tutor_id, _cut, _currency, 'pending')
    ON CONFLICT (referrer_id, referred_id) DO UPDATE
      SET amount_cents = public.referral_earnings.amount_cents + excluded.amount_cents, status = 'pending';
    INSERT INTO public.subscription_events (tutor_id, event, amount_cents, currency, meta)
    VALUES (_referrer, 'referral_credited', _cut, _currency, jsonb_build_object('referred', _tutor_id));
  END IF;
END $$;

GRANT EXECUTE ON FUNCTION public.attribute_referral(text), public.my_referral_summary(), public.my_referral_list(),
  app.apply_plan(uuid, text, integer), public.activate_tutor_pro(uuid, integer, text, numeric, integer) TO app_runtime;
