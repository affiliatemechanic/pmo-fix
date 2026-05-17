import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";

export const Route = createFileRoute("/unsubscribe")({
  component: UnsubscribePage,
  head: () => ({
    meta: [
      { title: "Unsubscribe — PMOfix" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
});

type State = "loading" | "valid" | "already" | "invalid" | "submitting" | "done" | "error";

function UnsubscribePage() {
  const [state, setState] = useState<State>("loading");
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get("token");
    if (!t) {
      setState("invalid");
      return;
    }
    setToken(t);
    fetch(`/email/unsubscribe?token=${encodeURIComponent(t)}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.valid) setState("valid");
        else if (d.reason === "already_unsubscribed") setState("already");
        else setState("invalid");
      })
      .catch(() => setState("invalid"));
  }, []);

  const confirm = async () => {
    if (!token) return;
    setState("submitting");
    try {
      const res = await fetch("/email/unsubscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const d = await res.json();
      if (d.success) setState("done");
      else if (d.reason === "already_unsubscribed") setState("already");
      else setState("error");
    } catch {
      setState("error");
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center px-6">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 text-center">
        <div className="mb-2 text-xs uppercase tracking-[0.2em] text-gold">PMOfix</div>
        {state === "loading" && <p className="text-muted-foreground">Checking your link…</p>}
        {state === "valid" && (
          <>
            <h1 className="text-2xl font-bold text-cream">Unsubscribe from PMOfix?</h1>
            <p className="mt-3 text-muted-foreground">
              You'll stop receiving match results and updates from us.
            </p>
            <button
              onClick={confirm}
              className="mt-6 rounded-md bg-gold px-5 py-2.5 text-sm font-semibold text-background hover:opacity-90"
            >
              Confirm unsubscribe
            </button>
          </>
        )}
        {state === "submitting" && <p className="text-muted-foreground">Unsubscribing…</p>}
        {state === "done" && (
          <>
            <h1 className="text-2xl font-bold text-cream">You're unsubscribed</h1>
            <p className="mt-3 text-muted-foreground">
              We won't email you again. Sorry to see you go.
            </p>
          </>
        )}
        {state === "already" && (
          <>
            <h1 className="text-2xl font-bold text-cream">Already unsubscribed</h1>
            <p className="mt-3 text-muted-foreground">This email is already off the list.</p>
          </>
        )}
        {state === "invalid" && (
          <>
            <h1 className="text-2xl font-bold text-cream">Invalid link</h1>
            <p className="mt-3 text-muted-foreground">
              This unsubscribe link is invalid or expired.
            </p>
          </>
        )}
        {state === "error" && (
          <>
            <h1 className="text-2xl font-bold text-cream">Something went wrong</h1>
            <p className="mt-3 text-muted-foreground">
              Please try the link again or contact support.
            </p>
          </>
        )}
      </div>
    </main>
  );
}
