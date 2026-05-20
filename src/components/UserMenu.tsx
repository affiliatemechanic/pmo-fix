import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import type { User } from "@supabase/supabase-js";
import { toast } from "sonner";

export function UserMenu() {
  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const loadRole = async (uid: string) => {
      const { data: roles, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", uid);
      console.log("[UserMenu] roles query", { uid, roles, error });
      setIsAdmin(!!roles?.some((r) => r.role === "admin"));
    };

    supabase.auth.getSession().then(({ data }) => {
      console.log("[UserMenu] getSession", { userId: data.session?.user?.id ?? null });
      setUser(data.session?.user ?? null);
      if (data.session) loadRole(data.session.user.id);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      console.log("[UserMenu] authChange", { event: _e, userId: session?.user?.id ?? null });
      setUser(session?.user ?? null);
      if (session) loadRole(session.user.id);
      else setIsAdmin(false);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    toast.success("Signed out.");
  };

  if (!user) {
    return (
      <Link
        to="/auth"
        className="rounded-md border border-gold/40 px-3 py-1.5 text-sm text-gold hover:bg-gold/10 transition"
      >
        Sign in
      </Link>
    );
  }

  return (
    <div className="flex items-center gap-4">
      {isAdmin && (
        <Link to="/admin" className="text-sm font-medium text-cream hover:text-gold transition">
          Admin
        </Link>
      )}
      <button
        onClick={handleSignOut}
        className="text-sm font-medium text-cream hover:text-gold transition cursor-pointer"
      >
        Sign out
      </button>
    </div>
  );
}
