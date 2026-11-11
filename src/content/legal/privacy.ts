import { SITE, operatorName } from "@/config/site";
import type { LegalDocument } from "./types";

/**
 * PRIVACY POLICY
 *
 * ⚠ A thorough starting template written around the Nigeria Data Protection Act 2023 (NDPA), with
 * GDPR-style rights for people elsewhere. It is NOT legal advice — have a qualified Nigerian
 * lawyer / your Data Protection Compliance Organisation review it, and confirm any registration or
 * audit duties with the Nigeria Data Protection Commission (NDPC). Keep it TRUE: if you add
 * analytics, email tools, recording, or change a provider or region, update this file and bump
 * LEGAL_VERSIONS.privacy in src/config/legal.ts.
 */
export function buildPrivacy(): LegalDocument {
  const company = operatorName();
  const name = SITE.name;
  const contact = SITE.contactEmail
    ? `${SITE.contactEmail}, or through our Contact page (choose "Privacy")`
    : `our Contact page (choose "Privacy")`;

  return {
    title: "Privacy Policy",
    summary: `How ${name} collects, uses, shares and protects personal information — and the rights you have over it.`,
    sections: [
      {
        id: "who",
        title: "1. Who we are and what this covers",
        blocks: [
          {
            p: `${company} ("${name}", "we", "us") runs the ${name} website and services. This policy explains how we handle personal information of tutors, course learners, students who join a class or quiz, and visitors.`,
          },
          {
            p: 'It is written to follow the Nigeria Data Protection Act, 2023 (the "NDPA") and, where it applies to you, other data-protection laws such as the GDPR.',
          },
        ],
      },
      {
        id: "roles",
        title: "2. Our role: controller and processor",
        blocks: [
          {
            ul: [
              `For tutor and learner accounts, website visitors, contact messages and security records, ${company} is the data controller — we decide why and how that information is used.`,
              "For student information a tutor collects through a class or quiz (name, phone or matric number, attendance, answers, scores), the tutor or their institution is the data controller. We act as their data processor and handle that information only to provide the Service and on their instructions.",
            ],
          },
          {
            note: "If you are a student and want to see, correct or delete your information, ask your tutor first. You can also contact us and we will help you reach the right person.",
          },
        ],
      },
      {
        id: "collect",
        title: "3. Information we collect",
        blocks: [
          {
            table: {
              head: ["Who", "What we collect", "How"],
              rows: [
                [
                  "Tutors & learners",
                  "Name, email address, password (stored only as a one-way hash by our authentication provider), plan, referral code, the Terms/Privacy versions you accepted and when, content you create (quizzes, courses, class settings, files).",
                  "From you when you sign up and use the Service.",
                ],
                [
                  "Students (class)",
                  "Name, phone number or matric number, your consent record, admission status, attendance (time present and last-seen times while a live class is open).",
                  "From you when you join a class; attendance is measured automatically while you are in the live room.",
                ],
                [
                  "Students (quiz)",
                  "Name, phone or matric number, consent record, answers, scores and answer times.",
                  "From you when you join and play a quiz.",
                ],
                [
                  "Live classes",
                  "Audio, video, screen-share and chat while you take part. We do not record live classes. A tutor or participant might record on their own device — see the Terms.",
                  "Processed in real time by our video provider.",
                ],
                [
                  "Everyone",
                  "Messages you send through our contact form (name, email, message); technical and security data such as a one-way hash of your IP address, browser type, timestamps and error logs.",
                  "From you, and automatically when you use the Service.",
                ],
              ],
            },
          },
          {
            p: "We do not ask for payment-card details inside the Service. Do not put sensitive information (health, religion, government ID numbers) in names, notes or messages.",
          },
        ],
      },
      {
        id: "use",
        title: "4. How we use it, and our lawful bases",
        blocks: [
          {
            table: {
              head: ["Purpose", "Lawful basis (NDPA)"],
              rows: [
                [
                  "Create and run your account; provide classes, quizzes, courses, attendance and analytics",
                  "Performance of our contract with you / the tutor's contract or legitimate interest",
                ],
                [
                  "Record that you accepted the Terms and Privacy Policy",
                  "Legal obligation and our legitimate interest in proving consent",
                ],
                [
                  "Secure the Service: prevent abuse, fraud and attacks (rate limiting, audit logs)",
                  "Legitimate interests",
                ],
                [
                  "Respond to your messages and support requests",
                  "Legitimate interests / your request",
                ],
                [
                  "Run the referral programme and (when available) billing",
                  "Contract and legal obligation (tax and accounting)",
                ],
                [
                  "Send service messages such as verification and password-reset emails",
                  "Contract / legitimate interests",
                ],
                [
                  "Improve reliability and fix errors",
                  "Legitimate interests (we use aggregate and error data, not advertising profiles)",
                ],
                [
                  "Student information in a tutor's class or quiz",
                  "Chosen by the tutor, typically consent, performance of the class, or legitimate interest — recorded when you tick the consent box to join",
                ],
              ],
            },
          },
          {
            p: "We do not sell personal information. We do not use it for advertising or profiling, and we make no decisions about you by solely automated means that have legal or similarly significant effects. Quiz scoring and attendance thresholds are calculated by rules the tutor sets, and the tutor decides what they mean.",
          },
        ],
      },
      {
        id: "sharing",
        title: "5. Who we share it with",
        blocks: [
          { p: "We share personal information only as needed to run the Service:" },
          {
            ul: [
              "Tutors: a tutor can see the names, phone or matric numbers, attendance and quiz results of students in their own classes and quizzes. A class rep chosen by the tutor sees a masked version of identifiers.",
              "Service providers (processors) that host and power the Service under contract: database, authentication and file-storage hosting (Neon); application hosting (Vercel); and live video (Daily). Our authentication provider also sends the verification and password-reset emails you request.",
              "Authorities, advisers and successors: where the law requires, to protect rights, safety or security, or in a business transfer — and we will tell you if ownership of your data changes.",
            ],
          },
          {
            p: "Participants in a live class can see and hear each other as they choose to share. Leaderboards show names and scores to others in the same quiz, but never phone or matric numbers.",
          },
        ],
      },
      {
        id: "transfers",
        title: "6. Transfers outside Nigeria",
        blocks: [
          {
            p: "Our providers may store or process information in other countries, including the United States and Europe. Where that happens we rely on appropriate safeguards required by the NDPA — such as contractual data-protection commitments, adequacy decisions or standard contractual clauses — and ask providers to protect it to a comparable standard.",
          },
        ],
      },
      {
        id: "retention",
        title: "7. How long we keep information",
        blocks: [
          {
            ul: [
              "Account and content: until you delete it or your account. Deleting your account permanently deletes the content it owns, including the students, attendance and quiz results inside it.",
              "Student information: until the tutor removes the student, the class or quiz, or deletes their account.",
              "Rate-limiting counters: about one day.",
              "Contact messages: as long as needed to deal with your request and keep reasonable records.",
              "Terms and Privacy acceptance records and security/audit records: kept for as long as needed to prove consent and protect the Service, and may be retained in anonymised form after an account is deleted.",
              "Billing and referral records: kept for the period tax and accounting law requires, detached from your profile when you delete your account.",
              "Backups: our database provider keeps point-in-time history for a limited period, after which deleted data ages out.",
            ],
          },
        ],
      },
      {
        id: "security",
        title: "8. How we protect information",
        blocks: [
          { p: "We use layered, technical and organisational measures, including:" },
          {
            ul: [
              "encryption in transit (HTTPS/TLS) and encryption at rest by our infrastructure providers;",
              "short-lived, cryptographically verified sign-in tokens; the browser never connects directly to our database;",
              "a least-privilege database role with row-level security, so one tutor's data is isolated from another's even if application code has a fault;",
              "signed, expiring session tokens for students, so a name on a leaderboard cannot be used to act as that student;",
              "private file storage with short-lived access links, never permanent public URLs;",
              "rate limiting, input validation, strict content-security and browser-security headers, and audit logging of sensitive actions;",
              "IP addresses used for abuse prevention are stored only as salted one-way hashes;",
              "restricted staff access on a need-to-know basis.",
            ],
          },
          {
            p: "No online service is perfectly secure. If a personal-data breach occurs that is likely to put people at risk, we will notify the Nigeria Data Protection Commission and, where required, the people affected, within the time the NDPA requires (generally 72 hours for the regulator).",
          },
        ],
      },
      {
        id: "rights",
        title: "9. Your rights",
        blocks: [
          { p: "Subject to the law, you can:" },
          {
            ul: [
              "ask for access to the personal information we hold about you;",
              "ask us to correct inaccurate or incomplete information;",
              "ask us to delete it, or to restrict how it is used;",
              "receive your information in a portable format;",
              "object to processing based on legitimate interests, and withdraw consent at any time (this does not affect earlier lawful processing);",
              "not be subject to solely automated decisions with significant effects (we do not make such decisions).",
            ],
          },
          {
            p:
              "Tutors can export and permanently delete their data themselves from Account settings. Students and others can contact the tutor who runs their class, or us through " +
              contact +
              ". We may need to verify who you are, and will respond within the time the law allows (normally one month).",
          },
          {
            p: "You also have the right to complain to the Nigeria Data Protection Commission (NDPC), or to your local data-protection authority if you live elsewhere. We would appreciate the chance to resolve your concern first.",
          },
        ],
      },
      {
        id: "children",
        title: "10. Children",
        blocks: [
          {
            p: "Tutor and learner accounts are for adults. Students of any age may be invited to a class by their tutor or institution, who is responsible for having a lawful basis and, for children, the consent of a parent or guardian where the law requires it. Students are asked only for a name and a phone or matric number, and we use the information only to run that class or quiz.",
          },
          {
            p: "If you believe a child's information has been collected without proper authority, contact us and we will help remove it.",
          },
        ],
      },
      {
        id: "storage",
        title: "11. Cookies and similar technologies",
        blocks: [
          {
            p: "We use only what the Service needs to work. We do not use advertising cookies, cross-site trackers or third-party analytics.",
          },
          {
            table: {
              head: ["Item", "Purpose", "Kept"],
              rows: [
                [
                  "Sign-in session cookie (set by our authentication provider)",
                  "Keeps you signed in securely",
                  "Until you sign out or it expires",
                ],
                [
                  "Student session token (browser storage)",
                  "Lets a student return to their class or quiz without re-entering details",
                  "Up to a few months, or until cleared",
                ],
                [
                  "Referral code (browser storage)",
                  "Credits the tutor whose link brought you, if you sign up",
                  "Until you sign up or clear it",
                ],
                [
                  "Sign-up consent note (browser storage)",
                  "Remembers you ticked the consent box while you verify your email",
                  "Up to 48 hours",
                ],
              ],
            },
          },
          {
            p: "You can clear these in your browser settings; the Service may then ask you to sign in or join again.",
          },
        ],
      },
      {
        id: "links",
        title: "12. Other websites",
        blocks: [
          {
            p: "Courses and class materials may link to or embed content from other sites (for example, video platforms). Those sites have their own privacy practices, which we do not control.",
          },
        ],
      },
      {
        id: "changes",
        title: "13. Changes to this policy",
        blocks: [
          {
            p: "We may update this policy as the Service or the law changes. We will update the date at the top and, for material changes, ask signed-in tutors to accept the new version before they continue.",
          },
        ],
      },
      {
        id: "contact",
        title: "14. Contact us",
        blocks: [
          {
            p: `For privacy questions or to exercise your rights, contact ${company} through ${contact}.${SITE.legalAddress ? ` Our address is ${SITE.legalAddress}.` : ""} Our data-protection contact can be reached through the same channel.`,
          },
        ],
      },
    ],
  };
}
