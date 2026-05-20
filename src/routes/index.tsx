import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import logo from "@/assets/pmofix-logo.png";
import { supabase } from "@/integrations/supabase/client";
import type { MatchResult } from "@/lib/match.functions";
import { getKnownExternalRecommendation } from "@/lib/match-rules";
import { toast } from "sonner";
import type { User } from "@supabase/supabase-js";
import { FixCard } from "@/components/FixCard";
import { UserMenu } from "@/components/UserMenu";
import { TurnstileWidget } from "@/components/TurnstileWidget";

async function postJson<T = unknown>(url: string, body: Record<string, unknown>): Promise<T> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(json?.error || `Request failed with ${response.status}`);
  }
  return json as T;
}

async function saveDraft(payload: Record<string, unknown>): Promise<{ id: string }> {
  return postJson<{ id: string }>("/api/public/match/draft", payload);
}

function triggerPrematch(id: string): void {
  // Fire-and-forget — runs the AI match in the background while the user
  // finishes the funnel. Failures are non-fatal; finalize will re-run if needed.
  void fetch("/api/public/match/prematch", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id }),
  }).catch(() => {});
}

async function finalizeMatch(payload: Record<string, unknown>): Promise<MatchResult> {
  return postJson<MatchResult>("/api/public/match/finalize", payload);
}


