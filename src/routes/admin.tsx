import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { FixCard } from "@/components/FixCard";

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
  platforms: string[] | null;
  platforms_other: string | null;
  frequency: string | null;
  cost_impact: string | null;
  dream_fix: string | null;
  first_name: string | null;
  work_type: string | null;
  match_result: any | null;
  matched_at: string | null;
};

type EmailLogRow = {
  id: string;
  message_id: string | null;
  recipient_email: string;
  status: string;
  error_message: string | null;
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

  const [emailLogs, setEmailLogs] = useState<EmailLogRow[]>([]);

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

      const [{ data: p, error: pe }, { data: s, error: se }, { data: f, error: fe }, { data: el, error: ele }] =
        await Promise.all([
          supabase.from("profiles").select("*").order("created_at", { ascending: false }),
          supabase.from("pmo_submissions").select("*").order("created_at", { ascending: false }),
          supabase.from("fixes").select("*").order("created_at", { ascending: false }),
          supabase.from("email_send_log").select("*").order("created_at", { ascending: false }).limit(2000),
        ]);
      if (pe) toast.error(pe.message);
      if (se) toast.error(se.message);
      if (fe) toast.error(fe.message);
      if (ele) toast.error(ele.message);
      setProfiles(p ?? []);
      setSubmissions((s ?? []) as Submission[]);
      setFixes((f ?? []) as Fix[]);
      setEmailLogs((el ?? []) as EmailLogRow[]);
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
          <SubmissionsPanel
            submissions={submissions}
            emailLogs={emailLogs}
            onUpdated={(updated) =>
              setSubmissions((prev) => prev.map((s) => (s.id === updated.id ? updated : s)))
            }
          />
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
  image_url: string;
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
  image_url: "",
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
    image_url: f.image_url ?? "",
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
      image_url: editing.image_url.trim() || null,
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
              <SubField label="Name">
                <input
                  className="input"
                  value={editing.name}
                  onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                />
              </SubField>
              <SubField label="Type">
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
              </SubField>
              <SubField label="Summary (basic HTML: <br>, <b>, <i>, <a>, <ul>, <li>)">
                <textarea
                  className="input min-h-[60px]"
                  value={editing.summary}
                  onChange={(e) => setEditing({ ...editing, summary: e.target.value })}
                />
              </SubField>
              <SubField label="Description (optional, same HTML tags allowed)">
                <textarea
                  className="input min-h-[100px]"
                  value={editing.description}
                  onChange={(e) => setEditing({ ...editing, description: e.target.value })}
                />
              </SubField>
              <SubField label="URL">
                <input
                  className="input"
                  value={editing.url}
                  onChange={(e) => setEditing({ ...editing, url: e.target.value })}
                />
              </SubField>
              <SubField label="Image URL (logo or product image)">
                <input
                  className="input"
                  value={editing.image_url}
                  onChange={(e) => setEditing({ ...editing, image_url: e.target.value })}
                  placeholder="https://…/logo.png"
                />
                {editing.image_url && (
                  <img
                    src={editing.image_url}
                    alt="preview"
                    className="mt-2 h-16 w-16 rounded-lg border border-border bg-secondary/30 object-contain p-1"
                  />
                )}
              </SubField>
              <div className="grid gap-4 sm:grid-cols-2">
                <SubField label="Categories (comma separated)">
                  <input
                    className="input"
                    value={editing.categories}
                    onChange={(e) =>
                      setEditing({ ...editing, categories: e.target.value })
                    }
                    placeholder="marketing, ops"
                  />
                </SubField>
                <SubField label="Platforms (comma separated)">
                  <input
                    className="input"
                    value={editing.platforms}
                    onChange={(e) =>
                      setEditing({ ...editing, platforms: e.target.value })
                    }
                    placeholder="wordpress, google-sheets"
                  />
                </SubField>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <SubField label="Tags">
                  <input
                    className="input"
                    value={editing.tags}
                    onChange={(e) => setEditing({ ...editing, tags: e.target.value })}
                  />
                </SubField>
                <SubField label="Price note">
                  <input
                    className="input"
                    value={editing.price_note}
                    onChange={(e) =>
                      setEditing({ ...editing, price_note: e.target.value })
                    }
                    placeholder="$49 one-time"
                  />
                </SubField>
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
            <div className="mt-6 rounded-xl border border-dashed border-gold/30 bg-secondary/20 p-4">
              <div className="mb-3 text-xs uppercase tracking-[0.2em] text-gold">Live preview</div>
              <FixCard
                fix={{
                  name: editing.name || "(untitled fix)",
                  type: editing.type,
                  summary: editing.summary || "<i>(summary will appear here)</i>",
                  description: editing.description,
                  url: editing.url,
                  image_url: editing.image_url,
                  price_note: editing.price_note,
                  categories: editing.categories.split(",").map((s) => s.trim()).filter(Boolean),
                  platforms: editing.platforms.split(",").map((s) => s.trim()).filter(Boolean),
                  tags: editing.tags.split(",").map((s) => s.trim()).filter(Boolean),
                }}
                showDescription
              />
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

function SubField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      {children}
    </label>
  );
}

