"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Header from "@/components/Header";

type EmergencyContact = {
  first_name: string;
  last_name: string;
  phone: string;
  relationship: string;
};

type RosterEntry = {
  id: string;
  first_name: string;
  last_name: string | null;
  grade: string | null;
  camp_type_name: string;
  afternoon_opt_out: boolean;
  registration_id: string;
  guardian_name: string;
  guardian_phone: string;
  guardian_email: string;
  emergency_contacts: EmergencyContact[];
  allergies: string;
  medical_notes: string;
};

type RawCamper = {
  id: string;
  first_name: string;
  last_name: string | null;
  grade: string | null;
  afternoon_opt_out: boolean;
  registration_id: string;
  camp_types: { name: string } | { name: string }[] | null;
};

type RawGuardian = {
  registration_id: string;
  first_name: string;
  last_name: string;
  phone: string;
  email: string;
};

type RawJunction = {
  camper_id: string;
  emergency_contacts: EmergencyContact | EmergencyContact[] | null;
};

type RawLegacy = {
  registration_id: string;
  first_name: string;
  last_name: string;
  phone: string;
  relationship: string;
};

type RawMedical = {
  camper_id: string;
  allergies: string | null;
  medications: string | null;
  special_needs: string | null;
};

type SortField =
  | "first_name"
  | "last_name"
  | "grade"
  | "camp_type_name"
  | "guardian_name";
type SortDir = "asc" | "desc";

