import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import logo from "@/assets/pmofix-logo.png";
import { UserMenu } from "./UserMenu";

export function LegalLayout({
  title,
  updated,
  children,
}: {
  title: string;
  updated: string;
  children: ReactNode;
}) {
  return (
    <main className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-5">
          <Link to="/" className="flex items-center gap-2">
            <img src={logo} alt="PMOfix" className="h-8 w-8" />
            <span className="font-display text-lg font-black text-gold">
              PMO<span className="text-foreground">fix</span>
            </span>
          </Link>
          <Link to="/" className="text-sm uppercase tracking-wider text-gold hover:underline">
            ← Home
          </Link>
        </div>
      </header>

      <article className="mx-auto max-w-3xl px-6 py-16">
        <p className="text-xs uppercase tracking-[0.2em] text-gold">Legal</p>
        <h1 className="mt-2 font-display text-4xl font-black text-foreground md:text-5xl">
          {title}
        </h1>
        <p className="mt-3 text-sm text-muted-foreground">Last updated: {updated}</p>

        <div className="legal-prose mt-10 space-y-6 text-[15px] leading-relaxed text-muted-foreground">
          {children}
        </div>

        <div className="mt-16 border-t border-border pt-8 text-sm text-muted-foreground">
          <p>
            Questions? Email{" "}
            <a className="text-gold hover:underline" href="mailto:support@affiliateprogrampro.com">
              support@affiliateprogrampro.com
            </a>
            .
          </p>
          <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-xs uppercase tracking-wider">
            <Link to="/terms" className="hover:text-gold">Terms</Link>
            <Link to="/privacy" className="hover:text-gold">Privacy</Link>
            <Link to="/refund" className="hover:text-gold">Refund Policy</Link>
            <Link to="/acceptable-use" className="hover:text-gold">Acceptable Use</Link>
            <Link to="/contact" className="hover:text-gold">Contact</Link>
          </div>
        </div>
      </article>
    </main>
  );
}

export function H2({ children }: { children: ReactNode }) {
  return <h2 className="mt-10 font-display text-2xl font-bold text-foreground">{children}</h2>;
}

export function P({ children }: { children: ReactNode }) {
  return <p>{children}</p>;
}

export function UL({ children }: { children: ReactNode }) {
  return <ul className="ml-5 list-disc space-y-2">{children}</ul>;
}
