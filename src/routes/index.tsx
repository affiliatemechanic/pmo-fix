import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import logo from "@/assets/pmofix-logo.png";
import { supabase } from "@/integrations/supabase/client";
import { submitAndMatch, type MatchResult } from "@/lib/match.functions";
import { toast } from "sonner";
import type { User } from "@supabase/supabase-js";

function isSystemFallbackMatch(match: MatchResult): boolean {
  return (
    match.verdict === "gap" &&
    match.confidence === "low" &&
    !match.matched_fix_id &&
    (match.headline.includes("match this manually") ||
      match.headline.includes("couldn't auto-match") ||
      match.reasoning.includes("matching engine took too long") ||
      match.reasoning.includes("automatic matcher is taking too long"))
  );
}

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
  "📣 Marketing & Advertising",
  "✍️ Content & Writing",
  "🎥 Video & Media",
  "📧 Email & Communication",
  "🔧 Tech & Software",
  "📊 Business Operations",
  "🛒 eCommerce & Sales",
  "🔍 SEO & Traffic",
  "📱 Social Media",
  "💰 Finance & Payments",
  "🤖 AI & Automation",
  "🌐 Something else entirely",
];

const PLATFORMS = [
  "WordPress", "Shopify / WooCommerce", "Wix / Squarespace",
  "Excel / Google Sheets", "Google Docs / Notion", "YouTube",
  "TikTok / Instagram / Facebook", "Premiere / DaVinci / Final Cut",
  "CapCut / Descript", "Gmail / Outlook",
  "AWeber / Mailchimp / ActiveCampaign", "ClickFunnels / Leadpages / Kajabi",
  "Canva / Photoshop / Figma", "ChatGPT / Claude / Gemini",
  "Zapier / Make / Automation tools", "Stripe / PayPal / Payments",
  "My own custom setup", "None of these",
];

const FREQUENCIES = [
  "😤 Once in a while — but when it does, ugh",
  "🔁 Weekly — it's becoming a ritual",
  "📅 Daily — part of my routine unfortunately",
  "🔥 Constantly — it literally never stops",
];

const COSTS = [
  "😒 Just annoying — no real damage",
  "⏰ Hours of lost time every week",
  "💸 Real money — this is a legit business problem",
  "🚨 It's actively killing my productivity or revenue",
];

const WORK_TYPES = [
  "🧑‍💻 Solo creator or freelancer",
  "🏢 Small business owner",
  "🏦 Agency or consultant",
  "👔 Corporate / enterprise team",
  "😄 Just a human with a problem",
];

const LOADING_LINES = [
  "Matching your PMO to known solutions...",
  "Checking our product fleet...",
  "Searching the affiliate library...",
  "Scoring your problem for build-worthiness...",
  "Almost there...",
];

