# Customising

Everything you're likely to change is in plain files — no code changes needed for most of it.

| I want to change… | Edit |
| --- | --- |
| Product name, tagline, header/footer links | `src/config/site.ts` |
| Company name, address, contact email, governing law | env: `VITE_LEGAL_ENTITY`, `VITE_LEGAL_ADDRESS`, `VITE_CONTACT_EMAIL`; law/courts in `src/config/site.ts` |
| Free/Pro limits (students per class = **250**, quizzes, uploads…) and price | `src/config/plans.ts` (`FREE_TIER`, `PRO_TIER`) |
| Pricing-page wording, feature lists, FAQ, "coming soon" tags | `src/config/plans.ts` (`FREE_FEATURES`, `PRO_FEATURES`, `PRICING_FAQ`) |
| Terms of Use / Privacy Policy text | `src/content/legal/terms.ts`, `privacy.ts` |
| Make everyone re-accept the legal documents | bump `LEGAL_VERSIONS` in `src/config/legal.ts` |
| About / How it works / Contact page copy | `src/routes/about.tsx`, `how-it-works.tsx`, `contact.tsx` |
| Turn plan limits off (e.g. until payments exist) | env `PLAN_ENFORCEMENT=off` |
| Colours, fonts, look | `src/styles.css` (unchanged from the original design) |

### Changing the free class size

1. Edit `maxStudentsPerClass` in `FREE_TIER`.
2. Existing classes keep the limit they were created with. To apply the new number to existing free tutors:
   ```sql
   UPDATE public.classes c SET member_limit = 300
   FROM public.profiles p WHERE p.id = c.tutor_id AND p.plan = 'free';
   ```

### Changing a legal document

Edit the text, bump the version, and deploy. Signed-in tutors see a "please review our terms" screen on their next visit; their acceptance (who, which version, when, hashed IP) is stored in `legal_acceptances`. Students accept on every join, and the version is stored on their record.
