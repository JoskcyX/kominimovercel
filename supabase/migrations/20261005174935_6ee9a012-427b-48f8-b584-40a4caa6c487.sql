CREATE OR REPLACE FUNCTION public.ensure_profile_referral_code()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.referral_code IS NULL THEN
    NEW.referral_code :=
      COALESCE(lower(regexp_replace(NEW.display_name, '[^a-zA-Z0-9]+', '', 'g')), 'tutor')
      || '-' || substr(encode(extensions.gen_random_bytes(5), 'hex'), 1, 6);
  END IF;
  RETURN NEW;
END;
$function$;