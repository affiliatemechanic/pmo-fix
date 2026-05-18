import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { FixCard } from "@/components/FixCard";

export const Route = createFileRoute("/fixes/$id")({
  loader: async ({ params }) => {
    const { data, error } = await supabase
      .from("fixes")
      .select("id, name, type, summary, description, url, image_url, price_note, categories, platforms, tags, active")
      .eq("id", params.id)
      .eq("active", true)
      .maybeSingle();
    if (error || !data) throw notFound();
    return { fix: data };
  },
  head: ({ loaderData }) => ({
    meta: loaderData
      ? [
          { title: `${loaderData.fix.name} — PMOfix` },
          { name: "description", content: loaderData.fix.summary.replace(/<[^>]+>/g, "").slice(0, 160) },
          { property: "og:title", content: `${loaderData.fix.name} — PMOfix` },
          { property: "og:description", content: loaderData.fix.summary.replace(/<[^>]+>/g, "").slice(0, 160) },
          ...(loaderData.fix.image_url ? [{ property: "og:image", content: loaderData.fix.image_url }] : []),
        ]
      : [{ title: "Fix not found — PMOfix" }],
  }),
  notFoundComponent: () => (
    <main className="mx-auto max-w-3xl px-6 py-24 text-center">
      <h1 className="font-display text-4xl font-black text-cream">Fix not found</h1>
      <p className="mt-4 text-muted-foreground">This fix may have been removed or deactivated.</p>
      <Link to="/" className="mt-6 inline-block text-gold hover:underline">← Back home</Link>
    </main>
  ),
  errorComponent: ({ error }) => (
    <main className="mx-auto max-w-3xl px-6 py-24 text-center">
      <h1 className="font-display text-3xl font-black text-cream">Something broke</h1>
      <p className="mt-4 text-muted-foreground">{error.message}</p>
      <Link to="/" className="mt-6 inline-block text-gold hover:underline">← Back home</Link>
    </main>
  ),
  component: FixPage,
});

function FixPage() {
  const { fix } = Route.useLoaderData();
  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <Link to="/" className="text-xs uppercase tracking-[0.25em] text-gold hover:underline">← PMOfix</Link>
      <div className="mt-6">
        <FixCard fix={fix} showDescription />
      </div>
    </main>
  );
}