function Index() {
  const [step, setStep] = useState(1);
  const [pmo, setPmo] = useState("");
  const [category, setCategory] = useState<string | null>(null);
  const [platforms, setPlatforms] = useState<string[]>([]);
  const [platformsOther, setPlatformsOther] = useState("");
  const [frequency, setFrequency] = useState<string | null>(null);
  const [cost, setCost] = useState<string | null>(null);
  const [dreamFix, setDreamFix] = useState("");
  const [firstName, setFirstName] = useState("");
  const [email, setEmail] = useState("");
  const [workType, setWorkType] = useState<string | null>(null);

  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loadingLine, setLoadingLine] = useState(0);
  const [match, setMatch] = useState<MatchResult | null>(null);
  const runMatch = useServerFn(submitAndMatch);

  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    if (user?.email) setEmail(user.email);
  }, [user]);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      setUser(data.session?.user ?? null);
      if (data.session) {
        const { data: roles } = await supabase
          .from("user_roles").select("role").eq("user_id", data.session.user.id);
        setIsAdmin(!!roles?.some((r) => r.role === "admin"));
      }
    });
    const { data: sub } = supabase.auth.onAuthStateChange(async (_e, session) => {
      setUser(session?.user ?? null);
      if (session) {
        const { data: roles } = await supabase
          .from("user_roles").select("role").eq("user_id", session.user.id);
        setIsAdmin(!!roles?.some((r) => r.role === "admin"));
      } else setIsAdmin(false);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!saving) return;
    const id = setInterval(() => setLoadingLine((i) => (i + 1) % LOADING_LINES.length), 2000);
    return () => clearInterval(id);
  }, [saving]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    toast.success("Signed out.");
  };

  const togglePlatform = (p: string) =>
    setPlatforms((prev) => (prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]));

  const submit = async () => {
    const emailOk = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim());
    if (!emailOk) {
      toast.error("Please enter a valid email so we can send your fix.");
      return;
    }
    const submissionId = crypto.randomUUID();
    const submissionPayload = {
      id: submissionId,
      description: pmo.trim(),
      email: email.trim(),
      category,
      platforms: platforms.length ? platforms : null,
      platforms_other: platformsOther.trim() || null,
      frequency,
      cost_impact: cost,
      dream_fix: dreamFix.trim() || null,
      first_name: firstName.trim() || null,
      work_type: workType,
      user_id: user?.id ?? null,
    };

    // Never put the user behind the network/AI path. Confirm the submission
    // immediately, then persist and match in the background.
    setSaving(false);
    setMatch(null);
    setSubmitted(true);

    void (async () => {
      try {
        const { error: saveError } = await supabase.from("pmo_submissions").insert(submissionPayload);
        if (saveError && saveError.code !== "23505") {
          console.warn("Client-side submission save failed; server matcher will retry:", saveError);
        }

        const result = await runMatch({ data: submissionPayload });
        if (!isSystemFallbackMatch(result)) {
          setMatch(result);
        }
      } catch (err) {
        console.warn("Submission background processing failed after fallback was shown:", err);
      }
    })();
  };

  const canQ1 = pmo.trim().length >= 5;
  const canQ3 = !!frequency && !!cost;
  const canSubmit = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim());

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
          {isAdmin && <Link to="/admin" className="hover:text-gold transition">Admin</Link>}
          {user ? (
            <button onClick={handleSignOut} className="hover:text-gold transition">Sign out</button>
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
          <div className="relative flex justify-center">
            <div className="absolute -inset-10 rounded-full bg-gold/10 blur-3xl" />
            <img src={logo} alt="PMOfix crest — We'll Fix It" className="relative w-full max-w-md drop-shadow-2xl" />
          </div>
        </div>
      </section>

      {/* Questionnaire */}
      <section id="start" className="mx-auto max-w-3xl px-6 pb-24">
        <div className="rounded-2xl border border-border bg-card p-8 shadow-crest md:p-12">
          {submitted ? (
            <PostSubmit firstName={firstName} match={match} onReset={() => {
              setSubmitted(false); setStep(1); setMatch(null);
              setPmo(""); setCategory(null); setPlatforms([]); setPlatformsOther("");
              setFrequency(null); setCost(null); setDreamFix(""); setFirstName(""); setWorkType(null);
            }} />
          ) : saving ? (
            <LoadingState line={LOADING_LINES[loadingLine]} />
          ) : (
            <>
              <StepHeader step={step} />

              {step === 1 && (
                <div>
                  <h2 className="font-display text-3xl font-black italic text-cream md:text-4xl">
                    "OK. Let it out."
                  </h2>
                  <p className="mt-3 text-muted-foreground">
                    Don't sugarcoat it. The more specific you are, the better we can fix it.
                  </p>
                  <label className="mt-6 block text-xs uppercase tracking-[0.2em] text-gold">
                    What's pissing you off?
                  </label>
                  <textarea
                    value={pmo}
                    onChange={(e) => setPmo(e.target.value)}
                    placeholder="Every time I try to _______, it takes forever because _______ and I end up _______..."
                    rows={5}
                    maxLength={5000}
                    className="mt-2 w-full resize-none rounded-lg border border-border bg-input/40 p-4 text-base text-cream placeholder:text-muted-foreground/60 focus:border-gold focus:outline-none focus:ring-2 focus:ring-gold/40"
                  />
                  <p className="mt-2 text-xs text-muted-foreground">
                    No word limit. Vent away. We've heard worse. 😄
                  </p>

                  <div className="mt-6">
                    <div className="mb-3 text-sm text-muted-foreground">
                      What's the closest category? <span className="italic">(helps us find your fix faster)</span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {CATEGORIES.map((c) => (
                        <Chip key={c} active={category === c} onClick={() => setCategory(category === c ? null : c)}>
                          {c}
                        </Chip>
                      ))}
                    </div>
                  </div>

                  <Nav
                    onNext={() => setStep(2)}
                    nextDisabled={!canQ1}
                    transition="Got it. Now tell us where this is happening..."
                  />
                </div>
              )}

              {step === 2 && (
                <div>
                  <h2 className="font-display text-3xl font-black italic text-cream md:text-4xl">
                    "Where's the crime scene?"
                  </h2>
                  <p className="mt-3 text-muted-foreground">
                    Which tools or platforms are involved in this mess?
                  </p>
                  <div className="mt-6 mb-3 text-sm text-muted-foreground">
                    Select everything that applies <span className="italic">(click to highlight)</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {PLATFORMS.map((p) => (
                      <Chip key={p} active={platforms.includes(p)} onClick={() => togglePlatform(p)}>
                        {p}
                      </Chip>
                    ))}
                  </div>

                  <label className="mt-6 block text-xs uppercase tracking-[0.2em] text-gold">
                    Anything else? Type it here.
                  </label>
                  <input
                    value={platformsOther}
                    onChange={(e) => setPlatformsOther(e.target.value)}
                    placeholder="Also happens in..."
                    maxLength={500}
                    className="mt-2 w-full rounded-lg border border-border bg-input/40 p-3 text-base text-cream placeholder:text-muted-foreground/60 focus:border-gold focus:outline-none focus:ring-2 focus:ring-gold/40"
                  />

                  <Nav
                    onBack={() => setStep(1)}
                    onNext={() => setStep(3)}
                    transition="Noted. How bad is it actually?"
                  />
                </div>
              )}

              {step === 3 && (
                <div>
                  <h2 className="font-display text-3xl font-black italic text-cream md:text-4xl">
                    "On a scale of 'mildly annoying' to 'I want to flip my desk'..."
                  </h2>
                  <p className="mt-3 text-muted-foreground">
                    Help us understand how much this is actually costing you.
                  </p>

                  <div className="mt-6">
                    <div className="mb-3 text-sm text-muted-foreground">How often does this happen?</div>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {FREQUENCIES.map((f) => (
                        <PickButton key={f} active={frequency === f} onClick={() => setFrequency(f)}>
                          {f}
                        </PickButton>
                      ))}
                    </div>
                  </div>

                  <div className="mt-6">
                    <div className="mb-3 text-sm text-muted-foreground">What's it actually costing you?</div>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {COSTS.map((c) => (
                        <PickButton key={c} active={cost === c} onClick={() => setCost(c)}>
                          {c}
                        </PickButton>
                      ))}
                    </div>
                  </div>

                  <Nav
                    onBack={() => setStep(2)}
                    onNext={() => setStep(4)}
                    nextDisabled={!canQ3}
                    transition="OK we feel that. Now — what would the perfect fix actually look like?"
                  />
                </div>
              )}

              {step === 4 && (
                <div>
                  <h2 className="font-display text-3xl font-black italic text-cream md:text-4xl">
                    "Magic wand time."
                  </h2>
                  <p className="mt-3 text-muted-foreground">
                    Don't worry about whether it exists. Just describe the ideal version of fixed.
                  </p>
                  <label className="mt-6 block text-xs uppercase tracking-[0.2em] text-gold">
                    If someone handed you the perfect solution tomorrow, what would it do?
                  </label>
                  <textarea
                    value={dreamFix}
                    onChange={(e) => setDreamFix(e.target.value)}
                    placeholder="Ideally it would just _______ without me having to _______ every single time..."
                    rows={5}
                    maxLength={5000}
                    className="mt-2 w-full resize-none rounded-lg border border-border bg-input/40 p-4 text-base text-cream placeholder:text-muted-foreground/60 focus:border-gold focus:outline-none focus:ring-2 focus:ring-gold/40"
                  />
                  <p className="mt-2 text-xs text-muted-foreground">
                    Dream big. This is literally how we decide what to build next.
                  </p>

                  <Nav
                    onBack={() => setStep(3)}
                    onNext={() => setStep(5)}
                    transition="Almost done. Just need to know where to send your fix."
                  />
                </div>
              )}

              {step === 5 && (
                <div>
                  <h2 className="font-display text-3xl font-black italic text-cream md:text-4xl">
                    "Who do we send this to?"
                  </h2>
                  <p className="mt-3 text-muted-foreground">
                    We'll match your PMO to a fix — or tell you honestly if one doesn't exist yet.
                  </p>

                  <div className="mt-6">
                    <label className="block text-xs uppercase tracking-[0.2em] text-gold">
                      What do we call you?
                    </label>
                    <input
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      placeholder="Your first name"
                      maxLength={100}
                      className="mt-2 w-full rounded-lg border border-border bg-input/40 p-3 text-base text-cream placeholder:text-muted-foreground/60 focus:border-gold focus:outline-none focus:ring-2 focus:ring-gold/40"
                    />
                  </div>

                  <div className="mt-4">
                    <label className="block text-xs uppercase tracking-[0.2em] text-gold">
                      Where should we send your fix?
                    </label>
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="your@email.com"
                      maxLength={255}
                      className="mt-2 w-full rounded-lg border border-border bg-input/40 p-3 text-base text-cream placeholder:text-muted-foreground/60 focus:border-gold focus:outline-none focus:ring-2 focus:ring-gold/40"
                    />
                    <p className="mt-2 text-xs text-muted-foreground">
                      No spam. No pitches. Just your fix — and maybe a heads up when we build something for it.
                    </p>
                  </div>

                  <div className="mt-6">
                    <div className="mb-3 text-sm text-muted-foreground">
                      What kind of work do you do? <span className="italic">(optional — helps us match better)</span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {WORK_TYPES.map((w) => (
                        <Chip key={w} active={workType === w} onClick={() => setWorkType(workType === w ? null : w)}>
                          {w}
                        </Chip>
                      ))}
                    </div>
                  </div>

                  <div className="mt-8 flex flex-col items-start gap-3">
                    <div className="flex w-full items-center justify-between gap-3">
                      <button
                        type="button"
                        onClick={() => setStep(4)}
                        className="text-sm uppercase tracking-wider text-muted-foreground hover:text-cream transition"
                      >
                        ← Back
                      </button>
                      <button
                        type="button"
                        onClick={submit}
                        disabled={!canSubmit}
                        className="inline-flex items-center justify-center rounded-lg bg-gold px-6 py-4 text-base font-bold uppercase tracking-wide text-gold-foreground transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        Find My Fix →
                      </button>
                    </div>
                    <p className="text-xs text-muted-foreground italic">
                      We'll scan every solution we know. If it doesn't exist — we'll tell you what we can do about it.
                    </p>
                  </div>
                </div>
              )}
            </>
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
        <div className="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-10 text-sm text-muted-foreground">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="font-display text-lg font-black text-gold">
              PMO<span className="text-foreground">fix</span>
            </div>
            <div className="flex flex-wrap gap-x-5 gap-y-2 text-xs uppercase tracking-wider">
              <Link to="/terms" className="hover:text-gold">Terms</Link>
              <Link to="/privacy" className="hover:text-gold">Privacy</Link>
              <Link to="/refund" className="hover:text-gold">Refund Policy</Link>
              <Link to="/acceptable-use" className="hover:text-gold">Acceptable Use</Link>
              <Link to="/contact" className="hover:text-gold">Contact</Link>
            </div>
          </div>
          <div className="flex flex-col gap-1 border-t border-border pt-6 text-xs md:flex-row md:items-center md:justify-between">
            <div>
              © {new Date().getFullYear()} PMOfix — operated by Affiliate Mechanic, Burnet County, TX.
            </div>
            <div>
              Payments processed by Paddle.com Market Limited (merchant of record).
            </div>
          </div>
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

