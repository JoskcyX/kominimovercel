import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { getMe, attributeReferral } from "@/lib/me.functions";
import type { PlanId } from "@/config/plans";

export type Me = {
  userId: string;
  email: string | null;
  displayName: string;
  plan: PlanId;
  status: "active" | "suspended";
  roles: string[];
  isAdmin: boolean;
  referralCode: string | null;
  referredBy: string | null;
  legalOk: boolean;
};

const REF_KEY = "edxka_ref_code";

/** Capture a ?ref= code from the URL into localStorage for signup attribution. */
export function captureReferralCode() {
  if (typeof window === "undefined") return;
  const ref = new URLSearchParams(window.location.search).get("ref");
  if (ref && /^[a-zA-Z0-9-]{3,60}$/.test(ref)) {
    try {
      window.localStorage.setItem(REF_KEY, ref);
    } catch {
      /* storage blocked */
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

export const ME_KEY = ["me"] as const;

/** The signed-in user's profile, plan, roles and legal status (cached for a minute). */
export function useMe() {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ME_KEY,
    queryFn: () => getMe() as Promise<Me>,
    staleTime: 60_000,
  });

  // Credit a stored referral code to this account — once, atomically, on the server.
  useEffect(() => {
    const me = query.data;
    const code = getStoredRefCode();
    if (!me || !code || me.referredBy) return;
    let cancelled = false;
    attributeReferral({ data: { code } })
      .then(() => {
        if (cancelled) return;
        clearStoredRefCode();
        queryClient.invalidateQueries({ queryKey: ME_KEY });
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [query.data, queryClient]);

  return query;
}

/** Back-compat shape used by the upgrade page. */
export function usePlan() {
  const q = useMe();
  return {
    ...q,
    data: q.data
      ? { plan: q.data.plan, referral_code: q.data.referralCode, referred_by: q.data.referredBy }
      : null,
  };
}
