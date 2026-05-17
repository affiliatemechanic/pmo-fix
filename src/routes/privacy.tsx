import { createFileRoute } from "@tanstack/react-router";
import { LegalLayout, H2, P, UL } from "@/components/LegalLayout";

export const Route = createFileRoute("/privacy")({
  component: PrivacyPage,
  head: () => ({
    meta: [
      { title: "Privacy Policy — PMOfix" },
      { name: "description", content: "How PMOfix collects, uses, and protects your data." },
    ],
  }),
});

function PrivacyPage() {
  return (
    <LegalLayout title="Privacy Policy" updated="May 17, 2026">
      <P>
        Affiliate Mechanic ("we", "us") operates PMOfix and respects your privacy. This Policy
        explains what we collect, how we use it, and your rights.
      </P>

      <H2>1. Information We Collect</H2>
      <UL>
        <li><strong>Account info:</strong> name, email, password hash.</li>
        <li><strong>Submissions:</strong> the workflow problems and context you submit.</li>
        <li><strong>Purchase info:</strong> processed by Paddle (our merchant of record); we receive transaction metadata but not full card numbers.</li>
        <li><strong>Usage data:</strong> IP address, browser, pages viewed, timestamps.</li>
        <li><strong>Cookies:</strong> required for authentication and basic analytics.</li>
      </UL>

      <H2>2. How We Use It</H2>
      <UL>
        <li>To operate, maintain, and improve the Service.</li>
        <li>To generate AI matches between your submission and available fixes.</li>
        <li>To process payments, send receipts, and provide support.</li>
        <li>To send transactional and (with consent) marketing emails.</li>
        <li>To comply with legal obligations and enforce our Terms.</li>
      </UL>

      <H2>3. Sharing</H2>
      <P>We share data only with:</P>
      <UL>
        <li><strong>Paddle</strong> — payment processing and tax compliance (merchant of record).</li>
        <li><strong>Supabase / Lovable Cloud</strong> — hosting and database.</li>
        <li><strong>AI providers (Google, OpenAI via Lovable AI Gateway)</strong> — to generate match results from your submission.</li>
        <li><strong>Email providers</strong> — to deliver transactional and marketing email.</li>
        <li><strong>Authorities</strong> — when required by law.</li>
      </UL>
      <P>We do not sell your personal data.</P>

      <H2>4. International Transfers</H2>
      <P>
        Your data may be processed in the United States and other countries where our service
        providers operate. We rely on standard contractual clauses where applicable.
      </P>

      <H2>5. Retention</H2>
      <P>
        We retain account and submission data for as long as your account is active, and as
        needed to comply with legal obligations or resolve disputes.
      </P>

      <H2>6. Your Rights</H2>
      <P>
        Depending on your jurisdiction (including GDPR for the EU/UK and CCPA for California), you
        may have the right to access, correct, delete, export, or restrict processing of your
        personal data, and to withdraw consent. Email{" "}
        <a className="text-gold hover:underline" href="mailto:support@affiliateprogrampro.com">
          support@affiliateprogrampro.com
        </a>{" "}
        to exercise these rights.
      </P>

      <H2>7. Security</H2>
      <P>
        We use reasonable technical and organizational safeguards, including encryption in transit
        and row-level security on our database. No system is 100% secure.
      </P>

      <H2>8. Children</H2>
      <P>
        The Service is not directed to children under 13 (or 16 in the EU). We do not knowingly
        collect data from them.
      </P>

      <H2>9. Changes</H2>
      <P>
        We may update this Policy. Material changes will be posted here with a new effective date.
      </P>

      <H2>10. Contact</H2>
      <P>
        Affiliate Mechanic<br />
        Burnet County, Texas, USA<br />
        <a className="text-gold hover:underline" href="mailto:support@affiliateprogrampro.com">
          support@affiliateprogrampro.com
        </a>
      </P>
    </LegalLayout>
  );
}
