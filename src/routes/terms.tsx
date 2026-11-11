import { createFileRoute } from "@tanstack/react-router";
import { LegalDocumentView } from "@/components/legal/LegalDocumentView";
import { MarketingLayout } from "@/components/site/MarketingLayout";
import { LEGAL_VERSIONS } from "@/config/legal";
import { SITE } from "@/config/site";
import { buildTerms } from "@/content/legal/terms";

export const Route = createFileRoute("/terms")({
  staticData: { sitemap: true },
  head: () => ({
    meta: [
      { title: `Terms of Use — ${SITE.name}` },
      {
        name: "description",
        content: `The terms that apply when you use ${SITE.name} as a tutor, learner or student.`,
      },
      { property: "og:title", content: `Terms of Use — ${SITE.name}` },
    ],
  }),
  component: () => (
    <MarketingLayout>
      <LegalDocumentView doc={buildTerms()} version={LEGAL_VERSIONS.terms} />
    </MarketingLayout>
  ),
});