function StepHeader({ step }: { step: number }) {
  const labels = ["PMO #1", "PMO #2", "PMO #3", "PMO #4", "Last one, we promise."];
  return (
    <div className="mb-4 flex items-center justify-between">
      <div className="text-xs uppercase tracking-[0.25em] text-gold">{labels[step - 1]}</div>
      <div className="flex gap-1.5">
        {[1, 2, 3, 4, 5].map((s) => (
          <span
            key={s}
            className={`h-1.5 w-6 rounded-full transition ${
              s <= step ? "bg-gold" : "bg-border"
            }`}
          />
        ))}
      </div>
    </div>
  );
}

function Chip({
  active, onClick, children,
}: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-4 py-1.5 text-sm transition ${
        active
          ? "border-gold bg-gold text-gold-foreground"
          : "border-border bg-secondary/60 text-muted-foreground hover:border-gold/60 hover:text-cream"
      }`}
    >
      {children}
    </button>
  );
}

function PickButton({
  active, onClick, children,
}: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-lg border px-4 py-3 text-left text-sm transition ${
        active
          ? "border-gold bg-gold/10 text-cream"
          : "border-border bg-secondary/40 text-muted-foreground hover:border-gold/60 hover:text-cream"
      }`}
    >
      {children}
    </button>
  );
}

