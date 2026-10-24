"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Header from "@/components/Header";

type AdminUser = {
  id: string;
  email: string;
  role: "owner" | "staff";
  created_at: string;
  last_sign_in_at: string | null;
  invited_pending: boolean;
};

type Me = { id: string; email: string; role: "owner" | "staff" };

export default function ManageAdminsPage() {
  const router = useRouter();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);

  // Invite form
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"staff" | "owner">("staff");
  const [inviteState, setInviteState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [inviteError, setInviteError] = useState<string | null>(null);

  async function load() {
    const [usersRes, meRes] = await Promise.all([
      fetch("/api/admin/users"),
      fetch("/api/admin/me"),
    ]);
    if (usersRes.status === 401 || meRes.status === 401) {
      router.replace("/admin/login");
      return;
    }
    const usersData = await usersRes.json();
    const meData = await meRes.json();
    setUsers(usersData.users || []);
    setMe(meData.user || null);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    setInviteState("sending");
    setInviteError(null);
    const res = await fetch("/api/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: inviteEmail.trim(), role: inviteRole }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setInviteState("error");
      setInviteError(data.error || `HTTP ${res.status}`);
      return;
    }
    setInviteState("sent");
    setInviteEmail("");
    setInviteRole("staff");
    await load();
    setTimeout(() => setInviteState("idle"), 3000);
  }

  async function handleRevoke(u: AdminUser) {
    if (!confirm(`Revoke admin access for ${u.email}? They won't be able to sign in.`)) return;
    const res = await fetch(`/api/admin/users/${u.id}`, { method: "DELETE" });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      alert(data.error || `HTTP ${res.status}`);
      return;
    }
    await load();
  }

  async function handleRoleChange(u: AdminUser, role: "owner" | "staff") {
    if (u.role === role) return;
    const res = await fetch(`/api/admin/users/${u.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      alert(data.error || `HTTP ${res.status}`);
      return;
    }
    await load();
  }

  const isOwner = me?.role === "owner";

  return (
    <div className="min-h-screen bg-white">
      <Header rightText="Admin" />

      <div className="max-w-3xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-6 gap-3 flex-wrap">
          <div>
            <Link href="/admin" className="text-sm text-[var(--color-primary)] hover:underline font-medium">
              &larr; Back to Dashboard
            </Link>
            <h1 className="text-2xl font-bold text-[var(--color-primary)] mt-1">Manage admins</h1>
          </div>
          <Link
            href="/admin/profile"
            className="bg-white border border-gray-300 text-gray-600 font-medium text-sm px-4 py-2 rounded-lg hover:bg-gray-100 transition-colors"
          >
            My Account
          </Link>
        </div>

        {/* Invite form (owner only) */}
        {isOwner && (
          <form
            onSubmit={handleInvite}
            className="bg-white border border-gray-200 rounded-xl p-5 mb-6"
          >
            <h2 className="font-semibold text-gray-900 mb-3">Invite a new admin</h2>
            <div className="flex flex-wrap items-end gap-3">
              <div className="flex-1 min-w-[220px]">
                <label className="block text-xs font-medium text-gray-500 mb-1" htmlFor="invite-email">
                  Email
                </label>
                <input
                  id="invite-email"
                  type="email"
                  required
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] focus:border-transparent"
                  placeholder="someone@example.com"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1" htmlFor="invite-role">
                  Role
                </label>
                <select
                  id="invite-role"
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value as "staff" | "owner")}
                  className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
                >
                  <option value="staff">Staff</option>
                  <option value="owner">Owner</option>
                </select>
              </div>
              <button
                type="submit"
                disabled={inviteState === "sending"}
                className="bg-[var(--color-primary)] hover:bg-[var(--color-primary-light)] disabled:opacity-50 text-white font-bold text-sm px-5 py-2 rounded-lg transition-colors"
              >
                {inviteState === "sending" ? "Sending…" : "Send invite"}
              </button>
            </div>
            {inviteState === "sent" && (
              <p className="text-sm text-emerald-700 mt-3">Invite email sent.</p>
            )}
            {inviteState === "error" && (
              <p className="text-sm text-red-600 mt-3">Error: {inviteError}</p>
            )}
            <p className="text-xs text-gray-500 mt-3 leading-snug">
              <strong>Staff</strong> can view the dashboard, resend emails, and add manual registrations. <strong>Owner</strong> can also invite, revoke, and (later) delete data.
            </p>
          </form>
        )}

        {/* User list */}
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          {loading ? (
            <p className="p-5 text-gray-400">Loading…</p>
          ) : users.length === 0 ? (
            <p className="p-5 text-gray-400">No admins yet.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50 text-left">
                  <th className="py-2 px-4 font-bold text-gray-700">Email</th>
                  <th className="py-2 px-4 font-bold text-gray-700">Role</th>
                  <th className="py-2 px-4 font-bold text-gray-700">Status</th>
                  {isOwner && <th className="py-2 px-4 font-bold text-gray-700"></th>}
                </tr>
              </thead>
              <tbody>
                {users.map((u) => {
                  const isMe = me?.id === u.id;
                  return (
                    <tr key={u.id} className="border-b border-gray-100 last:border-0">
                      <td className="py-3 px-4">
                        <span className="font-medium">{u.email}</span>
                        {isMe && <span className="text-xs text-gray-400 ml-2">(you)</span>}
                      </td>
                      <td className="py-3 px-4">
                        {isOwner && !isMe ? (
                          <select
                            value={u.role}
                            onChange={(e) => handleRoleChange(u, e.target.value as "owner" | "staff")}
                            className="border border-gray-300 rounded px-2 py-1 text-xs"
                          >
                            <option value="staff">Staff</option>
                            <option value="owner">Owner</option>
                          </select>
                        ) : (
                          <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                            u.role === "owner"
                              ? "bg-blue-100 text-blue-700"
                              : "bg-gray-100 text-gray-700"
                          }`}>
                            {u.role === "owner" ? "Owner" : "Staff"}
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-xs text-gray-500">
                        {u.invited_pending ? (
                          <span className="text-amber-600 font-medium">Invite pending</span>
                        ) : u.last_sign_in_at ? (
                          <>Last sign-in {new Date(u.last_sign_in_at).toLocaleDateString()}</>
                        ) : (
                          "—"
                        )}
                      </td>
                      {isOwner && (
                        <td className="py-3 px-4 text-right">
                          {!isMe && (
                            <button
                              onClick={() => handleRevoke(u)}
                              className="text-xs font-bold text-red-600 hover:text-red-800"
                            >
                              Revoke
                            </button>
                          )}
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {!isOwner && !loading && (
          <p className="text-xs text-gray-500 mt-4">
            You're signed in as <strong>Staff</strong>. Only owners can invite or revoke admins.
          </p>
        )}
      </div>
    </div>
  );
}
