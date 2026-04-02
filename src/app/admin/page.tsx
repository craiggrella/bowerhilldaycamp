"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import Header from "@/components/Header";

type Activity = { id: string; name: string; type: string };
type CampType = { id: string; name: string };

type CamperRow = {
  id: string;
  first_name: string;
  last_name: string | null;
  camp_type_id: string;
  registration_id: string;
  created_at: string;
  camp_types: { name: string } | null;
  registrations: { status: string; amount_cents: number | null; stripe_payment_id: string | null; created_at: string } | null;
  guardians: { first_name: string; last_name: string; email: string; phone: string }[];
  camper_activity_choices: { activity_id: string }[];
};

type Tab = "registrations" | "activities";

export default function AdminPage() {
  const [campers, setCampers] = useState<CamperRow[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [campTypes, setCampTypes] = useState<CampType[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("registrations");
  const [campFilter, setCampFilter] = useState("all");
  const [activityFilter, setActivityFilter] = useState("all");

  useEffect(() => {
    async function fetch() {
      const [camperRes, actRes, campRes] = await Promise.all([
        supabase.from("campers").select(`
          id, first_name, last_name, camp_type_id, registration_id, created_at,
          camp_types (name),
          registrations (status, amount_cents, stripe_payment_id, created_at),
          camper_activity_choices (activity_id)
        `).order("created_at", { ascending: false }),
        supabase.from("activities").select("*").order("type").order("name"),
        supabase.from("camp_types").select("*"),
      ]);

      // Fetch guardians separately by registration IDs
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const regIds = [...new Set((camperRes.data || []).map((c: any) => c.registration_id))];
      const guardianRes = regIds.length > 0
        ? await supabase.from("guardians").select("*").in("registration_id", regIds)
        : { data: [] };

      const guardianMap: Record<string, { first_name: string; last_name: string; email: string; phone: string }[]> = {};
      for (const g of guardianRes.data || []) {
        const rid = (g as { registration_id: string }).registration_id;
        if (!guardianMap[rid]) guardianMap[rid] = [];
        guardianMap[rid].push(g as { first_name: string; last_name: string; email: string; phone: string });
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const enriched = (camperRes.data || []).map((c: any) => ({
        ...c,
        guardians: guardianMap[c.registration_id] || [],
      }));

      setCampers(enriched as CamperRow[]);
      setActivities(actRes.data || []);
      setCampTypes(campRes.data || []);
      setLoading(false);
    }
    fetch();
  }, []);

  const activityMap: Record<string, Activity> = {};
  for (const a of activities) activityMap[a.id] = a;

  // Stats
  const dayCampCount = campers.filter((c) => c.camp_types?.name === "Day Camp").length;
  const jrCampCount = campers.filter((c) => c.camp_types?.name === "Jr Day Camp").length;
  const totalRevenue = campers.reduce((sum, c) => {
    const campType = campTypes.find((ct) => ct.id === c.camp_type_id);
    // We don't have price on camper, use registration amount or estimate
    return sum + (c.registrations?.amount_cents || 0);
  }, 0);

  // Activity counts
  const activityCounts: Record<string, number> = {};
  for (const c of campers) {
    for (const choice of c.camper_activity_choices || []) {
      activityCounts[choice.activity_id] = (activityCounts[choice.activity_id] || 0) + 1;
    }
  }

  // Filtered campers for registrations tab
  const filteredCampers = campFilter === "all"
    ? campers
    : campers.filter((c) => c.camp_types?.name === campFilter);

  // Filtered campers for activity tab
  const activityCampers = activityFilter === "all"
    ? campers
    : campers.filter((c) =>
        (c.camper_activity_choices || []).some((ch) => ch.activity_id === activityFilter)
      );

  return (
    <div className="min-h-screen bg-gray-50">
      <Header rightText="Admin Dashboard" />

      <div className="max-w-6xl mx-auto px-6 py-8">
        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
            <div className="text-3xl font-black text-[var(--color-primary)]">{campers.length}</div>
            <div className="text-sm text-gray-400">Total Campers</div>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
            <div className="text-3xl font-black text-orange-500">{dayCampCount}</div>
            <div className="text-sm text-gray-400">Day Camp</div>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
            <div className="text-3xl font-black text-green-500">{jrCampCount}</div>
            <div className="text-sm text-gray-400">Jr Day Camp</div>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
            <div className="text-3xl font-black text-[var(--color-accent)]">
              ${(totalRevenue / 100).toFixed(0) || "0"}
            </div>
            <div className="text-sm text-gray-400">Revenue</div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-6 bg-gray-100 rounded-lg p-1 w-fit">
          <button
            onClick={() => setTab("registrations")}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              tab === "registrations" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
            }`}
          >
            Registrations
          </button>
          <button
            onClick={() => setTab("activities")}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              tab === "activities" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
            }`}
          >
            By Activity
          </button>
        </div>

        {loading && <p className="text-gray-400">Loading...</p>}

        {/* ========== REGISTRATIONS TAB ========== */}
        {!loading && tab === "registrations" && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-900">
                Campers ({filteredCampers.length})
              </h2>
              <select
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
                value={campFilter}
                onChange={(e) => setCampFilter(e.target.value)}
              >
                <option value="all">All Camps</option>
                <option value="Day Camp">Day Camp</option>
                <option value="Jr Day Camp">Jr Day Camp</option>
              </select>
            </div>

            {filteredCampers.length === 0 ? (
              <p className="text-gray-400">No registrations yet.</p>
            ) : (
              <div className="grid gap-3">
                {filteredCampers.map((c) => {
                  const guardian = c.guardians?.[0];
                  const chosenActivities = (c.camper_activity_choices || [])
                    .map((ch) => activityMap[ch.activity_id])
                    .filter(Boolean);
                  return (
                    <div key={c.id} className="bg-white rounded-xl border border-gray-200 p-5">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <h3 className="font-bold text-gray-900 text-lg">
                            {c.first_name} {c.last_name || ""}
                          </h3>
                          <div className="flex items-center gap-2 mt-1">
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

                      {/* Guardian */}
                      {guardian && (
                        <div className="text-sm text-gray-500 mb-2">
                          Parent: {guardian.first_name} {guardian.last_name} &bull; {guardian.email} &bull; {guardian.phone}
                        </div>
                      )}

                      {/* Activities */}
                      {chosenActivities.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mt-2">
                          {chosenActivities.map((a) => (
                            <span key={a.id} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                              {a.name}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ========== ACTIVITIES TAB ========== */}
        {!loading && tab === "activities" && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-900">Activity Breakdown</h2>
              <select
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
                value={activityFilter}
                onChange={(e) => setActivityFilter(e.target.value)}
              >
                <option value="all">All Activities</option>
                {activities.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name} ({activityCounts[a.id] || 0})
                  </option>
                ))}
              </select>
            </div>

            {/* Activity summary cards */}
            {activityFilter === "all" && (
              <div className="grid sm:grid-cols-2 gap-3 mb-8">
                {activities.map((a) => {
                  const count = activityCounts[a.id] || 0;
                  return (
                    <button
                      key={a.id}
                      onClick={() => setActivityFilter(a.id)}
                      className="bg-white rounded-xl border border-gray-200 p-4 text-left hover:border-[var(--color-accent)] transition-colors"
                    >
                      <div className="flex justify-between items-center">
                        <div>
                          <h3 className="font-bold text-gray-900">{a.name}</h3>
                          <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                            a.type === "Creative" ? "bg-purple-100 text-purple-700" :
                            a.type === "Active" ? "bg-orange-100 text-orange-700" :
                            a.type === "Spiritual" ? "bg-blue-100 text-blue-700" :
                            "bg-green-100 text-green-700"
                          }`}>
                            {a.type}
                          </span>
                        </div>
                        <div className={`text-3xl font-black ${count === 0 ? "text-red-400" : count < 3 ? "text-amber-500" : "text-[var(--color-primary)]"}`}>
                          {count}
                        </div>
                      </div>
                      {count === 0 && (
                        <p className="text-red-400 text-xs mt-1">No sign-ups yet</p>
                      )}
                      {count > 0 && count < 3 && (
                        <p className="text-amber-500 text-xs mt-1">Low interest — consider cutting</p>
                      )}
                    </button>
                  );
                })}
              </div>
            )}

            {/* Filtered camper list */}
            {activityFilter !== "all" && (
              <div>
                <button
                  onClick={() => setActivityFilter("all")}
                  className="text-sm text-[var(--color-primary)] mb-4 hover:underline"
                >
                  &larr; Back to all activities
                </button>
                <h3 className="font-bold text-gray-900 mb-3">
                  {activityMap[activityFilter]?.name} — {activityCampers.length} camper{activityCampers.length !== 1 ? "s" : ""}
                </h3>
                {activityCampers.length === 0 ? (
                  <p className="text-gray-400">No campers signed up for this activity.</p>
                ) : (
                  <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 border-b border-gray-200">
                        <tr>
                          <th className="text-left px-4 py-3 font-medium text-gray-600">Camper</th>
                          <th className="text-left px-4 py-3 font-medium text-gray-600">Camp</th>
                          <th className="text-left px-4 py-3 font-medium text-gray-600">Parent</th>
                          <th className="text-left px-4 py-3 font-medium text-gray-600">Contact</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {activityCampers.map((c) => {
                          const guardian = c.guardians?.[0];
                          return (
                            <tr key={c.id} className="hover:bg-gray-50">
                              <td className="px-4 py-3 font-medium">
                                {c.first_name} {c.last_name || ""}
                              </td>
                              <td className="px-4 py-3 text-gray-500">
                                {c.camp_types?.name}
                              </td>
                              <td className="px-4 py-3 text-gray-500">
                                {guardian ? `${guardian.first_name} ${guardian.last_name}` : "—"}
                              </td>
                              <td className="px-4 py-3 text-gray-500">
                                {guardian ? guardian.phone : "—"}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
