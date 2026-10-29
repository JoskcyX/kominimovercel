ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS plan text NOT NULL DEFAULT 'free' CHECK (plan IN ('free','pro')),
  ADD COLUMN IF NOT EXISTS referral_code text,
  ADD COLUMN IF NOT EXISTS referred_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS profiles_referral_code_uniq
  ON public.profiles (referral_code) WHERE referral_code IS NOT NULL;

CREATE INDEX IF NOT EXISTS profiles_referred_by_idx ON public.profiles (referred_by);

UPDATE public.profiles
  SET referral_code =
    COALESCE(lower(regexp_replace(display_name, '[^a-zA-Z0-9]+', '', 'g')), 'tutor')
    || '-' || substr(encode(gen_random_bytes(5), 'hex'), 1, 6)
  WHERE referral_code IS NULL;

CREATE OR REPLACE FUNCTION public.ensure_profile_referral_code()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.referral_code IS NULL THEN
    NEW.referral_code :=
      COALESCE(lower(regexp_replace(NEW.display_name, '[^a-zA-Z0-9]+', '', 'g')), 'tutor')
      || '-' || substr(encode(gen_random_bytes(5), 'hex'), 1, 6);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_ensure_referral_code ON public.profiles;
CREATE TRIGGER profiles_ensure_referral_code
  BEFORE INSERT ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.ensure_profile_referral_code();

CREATE TABLE IF NOT EXISTS public.referral_earnings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  referred_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  amount_cents integer NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'NGN',
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','paid')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (referrer_id, referred_id)
);

GRANT SELECT, INSERT, UPDATE ON public.referral_earnings TO authenticated;
GRANT ALL ON public.referral_earnings TO service_role;
ALTER TABLE public.referral_earnings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "referrer reads own earnings"
  ON public.referral_earnings FOR SELECT
  TO authenticated
  USING (referrer_id = auth.uid() OR referred_id = auth.uid());

CREATE POLICY "tutor inserts own earnings"
  ON public.referral_earnings FOR INSERT
  TO authenticated
  WITH CHECK (referrer_id = auth.uid());

CREATE POLICY "referrer updates own earnings"
  ON public.referral_earnings FOR UPDATE
  TO authenticated
  USING (referrer_id = auth.uid())
  WITH CHECK (referrer_id = auth.uid());

CREATE TABLE IF NOT EXISTS public.subscription_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tutor_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  event text NOT NULL,
  amount_cents integer NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'NGN',
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.subscription_events TO authenticated;
GRANT ALL ON public.subscription_events TO service_role;
ALTER TABLE public.subscription_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tutor reads own sub events"
  ON public.subscription_events FOR SELECT
  TO authenticated
  USING (tutor_id = auth.uid());

CREATE POLICY "tutor inserts own sub events"
  ON public.subscription_events FOR INSERT
  TO authenticated
  WITH CHECK (tutor_id = auth.uid());

CREATE OR REPLACE FUNCTION public.resolve_referral_code(_code text)
RETURNS TABLE (id uuid, display_name text, referral_code text)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT p.id, p.display_name, p.referral_code
  FROM public.profiles p
  WHERE p.referral_code = _code
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.resolve_referral_code(text) TO authenticated;

CREATE OR REPLACE FUNCTION public.my_referral_summary()
RETURNS TABLE (
  referral_code text,
  total_referred bigint,
  pro_referred bigint,
  earnings_pending_cents bigint,
  earnings_paid_cents bigint
)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT
    p.referral_code,
    (SELECT count(*) FROM public.profiles r WHERE r.referred_by = p.id),
    (SELECT count(*) FROM public.profiles r WHERE r.referred_by = p.id AND r.plan = 'pro'),
    COALESCE((SELECT sum(e.amount_cents) FROM public.referral_earnings e WHERE e.referrer_id = p.id AND e.status = 'pending'), 0),
    COALESCE((SELECT sum(e.amount_cents) FROM public.referral_earnings e WHERE e.referrer_id = p.id AND e.status = 'paid'), 0)
  FROM public.profiles p
  WHERE p.id = auth.uid();
$$;

GRANT EXECUTE ON FUNCTION public.my_referral_summary() TO authenticated;

CREATE OR REPLACE FUNCTION public.my_referral_list()
RETURNS TABLE (
  display_name text,
  plan text,
  joined_at timestamptz,
  earnings_cents bigint
)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT
    r.display_name,
    r.plan,
    r.created_at,
    COALESCE((SELECT sum(e.amount_cents) FROM public.referral_earnings e WHERE e.referred_id = r.id AND e.referrer_id = auth.uid()), 0)
  FROM public.profiles r
  WHERE r.referred_by = auth.uid()
  ORDER BY r.created_at DESC;
$$;

GRANT EXECUTE ON FUNCTION public.my_referral_list() TO authenticated;

CREATE OR REPLACE FUNCTION public.activate_tutor_pro(_tutor_id uuid, _amount_cents integer, _currency text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _referrer uuid;
  _referral_cut integer;
BEGIN
  UPDATE public.profiles SET plan = 'pro' WHERE id = _tutor_id;

  SELECT referred_by INTO _referrer FROM public.profiles WHERE id = _tutor_id;

  INSERT INTO public.subscription_events (tutor_id, event, amount_cents, currency)
  VALUES (_tutor_id, 'activated', _amount_cents, _currency);

  IF _referrer IS NOT NULL THEN
    _referral_cut := round(_amount_cents * 0.20);
    INSERT INTO public.referral_earnings (referrer_id, referred_id, amount_cents, currency, status)
    VALUES (_referrer, _tutor_id, _referral_cut, _currency, 'pending')
    ON CONFLICT (referrer_id, referred_id) DO UPDATE
      SET amount_cents = referral_earnings.amount_cents + EXCLUDED.amount_cents,
          status = 'pending';

    INSERT INTO public.subscription_events (tutor_id, event, amount_cents, currency, meta)
    VALUES (_referrer, 'referral_credited', _referral_cut, _currency, jsonb_build_object('referred', _tutor_id));
  END IF;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.activate_tutor_pro(uuid, integer, text) FROM authenticated, anon;