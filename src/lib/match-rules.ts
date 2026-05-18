export type KnownExternalRecommendation = {
  name: string;
  url: string;
  why: string;
};

export function getKnownExternalRecommendation(parts: Array<string | null | undefined> | string): KnownExternalRecommendation | null {
  const text = (Array.isArray(parts) ? parts.filter(Boolean).join(" ") : parts).toLowerCase();

  const rules: Array<{ test: RegExp; recommendation: KnownExternalRecommendation }> = [
    {
      test: /youtube|video|transcript|repurpose|blog post|blog posts|generic garbage|voice|tone/,
      recommendation: {
        name: "Castmagic",
        url: "https://www.castmagic.io/",
        why: "It turns long-form audio/video into repurposed written content and gives you more control over tone, prompts, and reusable content assets than a blank-chat AI workflow.",
      },
    },
    {
      test: /notion|pdf|export|formatting|tables?|page numbers?|images shift/,
      recommendation: {
        name: "Notion to PDF via Super or Potion",
        url: "https://super.so/",
        why: "Native Notion PDF export is brittle. Publishing the page first and rendering it through a site layer gives you more predictable layout control before creating the final PDF.",
      },
    },
    {
      test: /calendar|booking|schedule|appointment|calendly/,
      recommendation: {
        name: "Calendly",
        url: "https://calendly.com/",
        why: "It removes the back-and-forth from scheduling and automates reminders, availability, and booking rules.",
      },
    },
    {
      test: /zapier|make|automation|integrat|webhook|copy.*paste|manual transfer/,
      recommendation: {
        name: "Make",
        url: "https://www.make.com/",
        why: "It connects apps and automates repetitive handoff work without forcing you to build a custom integration from scratch.",
      },
    },
  ];

  return rules.find((rule) => rule.test.test(text))?.recommendation ?? null;
}