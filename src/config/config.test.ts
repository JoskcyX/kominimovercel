import { describe, expect, it } from "vitest";
import { FREE_FEATURES, FREE_TIER, PRO_FEATURES, PRO_TIER, tierFor } from "./plans";
import { LEGAL_VERSIONS, STUDENT_CONSENT_TAG } from "./legal";
import { buildPrivacy } from "@/content/legal/privacy";
import { buildTerms } from "@/content/legal/terms";

describe("plans", () => {
  it("free classes hold 250 students, with attendance & analytics advertised as free", () => {
    expect(FREE_TIER.maxStudentsPerClass).toBe(250);
    const text = FREE_FEATURES.map((f) => f.text).join(" | ");
    expect(text).toMatch(/250 students/);
    expect(text).toMatch(/attendance/i);
    expect(text).toMatch(/analytics/i);
  });
  it("Pro is strictly bigger than Free", () => {
    expect(PRO_TIER.maxStudentsPerClass).toBeGreaterThan(FREE_TIER.maxStudentsPerClass);
    expect(PRO_TIER.maxUploadMb).toBeGreaterThan(FREE_TIER.maxUploadMb);
  });
  it("features that don't exist yet are labelled 'coming soon', never sold as available", () => {
    const soon = PRO_FEATURES.filter((f) => f.soon).map((f) => f.text.toLowerCase());
    expect(soon.some((t) => t.includes("white-label"))).toBe(true);
    expect(soon.some((t) => t.includes("ai"))).toBe(true);
    expect(soon.some((t) => t.includes("branding"))).toBe(true);
  });
  it("tierFor falls back to Free", () => {
    expect(tierFor(undefined).id).toBe("free");
    expect(tierFor("pro").id).toBe("pro");
  });
});

describe("legal documents", () => {
  it("versions are dates, and the student consent tag records both", () => {
    expect(LEGAL_VERSIONS.terms).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(LEGAL_VERSIONS.privacy).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(STUDENT_CONSENT_TAG).toContain(LEGAL_VERSIONS.terms);
    expect(STUDENT_CONSENT_TAG).toContain(LEGAL_VERSIONS.privacy);
  });
  it.each([
    ["terms", buildTerms],
    ["privacy", buildPrivacy],
  ] as const)("%s has unique section ids and no empty sections", (_n, build) => {
    const doc = build();
    const ids = doc.sections.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const s of doc.sections) expect(s.blocks.length).toBeGreaterThan(0);
  });
  it("the Terms quote the live plan limits instead of hard-coded numbers", () => {
    const text = JSON.stringify(buildTerms());
    expect(text).toContain(String(FREE_TIER.maxStudentsPerClass));
  });
  it("the Privacy Policy covers the rights and duties it must (NDPA)", () => {
    const text = JSON.stringify(buildPrivacy());
    for (const needle of [
      "Nigeria Data Protection Act",
      "Nigeria Data Protection Commission",
      "data controller",
      "data processor",
      "72 hours",
      "Children",
    ]) {
      expect(text).toContain(needle);
    }
  });
});
