import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import logo from "@/assets/pmofix-logo.png";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { User } from "@supabase/supabase-js";

export const Route = createFileRoute("/")({
  component: Index,
  head: () => ({
    meta: [
      { title: "PMOfix — Tell us what's pissing you off. We'll fix it." },
      {
        name: "description",
        content:
          "PMO = Pisses Me Off. Describe the thing that slows you down, wastes your time, or makes you want to throw your laptop. We'll fix it.",
      },
      { property: "og:title", content: "PMOfix — We'll Fix It" },
      { property: "og:description", content: "Tell us what's pissing you off. We'll fix it." },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "/" },
    ],
    links: [
      { rel: "canonical", href: "/" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;900&family=Inter:wght@400;500;600;700&display=swap",
      },
    ],
  }),
});

const CATEGORIES = [
  "Marketing", "Content", "Video", "Email", "Tech",
  "Operations", "eCommerce", "SEO", "Social", "Finance", "AI", "Other",
];

function Index() {
  const [pmo, setPmo] = useState("");
  const [category, setCategory] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      setUser(data.session?.user ?? null);
      if (data.session) {
        const { data: roles } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", data.session.user.id);
        setIsAdmin(!!roles?.some((r) => r.role === "admin"));
      }
    });
    const { data: sub } = supabase.auth.onAuthStateChange(async (_e, session) => {
      setUser(session?.user ?? null);
      if (session) {
        const { data: roles } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", session.user.id);
        setIsAdmin(!!roles?.some((r) => r.role === "admin"));
      } else {
        setIsAdmin(false);
      }
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    toast.success("Signed out.");
  };

  return (
    <main className="min-h-screen">
      {/* Top bar */}
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <div className="flex items-center gap-3">
          <div className="font-display text-2xl font-black text-gold tracking-tight">
            PMO<span className="text-foreground">fix</span>
          </div>
        </div>
        <nav className="flex items-center gap-6 text-sm text-muted-foreground">
          <a href="#how" className="hidden hover:text-gold transition md:inline">How it works</a>
          <a href="#options" className="hidden hover:text-gold transition md:inline">Build options</a>
          {isAdmin && (
            <Link to="/admin" className="hover:text-gold transition">Admin</Link>
          )}
          {user ? (
            <button onClick={handleSignOut} className="hover:text-gold transition">
              Sign out
            </button>
          ) : (
            <Link to="/auth" className="rounded-md border border-gold/40 px-3 py-1.5 text-gold hover:bg-gold/10 transition">
              Sign in
            </Link>
          )}
        </nav>
      </header>

      {/* Hero */}
      <section className="mx-auto max-w-6xl px-6 pt-8 pb-20 md:pt-16">
        <div className="grid items-center gap-12 md:grid-cols-2">
          <div>
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-gold/30 bg-gold/5 px-4 py-1.5 text-xs uppercase tracking-[0.2em] text-gold">
              <span className="h-1.5 w-1.5 rounded-full bg-gold" /> PMO = Pisses Me Off
            </div>
            <h1 className="text-5xl font-black leading-[0.95] text-cream md:text-7xl">
              What's <span className="text-gold italic">pissing</span> you off?
            </h1>
            <p className="mt-6 max-w-lg text-lg text-muted-foreground">
              Describe the thing that slows you down, wastes your time, or makes you want to
              throw your laptop. We'll match it to a fix — or build one.
            </p>
          </div>

          {/* Crest */}
          <div className="relative flex justify-center">
            <div className="absolute -inset-10 rounded-full bg-gold/10 blur-3xl" />
            <img
              src={logo}
              alt="PMOfix crest — We'll Fix It"
              className="relative w-full max-w-md drop-shadow-2xl"
            />
          </div>
        </div>
      </section>

      {/* Questionnaire entry */}
      <section id="start" className="mx-auto max-w-3xl px-6 pb-24">
        <div className="rounded-2xl border border-border bg-card p-8 shadow-crest md:p-12">
          {!submitted ? (
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                if (pmo.trim().length < 5) return;
                setSaving(true);
                const { error } = await supabase.from("pmo_submissions").insert({
                  description: pmo.trim(),
                  category,
                  user_id: user?.id ?? null,
                });
                setSaving(false);
                if (error) {
                  toast.error(error.message);
                  return;
                }
                setSubmitted(true);
              }}
            >
              <div className="mb-2 text-xs uppercase tracking-[0.25em] text-gold">
                Step 1 of 5
              </div>
              <h2 className="text-3xl font-black text-cream md:text-4xl">
                Tell us everything. Don't hold back.
              </h2>
              <textarea
                value={pmo}
                onChange={(e) => setPmo(e.target.value)}
                placeholder="It happens every time I try to..."
                rows={5}
                className="mt-6 w-full resize-none rounded-lg border border-border bg-input/40 p-4 text-base text-cream placeholder:text-muted-foreground/60 focus:border-gold focus:outline-none focus:ring-2 focus:ring-gold/40"
              />

              <div className="mt-6">
                <div className="mb-3 text-sm text-muted-foreground">Pick a category (optional)</div>
                <div className="flex flex-wrap gap-2">
                  {CATEGORIES.map((c) => (
                    <button
                      type="button"
                      key={c}
                      onClick={() => setCategory(category === c ? null : c)}
                      className={`rounded-full border px-4 py-1.5 text-sm transition ${
                        category === c
                          ? "border-gold bg-gold text-gold-foreground"
                          : "border-border bg-secondary/60 text-muted-foreground hover:border-gold/60 hover:text-cream"
                      }`}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              </div>

              <button
                type="submit"
                disabled={pmo.trim().length < 5}
                className="mt-8 inline-flex w-full items-center justify-center rounded-lg bg-gold px-6 py-4 text-base font-bold uppercase tracking-wide text-gold-foreground transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40 md:w-auto"
              >
                Fix this →
              </button>
              <p className="mt-4 text-xs text-muted-foreground">
                No spam. No pitches. Just your fix.
              </p>
            </form>
          ) : (
            <div className="py-8 text-center">
              <div className="mb-3 text-xs uppercase tracking-[0.25em] text-gold">Got it</div>
              <h2 className="text-3xl font-black text-cream md:text-4xl">
                We hear you. Now let's match it.
              </h2>
              <p className="mt-4 text-muted-foreground">
                The full 5-step questionnaire and AI match engine ship next. This is the entry.
              </p>
              <button
                onClick={() => { setSubmitted(false); setPmo(""); setCategory(null); }}
                className="mt-8 text-sm uppercase tracking-wider text-gold hover:underline"
              >
                ← Start over
              </button>
            </div>
          )}
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="border-t border-border bg-card/40">
        <div className="mx-auto max-w-6xl px-6 py-20">
          <div className="mb-12 text-center">
            <div className="text-xs uppercase tracking-[0.25em] text-gold">How it works</div>
            <h2 className="mt-3 text-4xl font-black text-cream md:text-5xl">
              Three outcomes. <span className="text-gold italic">Always a win.</span>
            </h2>
          </div>
          <div className="grid gap-6 md:grid-cols-3">
            <Step n="01" title="Match found" body="Your problem already has a fix in our fleet. Get access today." />
            <Step n="02" title="Recommended" body="A trusted tool built exactly for this. We'll point you to it — straight up." />
            <Step n="03" title="Gap identified" body="No fix exists yet? You just found one. Three build paths await." />
          </div>
        </div>
      </section>

      {/* Options */}
      <section id="options" className="mx-auto max-w-6xl px-6 py-24">
        <div className="mb-12">
          <div className="text-xs uppercase tracking-[0.25em] text-gold">If we build it</div>
          <h2 className="mt-3 text-4xl font-black text-cream md:text-5xl">
            Three ways to get your fix.
          </h2>
        </div>
        <div className="grid gap-6 md:grid-cols-3">
          <Option
            tag="Free forever"
            title="We Build It. You Get It Free."
            body="We own the product, sell it to the world. You get it free — forever. Optional royalty per deal."
          />
          <Option
            tag="$5K – $100K+"
            title="Yours. Exclusively. Forever."
            body="Full custom build. You own the IP. One-time fee. Nobody else gets it."
            featured
          />
          <Option
            tag="Rev share"
            title="Let's Split This."
            body="You bring the idea and audience. We bring the build and distribution. Ongoing royalty."
          />
        </div>
      </section>

      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-6 py-10 text-sm text-muted-foreground md:flex-row md:items-center md:justify-between">
          <div className="font-display text-lg font-black text-gold">
            PMO<span className="text-foreground">fix</span>
          </div>
          <div>© {new Date().getFullYear()} PMOfix — Jeffrey Levesque. We'll fix it.</div>
        </div>
      </footer>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border bg-secondary/50 px-3 py-2">
      <span className="text-gold/80">{label}:</span> <span className="text-cream">{value}</span>
    </div>
  );
}

function Step({ n, title, body }: { n: string; title: string; body: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-8 transition hover:border-gold/60">
      <div className="font-display text-5xl font-black text-gold/40">{n}</div>
      <h3 className="mt-4 text-2xl font-bold text-cream">{title}</h3>
      <p className="mt-3 text-muted-foreground">{body}</p>
    </div>
  );
}

function Option({
  tag, title, body, featured,
}: { tag: string; title: string; body: string; featured?: boolean }) {
  return (
    <div
      className={`rounded-xl border p-8 transition ${
        featured
          ? "border-gold bg-gradient-to-b from-gold/10 to-transparent"
          : "border-border bg-card hover:border-gold/60"
      }`}
    >
      <div className="text-xs uppercase tracking-[0.2em] text-gold">{tag}</div>
      <h3 className="mt-3 text-2xl font-bold text-cream">{title}</h3>
      <p className="mt-3 text-muted-foreground">{body}</p>
    </div>
  );
}