function Nav({
  onBack, onNext, nextDisabled, transition,
}: { onBack?: () => void; onNext: () => void; nextDisabled?: boolean; transition?: string }) {
  return (
    <div className="mt-8 flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        {onBack ? (
          <button
            type="button"
            onClick={onBack}
            className="text-sm uppercase tracking-wider text-muted-foreground hover:text-cream transition"
          >
            ← Back
          </button>
        ) : <span />}
        <button
          type="button"
          onClick={onNext}
          disabled={nextDisabled}
          className="inline-flex items-center justify-center rounded-lg bg-gold px-6 py-3 text-sm font-bold uppercase tracking-wide text-gold-foreground transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Continue →
        </button>
      </div>
      {transition && (
        <p className="text-xs italic text-muted-foreground">{transition}</p>
      )}
    </div>
  );
}

function LoadingState({ line }: { line: string }) {
  return (
    <div className="py-12 text-center">
      <div className="mx-auto mb-6 h-12 w-12 animate-spin rounded-full border-2 border-gold/30 border-t-gold" />
      <h2 className="font-display text-3xl font-black italic text-cream md:text-4xl">
        Scanning the fix vault...
      </h2>
      <p className="mt-4 text-muted-foreground italic transition-opacity">{line}</p>
    </div>
  );
}

