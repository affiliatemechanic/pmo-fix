import { createFileRoute } from "@tanstack/react-router";
import { LegalLayout, H2, P, UL } from "@/components/LegalLayout";

export const Route = createFileRoute("/terms")({
  component: TermsPage,
  head: () => ({
    meta: [
      { title: "Terms of Service — PMOfix" },
      { name: "description", content: "The terms governing your use of PMOfix." },
    ],
  }),
});

function TermsPage() {
  return (
    <LegalLayout title="Terms of Service" updated="May 17, 2026">
      <P>
        These Terms of Service ("Terms") govern your access to and use of PMOfix (the "Service"),
        operated by Affiliate Mechanic ("we", "us", "our"), located in Burnet County, Texas, USA.
        By accessing or using the Service, you agree to be bound by these Terms.
      </P>

      <H2>1. The Service</H2>
      <P>
        PMOfix lets users describe workflow problems ("PMOs") and receive AI-generated
        recommendations for fixes, including internal tools, third-party products, and affiliate
        offers. Some recommendations may be paid products sold by us or by third parties.
      </P>

      <H2>2. Accounts</H2>
      <P>
        You may use parts of the Service without an account. To save submissions, manage
        purchases, or access certain features, you must create an account and keep your
        credentials secure. You are responsible for all activity under your account.
      </P>

      <H2>3. Purchases & Billing</H2>
      <P>
        Paid products are sold and processed by our merchant of record, Paddle.com Market Limited
        ("Paddle"). Paddle handles payment, billing support, and applicable taxes. By purchasing,
        you also agree to Paddle's terms at{" "}
        <a className="text-gold hover:underline" href="https://www.paddle.com/legal/checkout-buyer-terms" target="_blank" rel="noopener noreferrer">
          paddle.com/legal/checkout-buyer-terms
        </a>
        . Subscription products renew automatically until cancelled.
      </P>

      <H2>4. Refunds</H2>
      <P>
        Refunds are handled per our <a className="text-gold hover:underline" href="/refund">Refund Policy</a>.
      </P>

      <H2>5. Acceptable Use</H2>
      <P>
        You agree not to misuse the Service. See our{" "}
        <a className="text-gold hover:underline" href="/acceptable-use">Acceptable Use Policy</a> for details.
      </P>

      <H2>6. Intellectual Property</H2>
      <P>
        The Service, including its software, content, logos, and brand, is owned by Affiliate
        Mechanic and protected by intellectual property law. You retain ownership of content you
        submit, but grant us a worldwide, royalty-free license to use it to operate, improve, and
        promote the Service.
      </P>

      <H2>7. Third-Party Links & Affiliate Disclosure</H2>
      <P>
        The Service contains links to third-party products. Some are affiliate links, meaning we
        may earn a commission if you purchase. We are not responsible for third-party products,
        services, or content.
      </P>

      <H2>8. Disclaimer</H2>
      <P>
        THE SERVICE IS PROVIDED "AS IS" WITHOUT WARRANTIES OF ANY KIND. AI-GENERATED
        RECOMMENDATIONS MAY BE INACCURATE OR INCOMPLETE. YOU USE THEM AT YOUR OWN RISK.
      </P>

      <H2>9. Limitation of Liability</H2>
      <P>
        TO THE MAXIMUM EXTENT PERMITTED BY LAW, AFFILIATE MECHANIC SHALL NOT BE LIABLE FOR ANY
        INDIRECT, INCIDENTAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES. OUR TOTAL LIABILITY FOR ANY
        CLAIM SHALL NOT EXCEED THE AMOUNT YOU PAID US IN THE TWELVE MONTHS PRECEDING THE CLAIM,
        OR USD $100, WHICHEVER IS GREATER.
      </P>

      <H2>10. Termination</H2>
      <P>
        We may suspend or terminate your access at any time for violation of these Terms. You may
        stop using the Service at any time. Provisions that by nature should survive termination
        will survive.
      </P>

      <H2>11. Changes</H2>
      <P>
        We may update these Terms from time to time. Material changes will be posted on this page
        with an updated date. Continued use after changes constitutes acceptance.
      </P>

      <H2>12. Governing Law</H2>
      <P>
        These Terms are governed by the laws of the State of Texas, USA, without regard to
        conflict-of-laws principles. Venue for any dispute lies in the state or federal courts
        located in Burnet County, Texas.
      </P>

      <H2>13. Contact</H2>
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
