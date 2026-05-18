import { sanitizeHtml } from "@/lib/sanitize-html";

export interface FixCardData {
  id?: string;
  name: string;
  type?: string;
  summary: string;
  description?: string | null;
  url?: string | null;
  image_url?: string | null;
  price_note?: string | null;
  categories?: string[] | null;
  platforms?: string[] | null;
  tags?: string[] | null;
}

export function FixCard({ fix, showDescription = false, detailsHref }: {
  fix: FixCardData;
  showDescription?: boolean;
  detailsHref?: string;
}) {
  return (
    <div className="rounded-xl border border-gold/40 bg-gold/5 p-6">
      <div className="flex items-start gap-4">
        {fix.image_url && (
          <img
            src={fix.image_url}
            alt={`${fix.name} logo`}
            loading="lazy"
            className="h-16 w-16 shrink-0 rounded-lg border border-gold/30 bg-background object-contain p-1"
          />
        )}
        <div className="min-w-0 flex-1">
          {fix.type && (
            <div className="text-xs uppercase tracking-[0.2em] text-gold">
              {fix.type.replace(/_/g, " ")}
            </div>
          )}
          <h3 className="mt-2 text-2xl font-bold text-cream">{fix.name}</h3>
          <div
            className="prose-fix mt-2 text-muted-foreground"
            dangerouslySetInnerHTML={{ __html: sanitizeHtml(fix.summary) }}
          />
          {showDescription && fix.description && (
            <div
              className="prose-fix mt-3 text-sm text-muted-foreground"
              dangerouslySetInnerHTML={{ __html: sanitizeHtml(fix.description) }}
            />
          )}
          {fix.price_note && (
            <div className="mt-3 text-sm text-gold/80">{fix.price_note}</div>
          )}
          <div className="mt-4 flex flex-wrap gap-3">
            {fix.url && (
              <a
                href={fix.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center rounded-lg bg-gold px-5 py-2.5 text-sm font-bold uppercase tracking-wide text-gold-foreground transition hover:brightness-110"
              >
                Get this fix →
              </a>
            )}
            {detailsHref && (
              <a
                href={detailsHref}
                className="inline-flex items-center justify-center rounded-lg border border-gold/50 px-5 py-2.5 text-sm font-bold uppercase tracking-wide text-gold transition hover:bg-gold/10"
              >
                Full details
              </a>
            )}
          </div>
          {(fix.categories?.length || fix.platforms?.length || fix.tags?.length) ? (
            <div className="mt-4 flex flex-wrap gap-1 text-[11px] text-muted-foreground">
              {fix.categories?.map((c) => (
                <span key={`c-${c}`} className="rounded bg-secondary/40 px-2 py-0.5">{c}</span>
              ))}
              {fix.platforms?.map((p) => (
                <span key={`p-${p}`} className="rounded bg-secondary/40 px-2 py-0.5">{p}</span>
              ))}
              {fix.tags?.map((t) => (
                <span key={`t-${t}`} className="rounded bg-secondary/40 px-2 py-0.5">#{t}</span>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
