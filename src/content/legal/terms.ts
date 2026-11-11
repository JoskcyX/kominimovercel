import { SITE, operatorName } from "@/config/site";
import { FREE_TIER, PRO_TIER, REFERRAL_SPLIT, proPriceLabel } from "@/config/plans";
import type { LegalDocument } from "./types";

/**
 * TERMS OF USE
 *
 * ⚠ This is a thorough starting template written for an education platform operating from Nigeria.
 * It is NOT legal advice. Have a qualified Nigerian lawyer review it (and the Privacy Policy)
 * before launch. After any material change, bump LEGAL_VERSIONS.terms in src/config/legal.ts so
 * every tutor must accept the new version.
 */
export function buildTerms(): LegalDocument {
  const company = operatorName();
  const name = SITE.name;
  const contact = SITE.contactEmail
    ? `${SITE.contactEmail} or our Contact page`
    : "our Contact page";

  return {
    title: "Terms of Use",
    summary: `The rules for using ${name}: what you can expect from us, and what we expect from tutors and students.`,
    sections: [
      {
        id: "acceptance",
        title: "1. Agreeing to these Terms",
        blocks: [
          {
            p: `These Terms of Use ("Terms") are an agreement between you and ${company} ("${name}", "we", "us"). They apply when you create a tutor account, join a class or quiz as a student, browse or enrol in a course, or otherwise use our website and services (the "Service").`,
          },
          {
            p: "By ticking the box to accept, creating an account, or joining a class or quiz, you confirm that you have read these Terms and our Privacy Policy and agree to be bound by them. If you do not agree, do not use the Service.",
          },
          {
            p: "If you use the Service for an organisation (such as a school, university or training company), you confirm you have authority to accept these Terms on its behalf.",
          },
        ],
      },
      {
        id: "eligibility",
        title: "2. Who can use the Service",
        blocks: [
          {
            ul: [
              "Tutor and course-learner accounts are for people aged 18 or over, or the age of majority where they live.",
              "Students may join a class or quiz through a link or code supplied by their tutor. If a student is under 18, the tutor or institution that invites them is responsible for obtaining any parental or guardian consent the law requires.",
              "You must not use the Service if you have been suspended or removed from it, or if the law forbids you from doing so.",
            ],
          },
        ],
      },
      {
        id: "service",
        title: "3. What the Service does",
        blocks: [
          {
            p: `${name} lets tutors host live video classes, take attendance automatically, run timed quizzes with leaderboards, share materials, and publish courses. Students join without creating an account, using a link or code, their name, and a phone or matriculation number.`,
          },
          {
            p: 'We improve the Service continuously. Features may change, be limited, or be withdrawn, and some are labelled "coming soon" or "beta". We do not promise that any feature will be available in the future.',
          },
        ],
      },
      {
        id: "accounts",
        title: "4. Your account and security",
        blocks: [
          {
            ul: [
              "Give accurate information and keep it up to date.",
              "Keep your password confidential. You are responsible for activity under your account until you tell us it has been compromised.",
              "Tell us promptly at " + contact + " if you suspect unauthorised access.",
              "Do not share your account, and do not publish class or quiz codes where people who should not attend can find them.",
            ],
          },
        ],
      },
      {
        id: "tutor-duties",
        title: "5. Tutor responsibilities",
        blocks: [
          {
            p: "Tutors decide why and how their students' personal information is used. For the student information a tutor collects through the Service (names, phone or matric numbers, attendance, answers and scores), the tutor is the data controller and we act as the tutor's processor. As a tutor you agree that you will:",
          },
          {
            ul: [
              "have a lawful basis for collecting that information and tell your students what you collect and why;",
              "obtain any consent required by law before involving a child or anyone who cannot consent for themselves;",
              "use attendance, scores and analytics fairly, and remain responsible for any academic or disciplinary decision you make with them;",
              "not record a live class unless every participant has been told and, where the law requires, has agreed;",
              "respond to student requests about their data, and delete students from your classes when asked;",
              "only upload and share material that you own or have the right to use.",
            ],
          },
        ],
      },
      {
        id: "student-duties",
        title: "6. Student responsibilities",
        blocks: [
          {
            ul: [
              "Join using your own real name and your own phone or matric number. Do not impersonate anyone.",
              "Do not share your personal join link or session with others, and do not answer for another person.",
              "Behave respectfully in live classes and do not disrupt them.",
              "Do not attempt to see answers in advance, tamper with timing or scores, or otherwise cheat the system.",
            ],
          },
        ],
      },
      {
        id: "acceptable-use",
        title: "7. Acceptable use",
        blocks: [
          { p: "You must not use the Service to, or allow anyone else to:" },
          {
            ul: [
              "break any law or infringe anyone's rights, including copyright, privacy and data-protection rights;",
              "upload or share unlawful, defamatory, abusive, discriminatory, sexually explicit, or hateful material, or anything that exploits or endangers children;",
              "harass, threaten or bully any person;",
              "send spam, run scams, or collect personal information about others without authority;",
              "introduce malware, or probe, scan, overload, reverse-engineer or attempt to bypass the security or rate limits of the Service;",
              "access another person's account, class, quiz or data;",
              "automate sign-ups, joins or answers, or use bots to distort quiz results;",
              "resell or sublicense the Service, or use it to build a competing product, without our written permission.",
            ],
          },
          {
            p: "We may remove content and suspend or terminate access where we reasonably believe these rules have been broken.",
          },
        ],
      },
      {
        id: "content",
        title: "8. Content and intellectual property",
        blocks: [
          {
            p: `You keep ownership of the quizzes, questions, course material, files and other content you create or upload ("Your Content"). You give ${company} a worldwide, non-exclusive, royalty-free licence to host, store, process, display and transmit Your Content solely to provide and secure the Service for you and the people you invite.`,
          },
          {
            p: `The Service itself, including its software, design, name and branding, belongs to ${company} or its licensors. These Terms give you no right to use our name or marks without permission.`,
          },
          {
            p: "If you give us feedback or suggestions, we may use them freely without owing you anything.",
          },
          {
            p: `If you believe content on the Service infringes your rights, tell us through ${contact} with enough detail to locate it, and we will review it promptly.`,
          },
        ],
      },
      {
        id: "plans",
        title: "9. Plans, fees and limits",
        blocks: [
          {
            p: `The Free plan is free for as long as we offer it. It currently includes live classes of up to ${FREE_TIER.maxStudentsPerClass} approved students per class, automatic attendance, and quiz and student analytics, with limits of ${FREE_TIER.maxQuizzes} quizzes, ${FREE_TIER.maxQuestionsPerQuiz} questions per quiz, ${FREE_TIER.maxCourses} published courses and ${FREE_TIER.maxUploadMb} MB per uploaded file.`,
          },
          {
            p: `The Pro plan is currently priced at ${proPriceLabel()} and raises or removes those limits (for example, classes of up to ${PRO_TIER.maxStudentsPerClass.toLocaleString("en")} students). Paid checkout may not be available yet; where it is not, we may set up Pro accounts manually.`,
          },
          {
            ul: [
              "We may change plans, limits and prices. We will give reasonable notice of any change that reduces what a paying customer receives, and price changes apply from the next billing period.",
              "Content you created is never deleted just because you are over a limit; you simply cannot add more until you are back within it or upgrade.",
              "Fees, when charged, are non-refundable except where the law requires otherwise or we say so in writing. You are responsible for any taxes.",
            ],
          },
        ],
      },
      {
        id: "referrals",
        title: "10. Referral programme",
        blocks: [
          {
            p: `Tutors may share a personal referral link. When a tutor who joined through your link subscribes to a paid plan, you may earn ${Math.round(REFERRAL_SPLIT * 100)}% of the subscription fees they pay. Earnings are recorded as pending and become payable only when payouts are available and any minimum requirements are met.`,
          },
          {
            ul: [
              "Do not refer yourself, create fake accounts, or use misleading, spam or paid-search tactics. Fraudulent or abusive referrals forfeit earnings and may lead to suspension.",
              "We may change or end the programme at any time; earnings already confirmed for completed payments will be honoured.",
              "You are responsible for any tax on referral income.",
            ],
          },
        ],
      },
      {
        id: "third-parties",
        title: "11. Third-party services",
        blocks: [
          {
            p: "The Service relies on other providers, including infrastructure and database hosting, authentication, file storage, and live video. Their terms and privacy practices also apply to the parts of the Service they power, and we are not responsible for their independent acts. Links to other websites are provided for convenience; we do not control or endorse them.",
          },
        ],
      },
      {
        id: "privacy",
        title: "12. Privacy",
        blocks: [
          {
            p: "Our Privacy Policy explains what personal information we collect, how we use and protect it, and your rights. It forms part of these Terms.",
          },
        ],
      },
      {
        id: "availability",
        title: "13. Availability and changes",
        blocks: [
          {
            p: "We work to keep the Service available and secure, but we do not guarantee it will be uninterrupted or error-free. Live video quality depends on your connection, devices and our providers. Plan important sessions with a back-up in mind. We may perform maintenance or make changes at any time.",
          },
        ],
      },
      {
        id: "termination",
        title: "14. Suspension and ending your account",
        blocks: [
          {
            ul: [
              "You can stop using the Service at any time and can export and permanently delete your account data from your account settings.",
              "We may suspend or end access, with notice where practical, if you break these Terms, create risk or legal exposure for us or others, or if required by law.",
              "When an account is deleted, the content it owns is deleted, subject to short-term backups and any records we must keep by law. Sections that by nature should survive (including ownership, disclaimers, liability and governing law) continue after termination.",
            ],
          },
        ],
      },
      {
        id: "disclaimers",
        title: "15. Disclaimers",
        blocks: [
          {
            p: `The Service is provided "as is" and "as available". To the fullest extent permitted by law, we disclaim all implied warranties, including merchantability, fitness for a particular purpose and non-infringement.`,
          },
          {
            p: "Attendance records, scores and analytics are tools to help tutors. We do not guarantee that they are error-free or suitable as the sole basis for any assessment, certification or disciplinary decision. We do not provide educational, legal or professional advice, and we do not guarantee any learning outcome.",
          },
        ],
      },
      {
        id: "liability",
        title: "16. Limit of liability",
        blocks: [
          {
            p: `Nothing in these Terms excludes or limits liability that cannot lawfully be excluded or limited, including liability for death or personal injury caused by negligence, or for fraud.`,
          },
          {
            p: `Subject to that, and to the fullest extent permitted by law: (a) ${company} is not liable for indirect, incidental, special or consequential loss, loss of profits, goodwill, data or opportunity; and (b) our total liability for any claim relating to the Service is limited to the greater of the amount you paid us in the 12 months before the claim arose, or ₦50,000 (or its equivalent). Free-plan users agree that the Service is provided without charge and on this basis.`,
          },
        ],
      },
      {
        id: "indemnity",
        title: "17. Your responsibility for claims",
        blocks: [
          {
            p: `You agree to compensate ${company} for losses, claims and reasonable costs arising from your breach of these Terms, Your Content, or your misuse of the Service, including a tutor's failure to meet the responsibilities in section 5. We will tell you promptly about any claim and allow you reasonable involvement in its defence.`,
          },
        ],
      },
      {
        id: "law",
        title: "18. Governing law and disputes",
        blocks: [
          {
            p: `These Terms are governed by the laws of ${SITE.governingLaw}. Please contact us first so we can try to resolve any dispute informally within 30 days. If we cannot, ${SITE.governingCourts} have jurisdiction, except where mandatory consumer or data-protection law gives you the right to bring a claim elsewhere.`,
          },
        ],
      },
      {
        id: "changes",
        title: "19. Changes to these Terms",
        blocks: [
          {
            p: "We may update these Terms from time to time. For material changes, we will ask signed-in tutors to accept the new version before they continue, and we will update the effective date shown at the top of this page. If you do not agree to a change, you should stop using the Service and may delete your account.",
          },
        ],
      },
      {
        id: "general",
        title: "20. General",
        blocks: [
          {
            ul: [
              "These Terms and the Privacy Policy are the entire agreement between you and us about the Service.",
              "If a part of these Terms is unenforceable, the rest remains in effect.",
              "Our failure to enforce a right is not a waiver of it.",
              "You may not transfer your rights under these Terms without our consent; we may transfer ours in connection with a merger, acquisition or sale of the business.",
            ],
          },
        ],
      },
      {
        id: "contact",
        title: "21. Contact us",
        blocks: [
          {
            p: `Questions about these Terms? Reach us through ${contact}.${SITE.legalAddress ? ` Our address is ${SITE.legalAddress}.` : ""}`,
          },
        ],
      },
    ],
  };
}
