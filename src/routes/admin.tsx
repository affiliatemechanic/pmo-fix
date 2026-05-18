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
  email: string | null;
  created_at: string;
};

type Fix = {
  id: string;
  name: string;
  type: string;
  summary: string;
  description: string | null;
  url: string | null;
  image_url: string | null;
  categories: string[] | null;
  platforms: string[] | null;
  tags: string[] | null;
  price_note: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
};

const FIX_TYPES = [
  { value: "in_house", label: "In-house" },
  { value: "affiliate", label: "Affiliate" },
] as const;

function AdminPage() {
  const navigate = useNavigate();
  const [checking, setChecking] = useState(true);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [fixes, setFixes] = useState<Fix[]>([]);
  const [tab, setTab] = useState<"users" | "submissions" | "fixes">("fixes");

  const loadFixes = async () => {
    const { data, error } = await supabase
      .from("fixes")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) toast.error(error.message);
    else setFixes((data ?? []) as Fix[]);
  };

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

      const [{ data: p, error: pe }, { data: s, error: se }, { data: f, error: fe }] =
        await Promise.all([
          supabase.from("profiles").select("*").order("created_at", { ascending: false }),
          supabase.from("pmo_submissions").select("*").order("created_at", { ascending: false }),
          supabase.from("fixes").select("*").order("created_at", { ascending: false }),
        ]);
      if (pe) toast.error(pe.message);
      if (se) toast.error(se.message);
      if (fe) toast.error(fe.message);
      setProfiles(p ?? []);
      setSubmissions(s ?? []);
      setFixes((f ?? []) as Fix[]);
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
          <div className="flex items-center gap-4">
            <Link
              to="/admin/aweber"
              className="text-xs uppercase tracking-[0.2em] text-muted-foreground hover:text-gold"
            >
              AWeber
            </Link>
            <div className="text-xs uppercase tracking-[0.2em] text-gold">Admin</div>
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-6 py-10">
        <h1 className="text-4xl font-black text-cream">Control room</h1>
        <p className="mt-2 text-muted-foreground">
          {profiles.length} {profiles.length === 1 ? "user" : "users"} · {submissions.length}{" "}
          {submissions.length === 1 ? "submission" : "submissions"} · {fixes.length}{" "}
          {fixes.length === 1 ? "fix" : "fixes"}
        </p>

        <div className="mt-8 flex gap-2 border-b border-border">
          {(["fixes", "submissions", "users"] as const).map((t) => (
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

        {tab === "users" && (
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
        )}

        {tab === "submissions" && (
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
                <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                  {s.email && (
                    <a href={`mailto:${s.email}`} className="text-gold hover:underline">
                      {s.email}
                    </a>
                  )}
                  <span>{s.user_id ? `User: ${s.user_id.slice(0, 8)}…` : "Anonymous"}</span>
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

        {tab === "fixes" && <FixesPanel fixes={fixes} reload={loadFixes} />}
      </section>
    </main>
  );
}

type FixDraft = {
  id?: string;
  name: string;
  type: string;
  summary: string;
  description: string;
  url: string;
  categories: string;
  platforms: string;
  tags: string;
  price_note: string;
  active: boolean;
};

const emptyDraft: FixDraft = {
  name: "",
  type: "in_house",
  summary: "",
  description: "",
  url: "",
  categories: "",
  platforms: "",
  tags: "",
  price_note: "",
  active: true,
};

function toDraft(f: Fix): FixDraft {
  return {
    id: f.id,
    name: f.name,
    type: f.type,
    summary: f.summary,
    description: f.description ?? "",
    url: f.url ?? "",
    categories: (f.categories ?? []).join(", "),
    platforms: (f.platforms ?? []).join(", "),
    tags: (f.tags ?? []).join(", "),
    price_note: f.price_note ?? "",
    active: f.active,
  };
}

function splitList(v: string): string[] | null {
  const arr = v
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
  return arr.length ? arr : null;
}

function FixesPanel({ fixes, reload }: { fixes: Fix[]; reload: () => Promise<void> }) {
  const [editing, setEditing] = useState<FixDraft | null>(null);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!editing) return;
    if (!editing.name.trim() || !editing.summary.trim()) {
      toast.error("Name and summary are required.");
      return;
    }
    setSaving(true);
    const payload = {
      name: editing.name.trim(),
      type: editing.type,
      summary: editing.summary.trim(),
      description: editing.description.trim() || null,
      url: editing.url.trim() || null,
      categories: splitList(editing.categories),
      platforms: splitList(editing.platforms),
      tags: splitList(editing.tags),
      price_note: editing.price_note.trim() || null,
      active: editing.active,
    };
    const { error } = editing.id
      ? await supabase.from("fixes").update(payload).eq("id", editing.id)
      : await supabase.from("fixes").insert(payload);
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(editing.id ? "Fix updated" : "Fix added");
    setEditing(null);
    await reload();
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this fix?")) return;
    const { error } = await supabase.from("fixes").delete().eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Deleted");
    await reload();
  };

  const toggleActive = async (f: Fix) => {
    const { error } = await supabase
      .from("fixes")
      .update({ active: !f.active })
      .eq("id", f.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    await reload();
  };

  return (
    <div className="mt-6 space-y-4">
      <div className="flex justify-end">
        <button
          onClick={() => setEditing({ ...emptyDraft })}
          className="rounded-md bg-gold px-4 py-2 text-sm font-semibold text-background hover:opacity-90"
        >
          + Add fix
        </button>
      </div>

      <div className="grid gap-3">
        {fixes.map((f) => (
          <div key={f.id} className="rounded-xl border border-border bg-card p-5">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-semibold text-cream">{f.name}</h3>
                  <span className="rounded-full border border-border px-2 py-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">
                    {f.type}
                  </span>
                  {!f.active && (
                    <span className="rounded-full bg-destructive/20 px-2 py-0.5 text-[10px] uppercase tracking-wider text-destructive">
                      inactive
                    </span>
                  )}
                </div>
                <p className="mt-2 text-sm text-muted-foreground">{f.summary}</p>
                <div className="mt-2 flex flex-wrap gap-1 text-[11px] text-muted-foreground">
                  {(f.categories ?? []).map((c) => (
                    <span key={c} className="rounded bg-secondary/40 px-2 py-0.5">
                      {c}
                    </span>
                  ))}
                  {(f.platforms ?? []).map((p) => (
                    <span key={p} className="rounded bg-secondary/40 px-2 py-0.5">
                      {p}
                    </span>
                  ))}
                </div>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-2 text-xs">
                <button
                  onClick={() => setEditing(toDraft(f))}
                  className="text-gold hover:underline"
                >
                  Edit
                </button>
                <button
                  onClick={() => toggleActive(f)}
                  className="text-muted-foreground hover:text-cream"
                >
                  {f.active ? "Deactivate" : "Activate"}
                </button>
                <button
                  onClick={() => remove(f.id)}
                  className="text-destructive hover:underline"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        ))}
        {fixes.length === 0 && (
          <div className="rounded-xl border border-border p-8 text-center text-muted-foreground">
            No fixes yet. Add one to start matching.
          </div>
        )}
      </div>

      {editing && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          onClick={() => !saving && setEditing(null)}
        >
          <div
            className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-border bg-background p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-xl font-bold text-cream">
              {editing.id ? "Edit fix" : "Add fix"}
            </h2>
            <div className="mt-4 grid gap-4">
              <Field label="Name">
                <input
                  className="input"
                  value={editing.name}
                  onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                />
              </Field>
              <Field label="Type">
                <div className="flex gap-2">
                  {FIX_TYPES.map((t) => (
                    <button
                      key={t.value}
                      type="button"
                      onClick={() => setEditing({ ...editing, type: t.value })}
                      className={`flex-1 rounded-md border px-4 py-2 text-sm font-medium transition ${
                        editing.type === t.value
                          ? "border-gold bg-gold/10 text-gold"
                          : "border-border bg-secondary/20 text-muted-foreground hover:text-cream"
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </Field>
              <Field label="Summary">
                <textarea
                  className="input min-h-[60px]"
                  value={editing.summary}
                  onChange={(e) => setEditing({ ...editing, summary: e.target.value })}
                />
              </Field>
              <Field label="Description (optional)">
                <textarea
                  className="input min-h-[100px]"
                  value={editing.description}
                  onChange={(e) => setEditing({ ...editing, description: e.target.value })}
                />
              </Field>
              <Field label="URL">
                <input
                  className="input"
                  value={editing.url}
                  onChange={(e) => setEditing({ ...editing, url: e.target.value })}
                />
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Categories (comma separated)">
                  <input
                    className="input"
                    value={editing.categories}
                    onChange={(e) =>
                      setEditing({ ...editing, categories: e.target.value })
                    }
                    placeholder="marketing, ops"
                  />
                </Field>
                <Field label="Platforms (comma separated)">
                  <input
                    className="input"
                    value={editing.platforms}
                    onChange={(e) =>
                      setEditing({ ...editing, platforms: e.target.value })
                    }
                    placeholder="wordpress, google-sheets"
                  />
                </Field>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Tags">
                  <input
                    className="input"
                    value={editing.tags}
                    onChange={(e) => setEditing({ ...editing, tags: e.target.value })}
                  />
                </Field>
                <Field label="Price note">
                  <input
                    className="input"
                    value={editing.price_note}
                    onChange={(e) =>
                      setEditing({ ...editing, price_note: e.target.value })
                    }
                    placeholder="$49 one-time"
                  />
                </Field>
              </div>
              <label className="flex items-center gap-2 text-sm text-cream">
                <input
                  type="checkbox"
                  checked={editing.active}
                  onChange={(e) => setEditing({ ...editing, active: e.target.checked })}
                />
                Active (visible to matching engine)
              </label>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => setEditing(null)}
                disabled={saving}
                className="rounded-md border border-border px-4 py-2 text-sm text-cream hover:bg-secondary/40"
              >
                Cancel
              </button>
              <button
                onClick={save}
                disabled={saving}
                className="rounded-md bg-gold px-4 py-2 text-sm font-semibold text-background hover:opacity-90 disabled:opacity-60"
              >
                {saving ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .input {
          width: 100%;
          border-radius: 0.5rem;
          border: 1px solid hsl(var(--border));
          background: hsl(var(--secondary) / 0.3);
          padding: 0.5rem 0.75rem;
          font-size: 0.875rem;
          color: hsl(var(--foreground));
        }
        .input:focus { outline: 2px solid hsl(var(--ring)); }
      `}</style>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      {children}
    </label>
  );
}