// ============================================================
// Submissions report
// ============================================================

const FREQ_OPTIONS = ["", "daily", "weekly", "monthly", "occasionally"];
const COST_OPTIONS = ["", "low", "medium", "high"];

function SubmissionsPanel({
  submissions,
  emailLogs,
  onUpdated,
}: {
  submissions: Submission[];
  emailLogs: EmailLogRow[];
  onUpdated: (s: Submission) => void;
}) {
  const [query, setQuery] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);

  // Group: latest email row per message_id, indexed by submission.id
  const latestEmailBySubmission = (() => {
    const latest = new Map<string, EmailLogRow>();
    for (const row of emailLogs) {
      if (!row.message_id) continue;
      const existing = latest.get(row.message_id);
      if (!existing || row.created_at > existing.created_at) latest.set(row.message_id, row);
    }
    const bySub = new Map<string, EmailLogRow>();
    latest.forEach((row, mid) => {
      const m = mid.match(/^match-result-(.+)$/);
      if (m) bySub.set(m[1], row);
    });
    return bySub;
  })();

  const filtered = submissions.filter((s) => {
    if (!query.trim()) return true;
    const q = query.toLowerCase();
    return (
      s.description.toLowerCase().includes(q) ||
      (s.email ?? "").toLowerCase().includes(q) ||
      (s.first_name ?? "").toLowerCase().includes(q) ||
      (s.category ?? "").toLowerCase().includes(q)
    );
  });

  return (
    <div className="mt-6 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search description, email, name…"
          className="w-full max-w-md rounded-md border border-border bg-background px-3 py-2 text-sm text-cream"
        />
        <div className="text-xs text-muted-foreground">
          {filtered.length} / {submissions.length}
        </div>
      </div>

      {filtered.map((s) => {
        const email = latestEmailBySubmission.get(s.id);
        const isOpen = openId === s.id;
        return (
          <SubmissionRow
            key={s.id}
            submission={s}
            emailStatus={email}
            open={isOpen}
            onToggle={() => setOpenId(isOpen ? null : s.id)}
            onUpdated={onUpdated}
          />
        );
      })}

      {filtered.length === 0 && (
        <div className="rounded-xl border border-border p-8 text-center text-muted-foreground">
          No submissions match.
        </div>
      )}
    </div>
  );
}

