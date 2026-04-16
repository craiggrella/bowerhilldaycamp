"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Header from "@/components/Header";

type CampType = { id: string; name: string };

type CamperRow = {
  id: string;
  first_name: string;
  last_name: string | null;
  camp_type_id: string;
  afternoon_opt_out: boolean;
  registration_id: string;
  created_at: string;
  camp_types: { name: string } | null;
  registrations: { status: string; amount_cents: number | null; stripe_payment_id: string | null; created_at: string } | null;
};

type Guardian = {
  registration_id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
};

export default function AdminPage() {
  const router = useRouter();
  const [campers, setCampers] = useState<CamperRow[]>([]);
  const [guardiansByReg, setGuardiansByReg] = useState<Record<string, Guardian[]>>({});
  const [campTypes, setCampTypes] = useState<CampType[]>([]);
  const [loading, setLoading] = useState(true);
  const [campFilter, setCampFilter] = useState("all");
  const [nameFilter, setNameFilter] = useState("");

  useEffect(() => {
    async function load() {
      const res = await fetch("/api/admin/dashboard");
      if (res.status === 401) {
        router.replace("/admin/login");
        return;
      }
      const data = await res.json();
      setCampers(data.campers || []);
      setCampTypes(data.campTypes || []);
      const map: Record<string, Guardian[]> = {};
      for (const g of (data.guardians || []) as Guardian[]) {
        if (!map[g.registration_id]) map[g.registration_id] = [];
        map[g.registration_id].push(g);
      }
      setGuardiansByReg(map);
      setLoading(false);
    }
    load();
  }, [router]);

  async function handleSignOut() {
    await fetch("/api/admin/signout", { method: "POST" });
    router.replace("/admin/login");
    router.refresh();
  }

  // Stats
  const dayCampers = campers.filter((c) => c.camp_types?.name === "Day Camp");
  const dayCampCount = dayCampers.length;
  const dayCampFull = dayCampers.filter((c) => !c.afternoon_opt_out).length;
  const dayCampHalf = dayCampers.filter((c) => c.afternoon_opt_out).length;
  const jrCampCount = campers.filter((c) => c.camp_types?.name === "Jr Day Camp").length;
  // Revenue is computed per-registration, not per-camper — dedupe by registration_id
  // so multi-camper registrations aren't counted multiple times.
  const seenRegs = new Set<string>();
  let totalRevenue = 0;
  for (const c of campers) {
    if (seenRegs.has(c.registration_id)) continue;
    seenRegs.add(c.registration_id);
    totalRevenue += c.registrations?.amount_cents || 0;
  }

  const nq = nameFilter.trim().toLowerCase();
  const filteredCampers = campers
    .filter((c) => (campFilter === "all" ? true : c.camp_types?.name === campFilter))
    .filter((c) => {
      if (!nq) return true;
      const g = guardiansByReg[c.registration_id]?.[0];
      const haystack = [c.first_name, c.last_name || "", g?.first_name || "", g?.last_name || "", g?.email || "", g?.phone || ""]
        .join(" ")
        .toLowerCase();
      return haystack.includes(nq);
    });

  return (
    <div className="min-h-screen bg-gray-50">
      <Header rightText="Admin Dashboard" />

      <div className="max-w-6xl mx-auto px-6 py-8">
        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white rounded-xl border border-gray-200 p-4 text-center flex flex-col justify-center min-h-[140px]">
            <div className="text-3xl font-black text-[var(--color-primary)]">{campers.length}</div>
            <div className="text-sm text-gray-400">Total Campers</div>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4 text-center flex flex-col justify-center min-h-[140px]">
            <div className="text-3xl font-black text-orange-500">{dayCampCount}</div>
            <div className="text-sm text-gray-400">Day Camp</div>
            <div className="text-xs text-gray-500 mt-2 leading-snug">
              <div>{dayCampFull} Full Day</div>
              <div>{dayCampHalf} Morning Only</div>
            </div>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4 text-center flex flex-col justify-center min-h-[140px]">
            <div className="text-3xl font-black text-green-500">{jrCampCount}</div>
            <div className="text-sm text-gray-400">Jr Day Camp</div>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4 text-center flex flex-col justify-center min-h-[140px]">
            <div className="text-3xl font-black text-[var(--color-accent)]">
              ${(totalRevenue / 100).toLocaleString("en-US", { maximumFractionDigits: 0 })}
            </div>
            <div className="text-sm text-gray-400">Revenue</div>
          </div>
        </div>

        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-gray-900">Registrations</h2>
          <div className="flex items-center gap-2">
            <a
              href="/admin/roster"
              className="bg-[var(--color-primary)] text-white font-bold text-sm px-5 py-2 rounded-lg hover:bg-[var(--color-primary-light)] transition-colors"
            >
              Print Roster
            </a>
            <button
              onClick={handleSignOut}
              className="bg-white border border-gray-300 text-gray-600 font-medium text-sm px-4 py-2 rounded-lg hover:bg-gray-100 transition-colors"
            >
              Sign Out
            </button>
          </div>
        </div>

        {loading && <p className="text-gray-400">Loading...</p>}

        {!loading && (
          <div>
            <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
              <h3 className="text-lg font-bold text-gray-900">
                Campers ({filteredCampers.length})
              </h3>
              <div className="flex items-center gap-3 flex-1 justify-end">
                <input
                  type="search"
                  placeholder="Search by camper or parent name, email, phone…"
                  value={nameFilter}
                  onChange={(e) => setNameFilter(e.target.value)}
                  className="flex-1 max-w-md border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] focus:border-transparent"
                />
                <select
                  className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  value={campFilter}
                  onChange={(e) => setCampFilter(e.target.value)}
                >
                  <option value="all">All Camps</option>
                  {campTypes.map((ct) => (
                    <option key={ct.id} value={ct.name}>{ct.name}</option>
                  ))}
                </select>
              </div>
            </div>

            {filteredCampers.length === 0 ? (
              <p className="text-gray-400">No registrations yet.</p>
            ) : (
              <div className="grid gap-3">
                {filteredCampers.map((c) => {
                  const guardian = guardiansByReg[c.registration_id]?.[0];
                  return (
                    <div key={c.id} className="bg-white rounded-xl border border-gray-200 p-5">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <div className="flex items-baseline gap-4">
                            <div>
                              <div className="text-[10px] uppercase tracking-wide text-gray-400 font-medium">First Name</div>
                              <div className="font-bold text-gray-900 text-lg leading-tight">{c.first_name}</div>
                            </div>
                            <div>
                              <div className="text-[10px] uppercase tracking-wide text-gray-400 font-medium">Last Name</div>
                              <div className="font-bold text-gray-900 text-lg leading-tight">{c.last_name || "—"}</div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 mt-2">
                            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                              c.camp_types?.name === "Day Camp"
                                ? "bg-orange-100 text-orange-700"
                                : "bg-green-100 text-green-700"
                            }`}>
                              {c.camp_types?.name}
                            </span>
                            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                              c.registrations?.status === "paid"
                                ? "bg-emerald-100 text-emerald-700"
                                : "bg-red-100 text-red-700"
                            }`}>
                              {c.registrations?.status || "unknown"}
                            </span>
                          </div>
                        </div>
                        <div className="text-right text-sm">
                          <div className="text-gray-400">
                            {c.registrations?.created_at
                              ? new Date(c.registrations.created_at).toLocaleDateString()
                              : ""}
                          </div>
                          {c.registrations?.stripe_payment_id && (
                            <div className="text-gray-300 text-xs font-mono mt-0.5">
                              {c.registrations.stripe_payment_id.slice(0, 20)}...
                            </div>
                          )}
                        </div>
                      </div>

                      {guardian && (
                        <div className="text-sm text-gray-500 mb-2">
                          Parent: {guardian.first_name} {guardian.last_name} &bull; {guardian.email} &bull; {guardian.phone}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
