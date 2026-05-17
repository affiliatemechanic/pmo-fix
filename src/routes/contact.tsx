import { createFileRoute } from "@tanstack/react-router";
import { LegalLayout, H2, P } from "@/components/LegalLayout";

export const Route = createFileRoute("/contact")({
  component: ContactPage,
  head: () => ({
    meta: [
      { title: "Contact — PMOfix" },
      { name: "description", content: "Get in touch with the PMOfix team." },
    ],
  }),
});

function ContactPage() {
  return (
    <LegalLayout title="Contact Us" updated="May 17, 2026">
      <P>
        PMOfix is operated by <strong>Affiliate Mechanic</strong>. We answer every message
        personally — usually within one business day.
      </P>

      <H2>Email</H2>
      <P>
        <a className="text-gold hover:underline" href="mailto:support@affiliateprogrampro.com">
          support@affiliateprogrampro.com
        </a>
      </P>
      <P>
        Use this address for support, refunds, privacy requests, partnership inquiries, and
        anything else.
      </P>

      <H2>Mailing Address</H2>
      <P>
        Affiliate Mechanic<br />
        Burnet County, Texas, USA
      </P>

      <H2>Billing</H2>
      <P>
        Payments are processed by our merchant of record, Paddle. For billing receipts or invoice
        adjustments, email us with your Paddle order ID and we'll take care of it.
      </P>
    </LegalLayout>
  );
}