export default function RosterPage() {
  const router = useRouter();
  const [roster, setRoster] = useState<RosterEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [campFilter, setCampFilter] = useState("all");
  const [query, setQuery] = useState("");
  const [sortField, setSortField] = useState<SortField>("last_name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  function toggleSort(field: SortField) {
    if (sortField === field) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDir("asc");
    }
  }

  function sortArrow(field: SortField) {
    if (sortField !== field) return <span className="text-gray-300 ml-1">⇅</span>;
    return <span className="ml-1">{sortDir === "asc" ? "▲" : "▼"}</span>;
  }

  useEffect(() => {
    async function load() {
      const res = await fetch("/api/admin/roster");
      if (res.status === 401) {
        router.replace("/admin/login");
        return;
      }
      const data = await res.json();
      const campers: RawCamper[] = data.campers || [];
      const guardians: RawGuardian[] = data.guardians || [];
      const junctions: RawJunction[] = data.junctions || [];
      const legacyContacts: RawLegacy[] = data.legacyContacts || [];
      const medical: RawMedical[] = data.medical || [];

      const guardianMap: Record<string, RawGuardian> = {};
      for (const g of guardians) guardianMap[g.registration_id] = g;

      const ecMap: Record<string, EmergencyContact[]> = {};
      for (const j of junctions) {
        if (!ecMap[j.camper_id]) ecMap[j.camper_id] = [];
        const ec = j.emergency_contacts;
        if (ec) {
          const list = Array.isArray(ec) ? ec : [ec];
          for (const c of list) ecMap[j.camper_id].push(c);
        }
      }

      const legacyMap: Record<string, EmergencyContact[]> = {};
      for (const ec of legacyContacts) {
        if (!legacyMap[ec.registration_id]) legacyMap[ec.registration_id] = [];
        legacyMap[ec.registration_id].push(ec);
      }

      const medMap: Record<string, { allergies: string; notes: string }> = {};
      for (const m of medical) {
        const parts = [m.allergies, m.medications, m.special_needs].filter(Boolean);
        medMap[m.camper_id] = {
          allergies: m.allergies || "",
          notes: parts.join("; "),
        };
      }

      const entries: RosterEntry[] = campers.map((c) => {
        const g = guardianMap[c.registration_id];
        const campTypeName = Array.isArray(c.camp_types) ? c.camp_types[0]?.name : c.camp_types?.name;
        const contacts = ecMap[c.id]?.length ? ecMap[c.id] : (legacyMap[c.registration_id] || []);
        const med = medMap[c.id];
        return {
          id: c.id,
          first_name: c.first_name,
          last_name: c.last_name,
          grade: c.grade,
          camp_type_name: campTypeName || "—",
          afternoon_opt_out: !!c.afternoon_opt_out,
          registration_id: c.registration_id,
          guardian_name: g ? `${g.first_name} ${g.last_name}` : "—",
          guardian_phone: g?.phone || "—",
          guardian_email: g?.email || "—",
          emergency_contacts: contacts,
          allergies: med?.allergies || "",
          medical_notes: med?.notes || "",
        };
      });

      setRoster(entries);
      setLoading(false);
    }
    load();
  }, [router]);

  // Flatten each row into a single searchable string for omnibox matching.
  function rowHaystack(r: RosterEntry): string {
    const contacts = r.emergency_contacts
      .map((ec) => `${ec.first_name} ${ec.last_name} ${ec.phone} ${ec.relationship}`)
      .join(" ");
    return [
      r.first_name,
      r.last_name || "",
      r.grade || "",
      r.camp_type_name,
      r.afternoon_opt_out ? "morning only" : "full day",
      r.guardian_name,
      r.guardian_phone,
      r.guardian_email,
      contacts,
      r.allergies,
      r.medical_notes,
    ].join(" ").toLowerCase();
  }

  function campFilterMatches(r: RosterEntry, filter: string): boolean {
    if (filter === "all") return true;
    if (filter === "Day Camp — Morning Only") return r.camp_type_name === "Day Camp" && r.afternoon_opt_out;
    if (filter === "Day Camp — Helpers") return r.camp_type_name === "Day Camp" && r.grade === "6th and up";
    return r.camp_type_name === filter;
  }

  // When sorting by Camp, use a composite key so all Day Camp Full Day rows
  // cluster together and all Day Camp Morning Only rows cluster together.
  function sortKey(r: RosterEntry, field: SortField): string {
    if (field === "camp_type_name") {
      if (r.camp_type_name === "Day Camp") {
        return r.afternoon_opt_out ? "Day Camp 2 Morning" : "Day Camp 1 Full";
      }
      return r.camp_type_name;
    }
    return (r[field] || "").toString();
  }

  const q = query.trim().toLowerCase();
  const filtered = roster
    .filter((r) => campFilterMatches(r, campFilter))
    .filter((r) => (q ? rowHaystack(r).includes(q) : true))
    .slice() // don't mutate state
    .sort((a, b) => {
      const av = sortKey(a, sortField).toLowerCase();
      const bv = sortKey(b, sortField).toLowerCase();
      if (av < bv) return sortDir === "asc" ? -1 : 1;
      if (av > bv) return sortDir === "asc" ? 1 : -1;
      return 0;
    });

  return (
    <div className="min-h-screen bg-white">
      <div className="print:hidden">
        <Header rightText="Roster" />
      </div>

      <div className="max-w-[1200px] mx-auto px-6 py-8">
        <div className="print:hidden flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold text-[var(--color-primary)]">
            Camp Roster ({filtered.length} campers)
          </h1>
          <div className="flex items-center gap-3">
            <select
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
              value={campFilter}
              onChange={(e) => setCampFilter(e.target.value)}
            >
              <option value="all">All Camps</option>
              <option value="Day Camp">Day Camp (all)</option>
              <option value="Day Camp — Morning Only">Day Camp — Morning Only</option>
              <option value="Day Camp — Helpers">Day Camp — Helpers</option>
              <option value="Jr Day Camp">Jr Day Camp</option>
            </select>
            <a
              href="/api/admin/roster/export"
              className="bg-emerald-600 text-white font-bold text-sm px-5 py-2 rounded-lg hover:bg-emerald-700 transition-colors"
            >
              Export to Excel
            </a>
            <button
              onClick={() => window.print()}
              className="bg-[var(--color-primary)] text-white font-bold text-sm px-5 py-2 rounded-lg hover:bg-[var(--color-primary-light)] transition-colors"
            >
              Print Roster
            </button>
          </div>
        </div>

        {/* Omnibox filter — searches across every field in the table */}
        <div className="print:hidden mb-4 flex items-center gap-3">
          <input
            type="search"
            placeholder="Search anything in the roster — name, grade, camp, phone, allergy…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="flex-1 border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] focus:border-transparent"
          />
          {query && (
            <button
              onClick={() => setQuery("")}
              className="text-sm text-gray-500 hover:text-gray-700"
            >
              Clear
            </button>
          )}
        </div>

        <div className="hidden print:block mb-4">
          <h1 className="text-xl font-bold">Bower Hill Day Camp — Roster</h1>
          <p className="text-sm text-gray-500">{campFilter === "all" ? "All Camps" : campFilter} &bull; {filtered.length} campers</p>
        </div>

        {loading ? (
          <p className="text-gray-400">Loading...</p>
        ) : filtered.length === 0 ? (
          <p className="text-gray-400">No campers found.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b-2 border-gray-300">
                  <th
                    onClick={() => toggleSort("first_name")}
                    className="text-left py-3 px-2 font-bold text-gray-700 cursor-pointer select-none hover:text-[var(--color-primary)] print:cursor-auto print:hover:text-gray-700"
                  >
                    First Name{sortArrow("first_name")}
                  </th>
                  <th
                    onClick={() => toggleSort("last_name")}
                    className="text-left py-3 px-2 font-bold text-gray-700 cursor-pointer select-none hover:text-[var(--color-primary)] print:cursor-auto print:hover:text-gray-700"
                  >
                    Last Name{sortArrow("last_name")}
                  </th>
                  <th
                    onClick={() => toggleSort("grade")}
                    className="text-left py-3 px-2 font-bold text-gray-700 cursor-pointer select-none hover:text-[var(--color-primary)] print:cursor-auto print:hover:text-gray-700"
                  >
                    Grade{sortArrow("grade")}
                  </th>
                  <th
                    onClick={() => toggleSort("camp_type_name")}
                    className="text-left py-3 px-2 font-bold text-gray-700 cursor-pointer select-none hover:text-[var(--color-primary)] print:cursor-auto print:hover:text-gray-700"
                  >
                    Camp{sortArrow("camp_type_name")}
                  </th>
                  <th
                    onClick={() => toggleSort("guardian_name")}
                    className="text-left py-3 px-2 font-bold text-gray-700 cursor-pointer select-none hover:text-[var(--color-primary)] print:cursor-auto print:hover:text-gray-700"
                  >
                    Guardian{sortArrow("guardian_name")}
                  </th>
                  <th className="text-left py-3 px-2 font-bold text-gray-700">Emergency Contacts</th>
                  <th className="text-left py-3 px-2 font-bold text-gray-700">Medical / Allergies</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <tr key={r.id} className="border-b border-gray-200 hover:bg-gray-50 print:hover:bg-white">
                    <td className="py-3 px-2 font-medium">{r.first_name}</td>
                    <td className="py-3 px-2 font-medium">{r.last_name || ""}</td>
                    <td className="py-3 px-2 text-gray-600">{r.grade || "—"}</td>
                    <td className="py-3 px-2">
                      <div className="flex flex-wrap items-center gap-1">
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full print:px-0 print:bg-transparent ${
                          r.camp_type_name === "Day Camp"
                            ? "bg-orange-100 text-orange-700 print:text-orange-700"
                            : "bg-green-100 text-green-700 print:text-green-700"
                        }`}>
                          {r.camp_type_name}
                        </span>
                        {r.grade === "6th and up" && (
                          <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 print:px-0 print:bg-transparent print:text-blue-700">
                            Helper
                          </span>
                        )}
                        {r.afternoon_opt_out && (
                          <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 print:px-0 print:bg-transparent print:text-amber-700">
                            Morning only
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-2 text-gray-600">
                      <div>{r.guardian_name}</div>
                      <div className="text-xs text-gray-400">{r.guardian_phone}</div>
                      <div className="text-xs text-gray-400">{r.guardian_email}</div>
                    </td>
                    <td className="py-3 px-2 text-gray-600">
                      {r.emergency_contacts.length === 0 ? (
                        <span className="text-gray-300">None</span>
                      ) : (
                        r.emergency_contacts.map((ec, j) => (
                          <div key={j} className="mb-1 last:mb-0">
                            <span className="font-medium">{ec.first_name} {ec.last_name}</span>
                            <span className="text-gray-400 text-xs ml-1">({ec.relationship})</span>
                            <div className="text-xs text-gray-400">{ec.phone}</div>
                          </div>
                        ))
                      )}
                    </td>
                    <td className="py-3 px-2 text-gray-600">
                      {r.allergies || r.medical_notes ? (
                        <div>
                          {r.allergies && <div className="text-red-600 font-medium">{r.allergies}</div>}
                          {r.medical_notes && r.medical_notes !== r.allergies && (
                            <div className="text-xs text-gray-400">{r.medical_notes}</div>
                          )}
                        </div>
                      ) : (
                        <span className="text-gray-300">None</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <style jsx global>{`
        @media print {
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          table { font-size: 11px; }
          th, td { padding: 6px 4px; }
        }
      `}</style>
    </div>
  );
}
