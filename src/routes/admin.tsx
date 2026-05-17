import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/admin")({
  component: AdminPage,
  head: () => ({
    meta: [
      { title: "Admin — PMOfix" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
});

type Profile = {
  id: string;
  email: string | null;
  display_name: string | null;
  avatar_url: string | null;
  created_at: string;
};

type Submission = {
  id: string;
  user_id: string | null;
  description: string;
  category: string | null;
  created_at: string;
};

function AdminPage() {
  const navigate = useNavigate();
  const [checking, setChecking] = useState(true);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [tab, setTab] = useState<"users" | "submissions">("users");

  useEffect(() => {
    (async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        navigate({ to: "/auth" });
        return;
      }
      const { data: roles } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", sessionData.session.user.id);
      const isAdmin = roles?.some((r) => r.role === "admin");
      if (!isAdmin) {
        toast.error("Admin access only.");
        navigate({ to: "/" });
        return;
      }

      const [{ data: p, error: pe }, { data: s, error: se }] = await Promise.all([
        supabase.from("profiles").select("*").order("created_at", { ascending: false }),
        supabase.from("pmo_submissions").select("*").order("created_at", { ascending: false }),
      ]);
      if (pe) toast.error(pe.message);
      if (se) toast.error(se.message);
      setProfiles(p ?? []);
      setSubmissions(s ?? []);
      setChecking(false);
    })();
  }, [navigate]);

  if (checking) {
    return (
      <main className="flex min-h-screen items-center justify-center text-muted-foreground">
        Checking access…
      </main>
    );
  }

  return (
    <main className="min-h-screen">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
          <Link to="/" className="font-display text-2xl font-black text-gold">
            PMO<span className="text-foreground">fix</span>
          </Link>
          <div className="text-xs uppercase tracking-[0.2em] text-gold">Admin</div>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-6 py-10">
        <h1 className="text-4xl font-black text-cream">Control room</h1>
        <p className="mt-2 text-muted-foreground">
          {profiles.length} {profiles.length === 1 ? "user" : "users"} · {submissions.length}{" "}
          {submissions.length === 1 ? "submission" : "submissions"}
        </p>

        <div className="mt-8 flex gap-2 border-b border-border">
          {(["users", "submissions"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`-mb-px border-b-2 px-4 py-2 text-sm uppercase tracking-wider transition ${
                tab === t
                  ? "border-gold text-gold"
                  : "border-transparent text-muted-foreground hover:text-cream"
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        {tab === "users" ? (
          <div className="mt-6 overflow-x-auto rounded-xl border border-border">
            <table className="w-full text-sm">
              <thead className="bg-secondary/40 text-left text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Email</th>
                  <th className="px-4 py-3">Joined</th>
                </tr>
              </thead>
              <tbody>
                {profiles.map((p) => (
                  <tr key={p.id} className="border-t border-border text-cream">
                    <td className="px-4 py-3">{p.display_name ?? "—"}</td>
                    <td className="px-4 py-3 text-muted-foreground">{p.email ?? "—"}</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {new Date(p.created_at).toLocaleString()}
                    </td>
                  </tr>
                ))}
                {profiles.length === 0 && (
                  <tr>
                    <td colSpan={3} className="px-4 py-8 text-center text-muted-foreground">
                      No users yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="mt-6 space-y-3">
            {submissions.map((s) => (
              <div key={s.id} className="rounded-xl border border-border bg-card p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="text-xs uppercase tracking-wider text-gold">
                    {s.category ?? "Uncategorized"}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {new Date(s.created_at).toLocaleString()}
                  </div>
                </div>
                <p className="mt-3 whitespace-pre-wrap text-cream">{s.description}</p>
                <div className="mt-2 text-xs text-muted-foreground">
                  {s.user_id ? `User: ${s.user_id.slice(0, 8)}…` : "Anonymous"}
                </div>
              </div>
            ))}
            {submissions.length === 0 && (
              <div className="rounded-xl border border-border p-8 text-center text-muted-foreground">
                No submissions yet.
              </div>
            )}
          </div>
        )}
      </section>
    </main>
  );
}
