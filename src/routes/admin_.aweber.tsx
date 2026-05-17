import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2, Mail, Plus, Trash2, ExternalLink } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/admin_/aweber")({
  component: AdminAweberPage,
  head: () => ({
    meta: [
      { title: "AWeber — Admin — PMOfix" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
});

type Mapping = {
  id: string;
  product_id: string;
  list_id: string;
  list_name: string | null;
  tag: string | null;
};

function AdminAweberPage() {
  const navigate = useNavigate();
  const [checking, setChecking] = useState(true);
  const [rows, setRows] = useState<Mapping[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ product_id: "", list_id: "", list_name: "", tag: "" });

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("aweber_list_map")
      .select("id, product_id, list_id, list_name, tag")
      .order("created_at", { ascending: true });
    if (error) toast.error("Failed to load mappings", { description: error.message });
    setRows((data as Mapping[]) ?? []);
    setLoading(false);
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
        toast.error("Admin access required");
        navigate({ to: "/" });
        return;
      }
      setChecking(false);
      load();
    })();
  }, [navigate]);

  const add = async () => {
    if (!form.product_id || !form.list_id) {
      toast.error("Product ID and List ID are required");
      return;
    }
    setBusy(true);
    const { error } = await supabase.from("aweber_list_map").insert({
      product_id: form.product_id.trim(),
      list_id: form.list_id.trim(),
      list_name: form.list_name.trim() || null,
      tag: form.tag.trim() || null,
    });
    setBusy(false);
    if (error) {
      toast.error("Failed to add mapping", { description: error.message });
      return;
    }
    toast.success("Mapping added");
    setForm({ product_id: "", list_id: "", list_name: "", tag: "" });
    load();
  };

  const remove = async (id: string) => {
    setBusy(true);
    const { error } = await supabase.from("aweber_list_map").delete().eq("id", id);
    setBusy(false);
    if (error) toast.error("Failed to delete", { description: error.message });
    else toast.success("Mapping removed");
    load();
  };

  if (checking) {
    return (
      <div className="grid min-h-screen place-items-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-5xl px-6 py-10 md:px-10 space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-widest text-muted-foreground">Admin</p>
            <h1 className="mt-1 font-display text-3xl font-black text-foreground">
              AWeber List Mappings
            </h1>
            <p className="mt-2 text-sm text-muted-foreground max-w-2xl">
              Map each Paddle product to an AWeber list and tag. Buyers are auto-added on purchase.
              Free sign-ups are hardcoded to list <code>awlist6955110</code> with tag <code>free</code>.
            </p>
          </div>
          <Link to="/admin" className="text-sm text-muted-foreground hover:text-foreground">
            ← Back to Admin
          </Link>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="font-display text-lg flex items-center gap-2">
              <ExternalLink className="h-4 w-4" /> Connect AWeber
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-2">
            <p>
              To bootstrap the OAuth connection, open{" "}
              <code className="rounded bg-muted px-1.5 py-0.5">/api/public/aweber/oauth</code>{" "}
              in a browser to receive an <code>authUrl</code> and the <code>redirectUri</code> to
              register in your AWeber Labs app, then visit the <code>authUrl</code> to authorize.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="font-display text-lg flex items-center gap-2">
              <Plus className="h-4 w-4" /> Add mapping
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <div>
                <Label htmlFor="product_id">Product ID</Label>
                <Input
                  id="product_id"
                  placeholder="yours_exclusively"
                  value={form.product_id}
                  onChange={(e) => setForm({ ...form, product_id: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="list_id">AWeber List ID</Label>
                <Input
                  id="list_id"
                  placeholder="awlist6955110"
                  value={form.list_id}
                  onChange={(e) => setForm({ ...form, list_id: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="list_name">List name (optional)</Label>
                <Input
                  id="list_name"
                  placeholder="PMOfix Buyers"
                  value={form.list_name}
                  onChange={(e) => setForm({ ...form, list_name: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="tag">Tag (optional)</Label>
                <Input
                  id="tag"
                  placeholder="yours-exclusively"
                  value={form.tag}
                  onChange={(e) => setForm({ ...form, tag: e.target.value })}
                />
              </div>
            </div>
            <div className="mt-4">
              <Button onClick={add} disabled={busy}>
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Add mapping"}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="font-display text-lg flex items-center gap-2">
              <Mail className="h-4 w-4" /> Current mappings
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="py-12 grid place-items-center text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin" />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Product ID</TableHead>
                      <TableHead>List</TableHead>
                      <TableHead>List ID</TableHead>
                      <TableHead>Tag</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell className="font-mono text-xs">{r.product_id}</TableCell>
                        <TableCell>{r.list_name || "—"}</TableCell>
                        <TableCell className="font-mono text-xs">{r.list_id}</TableCell>
                        <TableCell>{r.tag || "—"}</TableCell>
                        <TableCell className="text-right">
                          <Button
                            size="sm"
                            variant="ghost"
                            disabled={busy}
                            onClick={() => remove(r.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                    {rows.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-sm text-muted-foreground py-8">
                          No mappings yet. Add one above.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
