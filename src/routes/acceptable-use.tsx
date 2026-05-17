import { createFileRoute } from "@tanstack/react-router";
import { LegalLayout, H2, P, UL } from "@/components/LegalLayout";

export const Route = createFileRoute("/acceptable-use")({
  component: AcceptableUsePage,
  head: () => ({
    meta: [
      { title: "Acceptable Use Policy — PMOfix" },
      { name: "description", content: "What you can and cannot do on PMOfix." },
    ],
  }),
});

function AcceptableUsePage() {
  return (
    <LegalLayout title="Acceptable Use Policy" updated="May 17, 2026">
      <P>By using PMOfix, you agree not to:</P>
      <UL>
        <li>Violate any law or third-party right.</li>
        <li>Submit content that is unlawful, harmful, abusive, harassing, defamatory, or hateful.</li>
        <li>Upload malware, exploit vulnerabilities, or attempt to gain unauthorized access.</li>
        <li>Scrape, harvest, or otherwise extract data from the Service except as expressly allowed.</li>
        <li>Resell, sublicense, or commercially redistribute the Service or its output without our written consent.</li>
        <li>Use the AI features to generate content that infringes IP, impersonates real people, or produces sexual content involving minors.</li>
        <li>Submit another person's personal data without lawful basis.</li>
        <li>Interfere with or disrupt the integrity or performance of the Service.</li>
      </UL>

      <H2>Enforcement</H2>
      <P>
        We may remove content and suspend or terminate accounts that violate this Policy, with or
        without notice. Severe or repeated violations may be reported to authorities.
      </P>

      <H2>Reporting</H2>
      <P>
        Report abuse to{" "}
        <a className="text-gold hover:underline" href="mailto:support@affiliateprogrampro.com">
          support@affiliateprogrampro.com
        </a>
        .
      </P>
    </LegalLayout>
  );
}