function PostSubmit({
  firstName, match, onReset,
}: { firstName: string; match: MatchResult | null; onReset: () => void }) {
  const verdict = match?.verdict ?? "gap";
  const label =
    verdict === "match" ? "Match found" :
    verdict === "recommended" ? "Recommended fix" :
    "Gap identified";
  const tone =
    verdict === "match" ? "text-gold" :
    verdict === "recommended" ? "text-cream" :
    "text-gold";

  return (
    <div className="py-4">
      <div className={`mb-3 text-xs uppercase tracking-[0.25em] ${tone}`}>{label}</div>
      <h2 className="font-display text-3xl font-black italic text-cream md:text-4xl">
        {match?.headline ?? (firstName ? `Thanks, ${firstName}.` : "Thanks.")}
      </h2>

      {match?.reasoning && (
        <p className="mt-5 text-muted-foreground leading-relaxed">
          {match.reasoning}
        </p>
      )}

      {match?.matched_fix && (
        <div className="mt-6 rounded-xl border border-gold/40 bg-gold/5 p-6">
          <div className="flex items-start gap-4">
            {match.matched_fix.image_url && (
              <img
                src={match.matched_fix.image_url}
                alt={`${match.matched_fix.name} logo`}
                loading="lazy"
                className="h-16 w-16 shrink-0 rounded-lg border border-gold/30 bg-background object-contain p-1"
              />
            )}
            <div className="min-w-0 flex-1">
              <div className="text-xs uppercase tracking-[0.2em] text-gold">
                {match.matched_fix.type.replace(/_/g, " ")}
              </div>
              <h3 className="mt-2 text-2xl font-bold text-cream">{match.matched_fix.name}</h3>
              <p className="mt-2 text-muted-foreground">{match.matched_fix.summary}</p>
              {match.matched_fix.price_note && (
                <div className="mt-3 text-sm text-gold/80">{match.matched_fix.price_note}</div>
              )}
              {match.matched_fix.url && (
                <a
                  href={match.matched_fix.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-4 inline-flex items-center justify-center rounded-lg bg-gold px-5 py-2.5 text-sm font-bold uppercase tracking-wide text-gold-foreground transition hover:brightness-110"
                >
                  Get this fix →
                </a>
              )}
            </div>
          </div>
        </div>
      )}

      {match?.next_steps && match.next_steps.length > 0 && (
        <div className="mt-6">
          <div className="text-xs uppercase tracking-[0.2em] text-gold">Next steps</div>
          <ul className="mt-3 space-y-2">
            {match.next_steps.map((step, i) => (
              <li key={i} className="flex gap-3 text-muted-foreground">
                <span className="text-gold">→</span>
                <span>{step}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {verdict === "gap" && (
        <p className="mt-6 rounded-lg border border-border bg-secondary/40 p-4 text-sm text-muted-foreground">
          No fix exists yet — which means you just found one. We'll review this as a build candidate
          and reach out{firstName ? `, ${firstName}` : ""}.
        </p>
      )}

      <div className="mt-8 flex items-center gap-6">
        <button
          onClick={onReset}
          className="text-sm uppercase tracking-wider text-gold hover:underline"
        >
          ← Submit another PMO
        </button>
        <span className="text-xs text-muted-foreground">
          A copy is on its way to your inbox.
        </span>
      </div>
    </div>
  );
}
