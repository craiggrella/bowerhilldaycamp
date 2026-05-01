"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Header from "@/components/Header";
import { getSupabaseBrowser } from "@/lib/supabase-browser";

export default function SetPasswordPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gray-50" />}>
      <SetPasswordInner />
    </Suspense>
  );
}

function SetPasswordInner() {
  const router = useRouter();
  const supabase = getSupabaseBrowser();

  const [hasSession, setHasSession] = useState<boolean | null>(null);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function init() {
      // 1. If a session already exists (e.g., they navigated back here while
      //    signed in), nothing to do.
      const { data: existing } = await supabase.auth.getSession();
      if (existing.session) {
        if (!cancelled) setHasSession(true);
        return;
      }

      // 2. PKCE flow: ?code=... in the query string.
      const url = new URL(window.location.href);
      const code = url.searchParams.get("code");
      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (!error && !cancelled) {
          window.history.replaceState({}, "", url.pathname);
          setHasSession(true);
          return;
        }
      }

      // 3. Implicit/recovery flow: tokens in the URL hash. This is what
      //    Supabase's invite/recovery links actually deliver.
      const hash = window.location.hash;
      if (hash && hash.length > 1) {
        const params = new URLSearchParams(hash.slice(1));
        const access_token = params.get("access_token");
        const refresh_token = params.get("refresh_token");
        if (access_token && refresh_token) {
          const { error } = await supabase.auth.setSession({
            access_token,
            refresh_token,
          });
          if (!error && !cancelled) {
            window.history.replaceState({}, "", url.pathname);
            setHasSession(true);
            return;
          }
        }
      }

      if (!cancelled) setHasSession(false);
    }

    init();
    return () => {
      cancelled = true;
    };
  }, [supabase]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords don't match.");
      return;
    }
    setSubmitting(true);
    const { error: updateErr } = await supabase.auth.updateUser({ password });
    setSubmitting(false);
    if (updateErr) {
      setError(updateErr.message);
      return;
    }
    router.replace("/admin");
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header rightText="Admin" />

      <div className="max-w-md mx-auto px-6 py-16">
        <h1 className="text-3xl font-bold text-[var(--color-primary)] mb-2">Set your password</h1>

        {hasSession === null && (
          <p className="text-gray-500">Loading…</p>
        )}

        {hasSession === false && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 text-sm text-amber-900">
            <p className="font-semibold mb-1">This invite link has expired or already been used.</p>
            <p>Ask an existing admin to send you a new invite.</p>
          </div>
        )}

        {hasSession === true && (
          <>
            <p className="text-gray-500 mb-6">Pick a password — at least 8 characters.</p>
            <form onSubmit={handleSubmit} className="grid gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="pw">
                  New password
                </label>
                <input
                  id="pw"
                  type="password"
                  required
                  minLength={8}
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="pw2">
                  Confirm password
                </label>
                <input
                  id="pw2"
                  type="password"
                  required
                  minLength={8}
                  autoComplete="new-password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] focus:border-transparent"
                />
              </div>
              {error && <p className="text-sm text-red-600">{error}</p>}
              <button
                type="submit"
                disabled={submitting}
                className="bg-[var(--color-primary)] hover:bg-[var(--color-primary-light)] disabled:opacity-50 text-white font-bold text-base py-3 rounded-full transition-colors"
              >
                {submitting ? "Saving…" : "Save password & continue"}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
