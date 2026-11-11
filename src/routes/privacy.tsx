import { createFileRoute } from "@tanstack/react-router";
import { LegalDocumentView } from "@/components/legal/LegalDocumentView";
import { MarketingLayout } from "@/components/site/MarketingLayout";
import { LEGAL_VERSIONS } from "@/config/legal";
import { SITE } from "@/config/site";
import { buildPrivacy } from "@/content/legal/privacy";

export const Route = createFileRoute("/privacy")({
  staticData: { sitemap: true },
  head: () => ({
    meta: [
      { title: `Privacy Policy — ${SITE.name}` },
      {
        name: "description",
        content: `How ${SITE.name} collects, uses and protects personal information, and your rights.`,
      },
      { property: "og:title", content: `Privacy Policy — ${SITE.name}` },
    ],
  }),
  component: () => (
    <MarketingLayout>
      <LegalDocumentView doc={buildPrivacy()} version={LEGAL_VERSIONS.privacy} />
    </MarketingLayout>
  ),
});
