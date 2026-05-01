"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Header from "@/components/Header";
import { getSupabaseBrowser } from "@/lib/supabase-browser";

type Me = { id: string; email: string; role: "owner" | "staff" };

export default function AdminProfilePage() {
  const router = useRouter();
  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState<"idle" | "saved" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const res = await fetch("/api/admin/me");
      if (res.status === 401) {
        router.replace("/admin/login");
        return;
      }
      const data = await res.json();
      setMe(data.user);
      setLoading(false);
    }
    load();
  }, [router]);

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setStatus("idle");
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords don't match.");
      return;
    }
    setSubmitting(true);
    const supabase = getSupabaseBrowser();
    const { error: updateErr } = await supabase.auth.updateUser({ password });
    setSubmitting(false);
    if (updateErr) {
      setError(updateErr.message);
      setStatus("error");
      return;
    }
    setPassword("");
    setConfirm("");
    setStatus("saved");
    setTimeout(() => setStatus("idle"), 4000);
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header rightText="Admin" />

      <div className="max-w-md mx-auto px-6 py-8">
        <Link
          href="/admin"
          className="text-sm text-[var(--color-primary)] hover:underline font-medium"
        >
          &larr; Back to Dashboard
        </Link>
        <h1 className="text-2xl font-bold text-[var(--color-primary)] mt-1 mb-6">My Account</h1>

        {loading ? (
          <p className="text-gray-400">Loading…</p>
        ) : !me ? (
          <p className="text-gray-400">Couldn&apos;t load your account.</p>
        ) : (
          <>
            <div className="bg-white border border-gray-200 rounded-xl p-5 mb-6">
              <div className="grid gap-3 text-sm">
                <div>
                  <div className="text-xs uppercase tracking-wide text-gray-400 font-medium mb-1">
                    Email
                  </div>
                  <div className="font-medium text-gray-900">{me.email}</div>
                </div>
                <div>
                  <div className="text-xs uppercase tracking-wide text-gray-400 font-medium mb-1">
                    Role
                  </div>
                  <span
                    className={`inline-block text-xs font-bold px-2 py-0.5 rounded-full ${
                      me.role === "owner"
                        ? "bg-blue-100 text-blue-700"
                        : "bg-gray-100 text-gray-700"
                    }`}
                  >
                    {me.role === "owner" ? "Owner" : "Staff"}
                  </span>
                </div>
              </div>
            </div>

            <form
              onSubmit={handleChangePassword}
              className="bg-white border border-gray-200 rounded-xl p-5"
            >
              <h2 className="font-semibold text-gray-900 mb-3">Change password</h2>
              <div className="grid gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1" htmlFor="new-pw">
                    New password
                  </label>
                  <input
                    id="new-pw"
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
                  <label className="block text-xs font-medium text-gray-500 mb-1" htmlFor="confirm-pw">
                    Confirm new password
                  </label>
                  <input
                    id="confirm-pw"
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
                {status === "saved" && (
                  <p className="text-sm text-emerald-700">Password updated.</p>
                )}
                <button
                  type="submit"
                  disabled={submitting}
                  className="bg-[var(--color-primary)] hover:bg-[var(--color-primary-light)] disabled:opacity-50 text-white font-bold text-sm px-5 py-2 rounded-lg transition-colors"
                >
                  {submitting ? "Saving…" : "Update password"}
                </button>
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
