import { createFileRoute } from "@tanstack/react-router";
import { LegalLayout, H2, P, UL } from "@/components/LegalLayout";

export const Route = createFileRoute("/refund")({
  component: RefundPage,
  head: () => ({
    meta: [
      { title: "Refund Policy — PMOfix" },
      { name: "description", content: "Refund terms for PMOfix purchases." },
    ],
  }),
});

function RefundPage() {
  return (
    <LegalLayout title="Refund Policy" updated="May 17, 2026">
      <P>
        We want you to be satisfied with your purchase. Paid products on PMOfix are sold and
        processed by Paddle.com Market Limited, our merchant of record. Refunds are handled by us
        in cooperation with Paddle.
      </P>

      <H2>1. 14-Day Refund Window</H2>
      <P>
        You may request a full refund within <strong>14 days</strong> of your initial purchase for
        any reason. After 14 days, refunds are granted at our discretion, typically only for
        material defects or non-delivery.
      </P>

      <H2>2. Subscriptions</H2>
      <UL>
        <li>You may cancel a subscription at any time. Cancellation stops future renewals.</li>
        <li>Renewal charges are generally non-refundable, but you may request a refund within 7 days of the renewal date if you have not actively used the Service during that period.</li>
        <li>You retain access for the remainder of the billing period after cancellation.</li>
      </UL>

      <H2>3. Digital Goods & Downloads</H2>
      <P>
        One-time purchases of digital goods (templates, downloads, or instant-access tools) are
        refundable within 14 days only if the product is materially defective or not as
        described.
      </P>

      <H2>4. Services & Custom Builds</H2>
      <P>
        Custom build engagements ("we'll fix it for you") are refundable on a pro-rata basis up
        to the point work has commenced. Once a deliverable is shipped, that portion is
        non-refundable.
      </P>

      <H2>5. How to Request a Refund</H2>
      <P>
        Email{" "}
        <a className="text-gold hover:underline" href="mailto:support@affiliateprogrampro.com">
          support@affiliateprogrampro.com
        </a>{" "}
        from the address you used to purchase, with your Paddle order/receipt ID and a brief
        reason. We respond within 2 business days. Approved refunds are returned to the original
        payment method within 5–10 business days by Paddle.
      </P>

      <H2>6. Chargebacks</H2>
      <P>
        Please contact us before filing a chargeback. Most issues can be resolved faster
        directly. Fraudulent chargebacks may result in account termination.
      </P>

      <H2>7. Contact</H2>
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
