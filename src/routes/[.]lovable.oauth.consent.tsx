import { createFileRoute, redirect } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Loader2, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useTheme } from "@/hooks/use-theme";

// Beta namespace — provide a local typed shim so we can call the three methods
// without TypeScript errors.
type OAuthDetails = {
  client?: { name?: string; client_name?: string; redirect_uris?: string[] };
  scope?: string;
  redirect_url?: string;
  redirect_to?: string;
};
type OAuthNamespace = {
  getAuthorizationDetails: (id: string) => Promise<{ data: OAuthDetails | null; error: { message: string } | null }>;
  approveAuthorization: (id: string) => Promise<{ data: OAuthDetails | null; error: { message: string } | null }>;
  denyAuthorization: (id: string) => Promise<{ data: OAuthDetails | null; error: { message: string } | null }>;
};
function oauth(): OAuthNamespace {
  return (supabase.auth as unknown as { oauth: OAuthNamespace }).oauth;
}

export const Route = createFileRoute("/.lovable/oauth/consent")({
  // Browser-only: Supabase reads session from localStorage; without this SSR
  // sees no session and always bounces to /auth.
  ssr: false,
  validateSearch: (s: Record<string, unknown>) => ({
    authorization_id: typeof s.authorization_id === "string" ? s.authorization_id : "",
  }),
  beforeLoad: async ({ search, location }) => {
    if (!search.authorization_id) throw new Error("Missing authorization_id");
    const { data } = await supabase.auth.getSession();
    if (!data.session) {
      const next = location.pathname + location.searchStr;
      throw redirect({ to: "/auth", search: { next } });
    }
  },
  component: Consent,
  errorComponent: ({ error }) => (
    <div className="min-h-screen grid place-items-center px-6 py-12">
      <div className="max-w-md text-center">
        <h1 className="font-display text-xl">Could not load authorization request</h1>
        <p className="mt-2 text-sm text-muted-foreground">{String((error as Error)?.message ?? error)}</p>
      </div>
    </div>
  ),
});

function Consent() {
  useTheme();
  const { authorization_id } = Route.useSearch();
  const [details, setDetails] = useState<OAuthDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error } = await oauth().getAuthorizationDetails(authorization_id);
      if (cancelled) return;
      if (error) {
        setError(error.message);
        setLoading(false);
        return;
      }
      const immediate = data?.redirect_url ?? data?.redirect_to;
      if (immediate && !data?.client) {
        window.location.href = immediate;
        return;
      }
      setDetails(data);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [authorization_id]);

  async function decide(approve: boolean) {
    setBusy(true);
    setError(null);
    const { data, error } = approve
      ? await oauth().approveAuthorization(authorization_id)
      : await oauth().denyAuthorization(authorization_id);
    if (error) {
      setBusy(false);
      setError(error.message);
      return;
    }
    const target = data?.redirect_url ?? data?.redirect_to;
    if (!target) {
      setBusy(false);
      setError("No redirect returned by the authorization server.");
      return;
    }
    window.location.href = target;
  }

  const clientName = details?.client?.name ?? details?.client?.client_name ?? "an app";
  const scopes = (details?.scope ?? "").split(/\s+/).filter(Boolean);

  return (
    <div className="min-h-screen grid place-items-center px-6 py-12 relative overflow-hidden">
      <div className="pointer-events-none absolute inset-0 opacity-50">
        <div
          className="absolute -top-40 -left-32 h-96 w-96 rounded-full blur-3xl"
          style={{ background: "var(--gradient-accent)" }}
        />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative w-full max-w-md rounded-3xl glass-strong p-8 shadow-float"
      >
        <div className="flex items-center gap-2.5 mb-4">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary/15 text-primary">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div>
            <div className="font-display text-lg leading-none">Authorize access</div>
            <div className="text-[11px] text-muted-foreground mt-1">Pen Flow · MCP</div>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground py-6">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading authorization request…
          </div>
        ) : (
          <>
            <h1 className="font-display text-2xl tracking-tight">Connect {clientName} to Pen Flow?</h1>
            <p className="text-sm text-muted-foreground mt-2">
              This lets <span className="font-medium text-foreground">{clientName}</span> use Pen Flow as you — reading
              and modifying your notes and folders through the MCP tools.
            </p>

            {scopes.length > 0 && (
              <div className="mt-4 rounded-xl border border-border/60 bg-background/50 p-3">
                <div className="text-[11px] uppercase tracking-widest text-muted-foreground mb-1">Requested scopes</div>
                <div className="text-xs text-foreground/90">{scopes.join(", ")}</div>
              </div>
            )}

            <p className="text-[11px] text-muted-foreground mt-3">
              This does not bypass Pen Flow's permissions — your notes stay scoped to your account.
            </p>

            {error && <div className="mt-3 text-xs text-destructive">{error}</div>}

            <div className="mt-6 flex gap-2">
              <button
                disabled={busy}
                onClick={() => decide(false)}
                className="flex-1 rounded-xl border border-border/60 bg-background/50 px-4 py-3 text-sm font-medium hover:bg-accent transition disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                disabled={busy}
                onClick={() => decide(true)}
                className="flex-1 rounded-xl px-4 py-3 text-sm font-medium text-primary-foreground shadow-float disabled:opacity-50 flex items-center justify-center gap-2"
                style={{ background: "var(--gradient-accent)" }}
              >
                {busy && <Loader2 className="h-4 w-4 animate-spin" />} Approve
              </button>
            </div>
          </>
        )}
      </motion.div>
    </div>
  );
}
