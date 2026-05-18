// Minimal allowlist HTML sanitizer for fix summary/description fields.
// Allows: br, b, strong, i, em, u, p, ul, ol, li, a (href only, http/https/mailto).
// Everything else is stripped. Use for trusted-admin-authored content rendered
// in emails and on public pages.

const VOID_TAGS = new Set(["br"]);
const ALLOWED_TAGS = new Set([
  "br", "b", "strong", "i", "em", "u", "p", "ul", "ol", "li", "a",
]);

function escapeText(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function safeHref(raw: string): string | null {
  const v = raw.trim();
  if (/^(https?:|mailto:)/i.test(v)) return v.replace(/"/g, "&quot;");
  return null;
}

export function sanitizeHtml(input: string): string {
  if (!input) return "";
  let out = "";
  let i = 0;
  while (i < input.length) {
    const lt = input.indexOf("<", i);
    if (lt === -1) {
      out += escapeText(input.slice(i));
      break;
    }
    out += escapeText(input.slice(i, lt));
    const gt = input.indexOf(">", lt);
    if (gt === -1) {
      out += escapeText(input.slice(lt));
      break;
    }
    const raw = input.slice(lt + 1, gt).trim();
    i = gt + 1;
    const closing = raw.startsWith("/");
    const body = closing ? raw.slice(1).trim() : raw.replace(/\/$/, "").trim();
    const match = body.match(/^([a-zA-Z]+)(\s+[\s\S]*)?$/);
    if (!match) continue;
    const tag = match[1].toLowerCase();
    if (!ALLOWED_TAGS.has(tag)) continue;
    if (closing) {
      if (!VOID_TAGS.has(tag)) out += `</${tag}>`;
      continue;
    }
    if (tag === "a") {
      const attrs = match[2] ?? "";
      const hrefMatch = attrs.match(/href\s*=\s*("([^"]*)"|'([^']*)')/i);
      const href = hrefMatch ? safeHref(hrefMatch[2] ?? hrefMatch[3] ?? "") : null;
      out += href
        ? `<a href="${href}" target="_blank" rel="noopener noreferrer">`
        : "<a>";
    } else if (VOID_TAGS.has(tag)) {
      out += `<${tag} />`;
    } else {
      out += `<${tag}>`;
    }
  }
  return out;
}
