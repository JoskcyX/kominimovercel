import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { PlanId } from "@/lib/plans";

export type PlanProfile = {
  plan: PlanId;
  referral_code: string | null;
  referred_by: string | null;
};

const REF_KEY = "edxka_ref_code";

/** Capture a ?ref= code from the URL into localStorage for signup attribution. */
export function captureReferralCode() {
  if (typeof window === "undefined") return;
  const params = new URLSearchParams(window.location.search);
  const ref = params.get("ref");
  if (ref && /^[a-zA-Z0-9-]{3,40}$/.test(ref)) {
    try {
      window.localStorage.setItem(REF_KEY, ref);
    } catch {
      /* ignore storage errors */
    }
  }
}

export function getStoredRefCode(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(REF_KEY);
  } catch {
    return null;
  }
}

export function clearStoredRefCode() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(REF_KEY);
  } catch {
    /* ignore */
  }
}

export function usePlan() {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["plan"],
    queryFn: async () => {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id;
      if (!userId) return null;
      const { data, error } = await supabase
        .from("profiles")
        .select("plan, referral_code, referred_by")
        .eq("id", userId)
        .maybeSingle();
      if (error) throw error;
      return (data as PlanProfile | null) ?? null;
    },
    staleTime: 60_000,
  });

  // Attribute a stored referral code to the signed-in tutor's profile once.
  useEffect(() => {
    const profile = query.data;
    if (!profile) return;
    const refCode = getStoredRefCode();
    if (!refCode || profile.referred_by) return;
    let cancelled = false;
    (async () => {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id;
      if (!userId) return;
      const { data: referrer } = await supabase.rpc("resolve_referral_code", { _code: refCode });
      const referrerId = Array.isArray(referrer) ? referrer[0]?.id : null;
      if (!referrerId || referrerId === userId) return;
      const { error } = await supabase
        .from("profiles")
        .update({ referred_by: referrerId })
        .eq("id", userId)
        .is("referred_by", null);
      if (!cancelled && !error) {
        clearStoredRefCode();
        queryClient.invalidateQueries({ queryKey: ["plan"] });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [query.data, queryClient]);

  return query;
}