function statusBadge(status: string | undefined) {
  const color =
    status === "sent"
      ? "bg-green-500/15 text-green-400 border-green-500/40"
      : status === "pending"
        ? "bg-yellow-500/15 text-yellow-400 border-yellow-500/40"
        : status === "suppressed"
          ? "bg-zinc-500/15 text-zinc-400 border-zinc-500/40"
          : status
            ? "bg-red-500/15 text-red-400 border-red-500/40"
            : "bg-zinc-500/10 text-zinc-500 border-zinc-500/30";
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider ${color}`}>
      {status ?? "no email"}
    </span>
  );
}

function SubmissionRow({
  submission,
  emailStatus,
  open,
  onToggle,
  onUpdated,
}: {
  submission: Submission;
  emailStatus: EmailLogRow | undefined;
  open: boolean;
  onToggle: () => void;
  onUpdated: (s: Submission) => void;
}) {
  const s = submission;
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState({
    description: s.description ?? "",
    category: s.category ?? "",
    first_name: s.first_name ?? "",
    email: s.email ?? "",
    work_type: s.work_type ?? "",
    frequency: s.frequency ?? "",
    cost_impact: s.cost_impact ?? "",
    dream_fix: s.dream_fix ?? "",
    platforms_other: s.platforms_other ?? "",
    platforms: (s.platforms ?? []).join(", "),
  });

  const save = async () => {
    setSaving(true);
    const payload = {
      description: draft.description.trim(),
      category: draft.category.trim() || null,
      first_name: draft.first_name.trim() || null,
      email: draft.email.trim() || null,
      work_type: draft.work_type.trim() || null,
      frequency: draft.frequency.trim() || null,
      cost_impact: draft.cost_impact.trim() || null,
      dream_fix: draft.dream_fix.trim() || null,
      platforms_other: draft.platforms_other.trim() || null,
      platforms: draft.platforms.trim()
        ? draft.platforms.split(",").map((p) => p.trim()).filter(Boolean)
        : null,
    };
    const { data, error } = await supabase
      .from("pmo_submissions")
      .update(payload)
      .eq("id", s.id)
      .select()
      .single();
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Saved.");
    setEditing(false);
    onUpdated(data as Submission);
  };

  const match = s.match_result as
    | { headline?: string; verdict?: string; reasoning?: string; matched_fix?: { name?: string; url?: string }; external_recommendation?: { name?: string; url?: string }; next_steps?: string[] }
    | null;

  return (
    <div className="rounded-xl border border-border bg-card">
      <button
        onClick={onToggle}
        className="flex w-full items-start justify-between gap-4 px-5 py-4 text-left hover:bg-secondary/20"
      >
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="uppercase tracking-wider text-gold">{s.category ?? "uncat."}</span>
            <span className="text-muted-foreground">{new Date(s.created_at).toLocaleString()}</span>
            {s.email && <span className="text-cream">{s.email}</span>}
            {statusBadge(emailStatus?.status)}
            {s.matched_at ? (
              <span className="rounded-full border border-gold/30 bg-gold/10 px-2 py-0.5 text-[10px] uppercase tracking-wider text-gold">
                matched
              </span>
            ) : (
              <span className="rounded-full border border-zinc-500/30 px-2 py-0.5 text-[10px] uppercase tracking-wider text-zinc-500">
                no match
              </span>
            )}
          </div>
          <p className="mt-2 line-clamp-2 text-sm text-cream">{s.description}</p>
        </div>
        <span className="shrink-0 text-xs text-muted-foreground">{open ? "▲" : "▼"}</span>
      </button>

      {open && (
        <div className="border-t border-border px-5 py-5 space-y-6">
          {/* Request */}
          <section>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-gold">Request</h3>
              {editing ? (
                <div className="flex gap-2">
                  <button
                    disabled={saving}
                    onClick={save}
                    className="rounded-md bg-gold px-3 py-1 text-xs font-bold text-background hover:bg-gold/90 disabled:opacity-50"
                  >
                    {saving ? "Saving…" : "Save"}
                  </button>
                  <button
                    disabled={saving}
                    onClick={() => setEditing(false)}
                    className="rounded-md border border-border px-3 py-1 text-xs text-muted-foreground hover:text-cream"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setEditing(true)}
                  className="rounded-md border border-border px-3 py-1 text-xs text-muted-foreground hover:text-cream"
                >
                  Edit
                </button>
              )}
            </div>

            {editing ? (
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <EditField label="Description" full>
                  <textarea
                    value={draft.description}
                    onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                    rows={4}
                    className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-cream"
                  />
                </EditField>
                <EditField label="Email">
                  <input value={draft.email} onChange={(e) => setDraft({ ...draft, email: e.target.value })} className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-cream" />
                </EditField>
                <EditField label="First name">
                  <input value={draft.first_name} onChange={(e) => setDraft({ ...draft, first_name: e.target.value })} className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-cream" />
                </EditField>
                <EditField label="Category">
                  <input value={draft.category} onChange={(e) => setDraft({ ...draft, category: e.target.value })} className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-cream" />
                </EditField>
                <EditField label="Work type">
                  <input value={draft.work_type} onChange={(e) => setDraft({ ...draft, work_type: e.target.value })} className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-cream" />
                </EditField>
                <EditField label="Frequency">
                  <select value={draft.frequency} onChange={(e) => setDraft({ ...draft, frequency: e.target.value })} className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-cream">
                    {FREQ_OPTIONS.map((o) => <option key={o} value={o}>{o || "—"}</option>)}
                  </select>
                </EditField>
                <EditField label="Cost impact">
                  <select value={draft.cost_impact} onChange={(e) => setDraft({ ...draft, cost_impact: e.target.value })} className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-cream">
                    {COST_OPTIONS.map((o) => <option key={o} value={o}>{o || "—"}</option>)}
                  </select>
                </EditField>
                <EditField label="Platforms (comma-separated)" full>
                  <input value={draft.platforms} onChange={(e) => setDraft({ ...draft, platforms: e.target.value })} className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-cream" />
                </EditField>
                <EditField label="Platforms (other)" full>
                  <input value={draft.platforms_other} onChange={(e) => setDraft({ ...draft, platforms_other: e.target.value })} className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-cream" />
                </EditField>
                <EditField label="Dream fix" full>
                  <textarea value={draft.dream_fix} onChange={(e) => setDraft({ ...draft, dream_fix: e.target.value })} rows={3} className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-cream" />
                </EditField>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-x-6 gap-y-2 md:grid-cols-2 text-sm">
                <SubField label="Description" full>
                  <p className="whitespace-pre-wrap text-cream">{s.description}</p>
                </SubField>
                <SubField label="Email"><span className="text-cream">{s.email ?? "—"}</span></SubField>
                <SubField label="First name"><span className="text-cream">{s.first_name ?? "—"}</span></SubField>
                <SubField label="Category"><span className="text-cream">{s.category ?? "—"}</span></SubField>
                <SubField label="Work type"><span className="text-cream">{s.work_type ?? "—"}</span></SubField>
                <SubField label="Frequency"><span className="text-cream">{s.frequency ?? "—"}</span></SubField>
                <SubField label="Cost impact"><span className="text-cream">{s.cost_impact ?? "—"}</span></SubField>
                <SubField label="Platforms"><span className="text-cream">{s.platforms?.join(", ") || "—"}</span></SubField>
                <SubField label="Platforms (other)"><span className="text-cream">{s.platforms_other ?? "—"}</span></SubField>
                <SubField label="Dream fix" full>
                  <p className="whitespace-pre-wrap text-cream">{s.dream_fix ?? "—"}</p>
                </SubField>
                <SubField label="User"><span className="text-muted-foreground">{s.user_id ?? "Anonymous"}</span></SubField>
                <SubField label="Submission ID"><span className="font-mono text-xs text-muted-foreground">{s.id}</span></SubField>
              </div>
            )}
          </section>

          {/* Response */}
          <section>
            <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-gold">Response</h3>
            {match ? (
              <div className="space-y-2 text-sm">
                <div className="flex flex-wrap gap-2 text-xs">
                  {match.verdict && <span className="rounded-full border border-border px-2 py-0.5 uppercase tracking-wider text-muted-foreground">{match.verdict}</span>}
                  {s.matched_at && <span className="text-muted-foreground">matched {new Date(s.matched_at).toLocaleString()}</span>}
                </div>
                {match.headline && <p className="text-cream font-semibold">{match.headline}</p>}
                {match.reasoning && <p className="text-muted-foreground whitespace-pre-wrap">{match.reasoning}</p>}
                {match.matched_fix?.name && (
                  <p className="text-cream">Matched fix: <span className="text-gold">{match.matched_fix.name}</span></p>
                )}
                {match.external_recommendation?.name && (
                  <p className="text-cream">External rec: <span className="text-gold">{match.external_recommendation.name}</span></p>
                )}
                {match.next_steps?.length ? (
                  <ul className="ml-5 list-disc text-muted-foreground">
                    {match.next_steps.map((n, i) => <li key={i}>{n}</li>)}
                  </ul>
                ) : null}
                <details className="mt-2">
                  <summary className="cursor-pointer text-xs uppercase tracking-wider text-muted-foreground">Raw JSON</summary>
                  <pre className="mt-2 max-h-72 overflow-auto rounded-md border border-border bg-background p-3 text-xs text-muted-foreground">{JSON.stringify(s.match_result, null, 2)}</pre>
                </details>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No response saved.</p>
            )}
          </section>

          {/* Email */}
          <section>
            <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-gold">Email</h3>
            {emailStatus ? (
              <div className="text-sm space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  {statusBadge(emailStatus.status)}
                  <span className="text-muted-foreground">{new Date(emailStatus.created_at).toLocaleString()}</span>
                  <span className="text-cream">→ {emailStatus.recipient_email}</span>
                </div>
                {emailStatus.error_message && (
                  <p className="text-red-400">{emailStatus.error_message}</p>
                )}
                <p className="font-mono text-xs text-muted-foreground">{emailStatus.message_id}</p>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No email log entry for this submission.</p>
            )}
          </section>
        </div>
      )}
    </div>
  );
}

function SubField({ label, children, full }: { label: string; children: React.ReactNode; full?: boolean }) {
  return (
    <div className={full ? "md:col-span-2" : ""}>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-0.5">{children}</div>
    </div>
  );
}

function EditField({ label, children, full }: { label: string; children: React.ReactNode; full?: boolean }) {
  return (
    <label className={`block ${full ? "md:col-span-2" : ""}`}>
      <span className="mb-1 block text-[10px] uppercase tracking-wider text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}