function clientFallbackMatch(submissionId: string, parts: Array<string | null | undefined> = []): MatchResult {
  const knownExternal = getKnownExternalRecommendation(parts);
  if (knownExternal) {
    return {
      verdict: "recommended",
      confidence: "medium",
      matched_fix_id: null,
      matched_fix: null,
      external_recommendation: knownExternal,
      headline: `${knownExternal.name} is the fix I’d try first.`,
      reasoning: `This PMO sounds like a workflow/tooling problem more than a brand-new product gap. ${knownExternal.why}`,
      next_steps: [
        `Try ${knownExternal.name} against the exact workflow that keeps breaking.`,
        "If it still misses, reply to the result email and we'll treat it as a build candidate.",
      ],
      submission_id: submissionId,
    };
  }

  return {
    verdict: "gap",
    confidence: "low",
    matched_fix_id: null,
    matched_fix: null,
    external_recommendation: null,
    headline: "You just discovered a brand new fix.",
    reasoning:
      "Nothing in our vault solves this yet — which means you're sitting on something worth building. We review every gap submission for our next product sprint. The problems that piss people off the most tend to become our biggest hits.",
    next_steps: [
      "Your PMO is locked in as a build candidate — no action needed.",
      "If we greenlight this, you'll be first to know (and first to get it free).",
      "Have a friend with the same pain? Send them here — more demand = faster build.",
    ],
    submission_id: submissionId,
  };
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
  const [savingStep, setSavingStep] = useState(false);
  const [loadingLine, setLoadingLine] = useState(0);
  const [match, setMatch] = useState<MatchResult | null>(null);
  const [submissionId, setSubmissionId] = useState<string | null>(null);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [honeypot, setHoneypot] = useState("");

  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    if (user?.email) setEmail(user.email);
  }, [user]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setUser(data.session?.user ?? null);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setUser(session?.user ?? null);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!saving) return;
    const id = setInterval(() => setLoadingLine((i) => (i + 1) % LOADING_LINES.length), 2000);
    return () => clearInterval(id);
  }, [saving]);

  const togglePlatform = (p: string) =>
    setPlatforms((prev) => (prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]));

  // Step 1 → save description + category, get back an id we'll reuse for the rest.
  const goToStep2 = async () => {
    setSavingStep(true);
    try {
      const { id } = await saveDraft({
        id: submissionId ?? undefined,
        description: pmo.trim(),
        category,
        user_id: user?.id ?? null,
        turnstile_token: submissionId ? undefined : turnstileToken,
        company_website: honeypot,
      });
      setSubmissionId(id);
      setStep(2);
    } catch (err) {
      console.warn("Draft save failed:", err);
      const msg = err instanceof Error ? err.message : "Could not save. Try again.";
      toast.error(msg);
    } finally {
      setSavingStep(false);
    }
  };

  // Step 2 → save platforms + kick off background AI match.
  const goToStep3 = async () => {
    if (submissionId) {
      saveDraft({
        id: submissionId,
        platforms: platforms.length ? platforms : null,
        platforms_other: platformsOther.trim() || null,
      })
        .then(() => triggerPrematch(submissionId))
        .catch((err) => console.warn("Step 2 save failed:", err));
    }
    setStep(3);
  };

  // Step 3 → save frequency + cost.
  const goToStep4 = () => {
    if (submissionId) {
      saveDraft({
        id: submissionId,
        frequency,
        cost_impact: cost,
      }).catch((err) => console.warn("Step 3 save failed:", err));
    }
    setStep(4);
  };

  // Step 4 → save dream_fix (this invalidates the prematch cache server-side).
  const goToStep5 = () => {
    if (submissionId) {
      saveDraft({
        id: submissionId,
        dream_fix: dreamFix.trim() || null,
      }).catch((err) => console.warn("Step 4 save failed:", err));
    }
    setStep(5);
  };

  const submit = async () => {
    const emailOk = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim());
    if (!emailOk) {
      toast.error("Please enter a valid email so we can send your fix.");
      return;
    }

    // If something went wrong with Step 1's draft save, recover by inserting now.
    let id = submissionId;
    if (!id) {
      try {
        const created = await saveDraft({
          description: pmo.trim(),
          category,
          platforms: platforms.length ? platforms : null,
          platforms_other: platformsOther.trim() || null,
          frequency,
          cost_impact: cost,
          dream_fix: dreamFix.trim() || null,
          user_id: user?.id ?? null,
        });
        id = created.id;
        setSubmissionId(id);
      } catch (err) {
        console.warn("Recovery draft insert failed:", err);
        id = crypto.randomUUID();
      }
    }

    const finalizePayload = {
      id,
      description: pmo.trim(),
      email: email.trim(),
      first_name: firstName.trim() || null,
      work_type: workType,
      user_id: user?.id ?? null,
    };

    setMatch(null);
    setSaving(true);

    try {
      const result = await Promise.race([
        finalizeMatch(finalizePayload),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("match-timeout")), 25000),
        ),
      ]);
      setMatch(result as MatchResult);
    } catch (err) {
      console.warn("Match failed; showing fallback view:", err);
      setMatch(clientFallbackMatch(id, [pmo, category, platforms.join(" "), platformsOther, dreamFix]));
      toast.error("Matcher hiccuped — showing the honest result now.");
    } finally {
      setSaving(false);
      setSubmitted(true);
    }
  };

  const canQ1 = pmo.trim().length >= 5 && (!!submissionId || !!turnstileToken);
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
          <UserMenu />
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
              setSubmitted(false); setStep(1); setMatch(null); setSubmissionId(null);
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

                  {/* Honeypot — hidden from humans, irresistible to bots */}
                  <div aria-hidden="true" style={{ position: "absolute", left: "-10000px", width: 1, height: 1, overflow: "hidden" }}>
                    <label htmlFor="company_website">Company website (leave blank)</label>
                    <input
                      id="company_website"
                      name="company_website"
                      type="text"
                      tabIndex={-1}
                      autoComplete="off"
                      value={honeypot}
                      onChange={(e) => setHoneypot(e.target.value)}
                    />
                  </div>

                  {!submissionId && (
                    <div className="mt-6">
                      <TurnstileWidget onToken={setTurnstileToken} />
                    </div>
                  )}

                  <Nav
                    onNext={goToStep2}
                    nextDisabled={!canQ1 || savingStep}
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
                    onNext={goToStep3}
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
                    onNext={goToStep4}
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
                    onNext={goToStep5}
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
        disabled={!canSubmit || saving}
                        className="inline-flex items-center justify-center rounded-lg bg-gold px-6 py-4 text-base font-bold uppercase tracking-wide text-gold-foreground transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
                      >
        {saving ? "Finding..." : "Find My Fix →"}
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
            body={
              <>
                Have a list? You bring the idea and audience. We bring the build and distribution.
                <br /><br />
                Multiple profit-sharing options available
              </>
            }
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
}: { tag: string; title: string; body: React.ReactNode; featured?: boolean }) {
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
  const hasMatchResult = !!match;
  const verdict = match?.verdict ?? "gap";
  const label =
    !hasMatchResult ? "PMO received" :
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
        {match?.headline ?? (firstName ? `Thanks, ${firstName}. We're on it.` : "Thanks. We're on it.")}
      </h2>

      {!hasMatchResult && (
        <p className="mt-5 text-muted-foreground leading-relaxed">
          Your PMO has been saved. We're checking it against the fix catalog now and will send the best next step to your inbox.
        </p>
      )}

      {match?.reasoning && (
        <p className="mt-5 text-muted-foreground leading-relaxed">
          {match.reasoning}
        </p>
      )}

      {match?.matched_fix && (
        <div className="mt-6">
          <FixCard fix={match.matched_fix} detailsHref={`/fixes/${match.matched_fix.id}`} />
        </div>
      )}

      {!match?.matched_fix && match?.external_recommendation?.name && (
        <div className="mt-6 rounded-xl border border-gold/30 bg-background/40 p-6">
          <div className="text-xs uppercase tracking-[0.2em] text-gold">External tool we'd try</div>
          <h3 className="mt-2 text-2xl font-bold text-cream">{match.external_recommendation.name}</h3>
          <p className="mt-2 text-muted-foreground">{match.external_recommendation.why}</p>
          {match.external_recommendation.url && (
            <a
              href={match.external_recommendation.url}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 inline-flex items-center justify-center rounded-lg border border-gold/50 px-5 py-2.5 text-sm font-bold uppercase tracking-wide text-gold transition hover:bg-gold/10"
            >
              Check it out →
            </a>
          )}
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


      {hasMatchResult && verdict === "gap" && (
        <p className="mt-6 rounded-lg border border-gold/30 bg-gold/5 p-4 text-sm text-gold">
          No fix exists yet — which means you just found one. This goes straight to our build board. The best gaps become real products, and the people who found them get first access free.{firstName ? ` Keep an eye out, ${firstName}.` : " Keep an eye out."}
        </p>
      )}

      <div className="mt-8 flex flex-wrap items-center gap-6">
        <button
          onClick={onReset}
          className="text-sm uppercase tracking-wider text-gold hover:underline"
        >
          ← Submit another PMO
        </button>
        <span className="text-xs text-muted-foreground">
          We'll also email you a copy so you can find it later.
        </span>
      </div>
    </div>
  );
}
