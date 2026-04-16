"use client";

import { Suspense, useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import Header from "@/components/Header";

type FormStep = "guardian" | "pickup" | "camper" | "medical" | "consent" | "done";

type PickupPerson = {
  name: string;
  phone: string;
  relationship: string;
  camperIds: string[]; // which campers this contact is for
};

type CamperInfo = { id: string; first_name: string };

type CamperData = {
  first_name: string;
  last_name: string;
  age: string;
  grade: string;
  allergies_conditions: string;
};

const emptyPickup = (): PickupPerson => ({ name: "", phone: "", relationship: "", camperIds: [] });

const emptyCamper = (): CamperData => ({
  first_name: "",
  last_name: "",
  age: "",
  grade: "",
  allergies_conditions: "",
});

export default function CamperInfoPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <p className="text-gray-500 text-lg">Loading...</p>
        </div>
      }
    >
      <CamperInfoForm />
    </Suspense>
  );
}

function CamperInfoForm() {
  const searchParams = useSearchParams();
  const registrationId = searchParams.get("registration_id");
  const numKids = parseInt(searchParams.get("num_kids") || "1", 10);

  const [step, setStep] = useState<FormStep>("guardian");
  const [saving, setSaving] = useState(false);
  const [sameContactForAll, setSameContactForAll] = useState(true);
  const [camperNames, setCamperNames] = useState<string[]>([]);
  const [camperInfos, setCamperInfos] = useState<CamperInfo[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const storageKey = registrationId ? `bhdc-info-${registrationId}` : "";

  // Guardian
  const [guardian, setGuardian] = useState({
    first_name: "",
    last_name: "",
    email: "",
    phone: "",
    address_line1: "",
    city: "",
    state: "",
    zip: "",
  });

  // Authorized pickup persons (also serve as emergency contacts)
  const [pickups, setPickups] = useState<PickupPerson[]>([emptyPickup()]);

  // Campers (one per kid)
  const [campers, setCampers] = useState<CamperData[]>(
    Array.from({ length: numKids }, () => emptyCamper())
  );
  const [currentCamper, setCurrentCamper] = useState(0);

  // Consent
  const [consent, setConsent] = useState({
    liability_waiver: false,
    photo_release: false,
    signed_by: "",
  });

  // Fetch camper data for this registration (name/grade already collected),
  // then overlay any saved progress from sessionStorage so refresh/back doesn't
  // wipe out what the user already typed.
  useEffect(() => {
    if (!registrationId) return;
    async function fetchCampers() {
      let data: { id: string; first_name: string; last_name: string | null; grade: string | null }[] = [];
      try {
        const res = await fetch(`/api/registrations/${registrationId}/campers`);
        const json = await res.json();
        if (res.ok) data = json.campers || [];
      } catch (e) {
        console.error("Failed to fetch campers", e);
      }

      const baseCampers: CamperData[] = data.map((c) => ({
        first_name: c.first_name || "",
        last_name: c.last_name || "",
        age: "",
        grade: c.grade || "",
        allergies_conditions: "",
      }));

      if (data.length) {
        setCamperNames(data.map((c) => c.first_name));
        setCamperInfos(data.map((c) => ({ id: c.id, first_name: c.first_name })));
        setCampers(baseCampers);
      }

      // Hydrate from sessionStorage AFTER supabase fetch so saved values overlay defaults
      try {
        const raw = sessionStorage.getItem(storageKey);
        if (raw) {
          const saved = JSON.parse(raw);
          if (saved.guardian) setGuardian(saved.guardian);
          if (Array.isArray(saved.pickups) && saved.pickups.length) setPickups(saved.pickups);
          if (typeof saved.sameContactForAll === "boolean") setSameContactForAll(saved.sameContactForAll);
          if (Array.isArray(saved.campers) && saved.campers.length === baseCampers.length) {
            setCampers(saved.campers);
          }
          if (typeof saved.currentCamper === "number") setCurrentCamper(saved.currentCamper);
          if (saved.consent) setConsent(saved.consent);
          if (saved.step && saved.step !== "done") setStep(saved.step);
        }
      } catch {
        // ignore corrupt storage
      }
      setHydrated(true);
    }
    fetchCampers();
  }, [registrationId, storageKey]);

  // Persist form state to sessionStorage on any change (after hydration)
  useEffect(() => {
    if (!hydrated || !storageKey) return;
    if (step === "done") return; // cleared explicitly in saveConsent
    try {
      sessionStorage.setItem(
        storageKey,
        JSON.stringify({ step, guardian, pickups, sameContactForAll, campers, currentCamper, consent })
      );
    } catch {
      // ignore quota / private mode failures
    }
  }, [hydrated, storageKey, step, guardian, pickups, sameContactForAll, campers, currentCamper, consent]);

  const inputClass =
    "w-full border border-gray-300 rounded-lg px-4 py-3 text-gray-900 focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] focus:border-transparent";
  const labelClass = "block text-sm font-medium text-gray-700 mb-1";

  function updateCamper(index: number, field: keyof CamperData, value: string) {
    const updated = [...campers];
    updated[index] = { ...updated[index], [field]: value };
    setCampers(updated);
  }

  function updatePickup(index: number, field: keyof PickupPerson, value: string) {
    const updated = [...pickups];
    updated[index] = { ...updated[index], [field]: value };
    setPickups(updated);
  }

  async function saveGuardian() {
    setSaving(true);
    try {
      const res = await fetch(`/api/registrations/${registrationId}/guardian`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(guardian),
      });
      const data = await res.json();
      setSaving(false);
      if (!res.ok) {
        alert("Error saving guardian: " + (data.error || "unknown error"));
        return;
      }
      setStep("pickup");
    } catch (e) {
      setSaving(false);
      alert("Network error. Please try again.");
      console.error(e);
    }
  }

  function togglePickupCamper(pickupIndex: number, camperId: string) {
    setPickups((prev) =>
      prev.map((p, i) => {
        if (i !== pickupIndex) return p;
        const has = p.camperIds.includes(camperId);
        return {
          ...p,
          camperIds: has
            ? p.camperIds.filter((id) => id !== camperId)
            : [...p.camperIds, camperId],
        };
      })
    );
  }

  async function savePickups() {
    setSaving(true);
    try {
      const res = await fetch(`/api/registrations/${registrationId}/pickups`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pickups,
          sameContactForAll,
          allCamperIds: camperInfos.map((c) => c.id),
        }),
      });
      const data = await res.json();
      setSaving(false);
      if (!res.ok) {
        alert("Error saving emergency contacts: " + (data.error || "unknown error"));
        return;
      }
      setCurrentCamper(0);
      setStep("camper");
    } catch (e) {
      setSaving(false);
      alert("Network error. Please try again.");
      console.error(e);
    }
  }

  async function saveCamper() {
    setSaving(true);
    const c = campers[currentCamper];
    const camperId = camperInfos[currentCamper]?.id;

    if (!camperId) {
      setSaving(false);
      alert("Could not find camper record. Please refresh and try again.");
      return;
    }

    try {
      const res = await fetch(`/api/registrations/${registrationId}/campers/${camperId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          last_name: c.last_name,
          age: c.age,
          grade: c.grade,
          allergies_conditions: c.allergies_conditions,
        }),
      });
      const data = await res.json();
      setSaving(false);
      if (!res.ok) {
        alert("Error saving camper info: " + (data.error || "unknown error"));
        return;
      }
      if (currentCamper < numKids - 1) {
        setCurrentCamper(currentCamper + 1);
      } else {
        setStep("consent");
      }
    } catch (e) {
      setSaving(false);
      alert("Network error. Please try again.");
      console.error(e);
    }
  }

  async function saveConsent() {
    // TODO: re-enable waiver check
    // if (!consent.liability_waiver) {
    //   alert("You must accept the liability waiver to continue.");
    //   return;
    // }
    setSaving(true);
    const pickupNames = pickups
      .filter((p) => p.name.trim())
      .map((p) => p.name.trim())
      .join(", ");
    try {
      const res = await fetch(`/api/registrations/${registrationId}/consent`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          liability_waiver: consent.liability_waiver,
          photo_release: consent.photo_release,
          authorized_pickup_persons: pickupNames,
          signed_by: consent.signed_by,
        }),
      });
      const data = await res.json();
      setSaving(false);
      if (!res.ok) {
        alert("Error saving consent: " + (data.error || "unknown error"));
        return;
      }
      setStep("done");
      try { sessionStorage.removeItem(storageKey); } catch {}
    } catch (e) {
      setSaving(false);
      alert("Network error. Please try again.");
      console.error(e);
    }
  }

  if (!registrationId) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6">
        <p className="text-gray-500 text-lg mb-4">No registration found.</p>
        <Link href="/register" className="text-[var(--color-primary)] hover:underline">
          Start registration &rarr;
        </Link>
      </div>
    );
  }

  const stepLabels: { key: FormStep; label: string }[] = [
    { key: "guardian", label: "Parent" },
    { key: "pickup", label: "Pickup / Emergency" },
    { key: "camper", label: `Camper${numKids > 1 ? "s" : ""}` },
    { key: "consent", label: "Waivers" },
  ];

  // ─── Pickup validation ──────────────────────────────
  // A pickup is valid when it has name + phone + relationship.
  // - Same-for-all mode: need at least 1 valid contact.
  // - Per-camper mode: every camper must be selected on at least one valid pickup.
  const validPickups = pickups.filter((p) => p.name.trim() && p.phone.trim() && p.relationship.trim());
  const coveredCamperIds = new Set(
    sameContactForAll
      ? camperInfos.map((c) => c.id)
      : validPickups.flatMap((p) => p.camperIds)
  );
  const uncoveredCampers = camperInfos.filter((c) => !coveredCamperIds.has(c.id));
  const pickupReady = validPickups.length > 0 && uncoveredCampers.length === 0;

  return (
    <div className="min-h-screen bg-gray-50">
      <Header rightText="Camper Information" />

      {/* Progress */}
      <div className="max-w-2xl mx-auto px-6 pt-8">
        <div className="flex items-center gap-1 text-xs mb-8 flex-wrap">
          {stepLabels.map((s, i) => (
            <span key={s.key} className="flex items-center gap-1">
              {i > 0 && <span className="text-gray-300 mx-1">&rarr;</span>}
              <span
                className={
                  step === s.key
                    ? "font-bold text-[var(--color-primary)]"
                    : "text-gray-400"
                }
              >
                {s.label}
              </span>
            </span>
          ))}
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-6 pb-16">
        {/* Step 1: Parent/Guardian */}
        {step === "guardian" && (
          <form onSubmit={(e) => { e.preventDefault(); saveGuardian(); }}>
            <h1 className="text-3xl font-bold text-[var(--color-primary)] mb-6">
              Parent / Guardian
            </h1>
            <div className="grid gap-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>First Name *</label>
                  <input /* required */ className={inputClass} value={guardian.first_name} onChange={(e) => setGuardian({ ...guardian, first_name: e.target.value })} />
                </div>
                <div>
                  <label className={labelClass}>Last Name *</label>
                  <input /* required */ className={inputClass} value={guardian.last_name} onChange={(e) => setGuardian({ ...guardian, last_name: e.target.value })} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>Email *</label>
                  <input /* required */ type="email" className={inputClass} value={guardian.email} onChange={(e) => setGuardian({ ...guardian, email: e.target.value })} />
                </div>
                <div>
                  <label className={labelClass}>Phone *</label>
                  <input /* required */ type="tel" className={inputClass} value={guardian.phone} onChange={(e) => setGuardian({ ...guardian, phone: e.target.value })} />
                </div>
              </div>
              <div>
                <label className={labelClass}>Address</label>
                <input className={inputClass} placeholder="Street address" value={guardian.address_line1} onChange={(e) => setGuardian({ ...guardian, address_line1: e.target.value })} />
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className={labelClass}>City</label>
                  <input className={inputClass} value={guardian.city} onChange={(e) => setGuardian({ ...guardian, city: e.target.value })} />
                </div>
                <div>
                  <label className={labelClass}>State</label>
                  <input className={inputClass} value={guardian.state} onChange={(e) => setGuardian({ ...guardian, state: e.target.value })} />
                </div>
                <div>
                  <label className={labelClass}>ZIP</label>
                  <input className={inputClass} value={guardian.zip} onChange={(e) => setGuardian({ ...guardian, zip: e.target.value })} />
                </div>
              </div>
            </div>
            <button type="submit" disabled={saving} className="mt-8 w-full bg-[var(--color-primary)] hover:bg-[var(--color-primary-light)] text-white font-bold py-4 rounded-full transition-colors disabled:opacity-50">
              {saving ? "Saving..." : "Next: Authorized Pickup / Emergency Contacts"}
            </button>
          </form>
        )}

        {/* Step 2: Authorized Pickup / Emergency Contacts */}
        {step === "pickup" && (
          <form onSubmit={(e) => { e.preventDefault(); savePickups(); }}>
            <h1 className="text-3xl font-bold text-[var(--color-primary)] mb-2">
              Authorized Pickup &amp; Emergency Contacts
            </h1>
            <p className="text-gray-500 mb-4">
              Adults (other than yourself) authorized to pick up your child. These also serve as emergency contacts.
            </p>

            {/* Same for all toggle */}
            {numKids > 1 && (
              <label className="flex items-center gap-3 mb-6 cursor-pointer bg-white border border-gray-200 rounded-xl p-4">
                <input
                  type="checkbox"
                  checked={sameContactForAll}
                  onChange={(e) => setSameContactForAll(e.target.checked)}
                  className="w-5 h-5 accent-[var(--color-accent)]"
                />
                <div>
                  <span className="font-medium text-gray-900">Same emergency contacts for all campers</span>
                  <p className="text-gray-400 text-sm">
                    {sameContactForAll
                      ? `Applies to ${camperNames.length > 0 ? camperNames.join(", ") : `all ${numKids} campers`}`
                      : "You'll assign contacts to specific campers below"}
                  </p>
                </div>
              </label>
            )}

            {pickups.map((pickup, i) => (
              <div key={i} className="bg-white border border-gray-200 rounded-xl p-6 mb-4">
                {/* Per-kid assignment (above header) when not same for all */}
                {!sameContactForAll && numKids > 1 && camperInfos.length > 0 && (
                  <div className="mb-5 pb-5 border-b border-gray-200">
                    <label className={labelClass}>This authorized contact is for the following campers:</label>
                    <div className="flex flex-wrap gap-2">
                      {camperInfos.map((ci) => {
                        const selected = pickup.camperIds.includes(ci.id);
                        return (
                          <button
                            key={ci.id}
                            type="button"
                            onClick={() => togglePickupCamper(i, ci.id)}
                            className={`text-sm px-3 py-1 rounded-full border transition-colors ${
                              selected
                                ? "bg-[var(--color-primary)] text-white border-[var(--color-primary)]"
                                : "bg-white text-gray-400 border-gray-300 hover:border-gray-400"
                            }`}
                          >
                            {ci.first_name}
                          </button>
                        );
                      })}
                    </div>
                    <p className="text-xs text-gray-400 mt-1">
                      Tap names to select which campers this contact is for
                    </p>
                  </div>
                )}

                <div className="flex justify-between items-center mb-4">
                  <h3 className="font-bold text-gray-700">Contact {i + 1}</h3>
                  {i > 0 && (
                    <button
                      type="button"
                      onClick={() => setPickups(pickups.filter((_, idx) => idx !== i))}
                      className="text-sm text-red-500 hover:underline"
                    >
                      Remove
                    </button>
                  )}
                </div>
                <div className="grid gap-4">
                  <div>
                    <label className={labelClass}>Full Name *</label>
                    <input /* required */ className={inputClass} placeholder="First and Last Name" value={pickup.name} onChange={(e) => updatePickup(i, "name", e.target.value)} />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className={labelClass}>Phone *</label>
                      <input /* required */ type="tel" className={inputClass} value={pickup.phone} onChange={(e) => updatePickup(i, "phone", e.target.value)} />
                    </div>
                    <div>
                      <label className={labelClass}>Relationship to Child *</label>
                      <input /* required */ className={inputClass} placeholder="e.g. Grandparent, Aunt" value={pickup.relationship} onChange={(e) => updatePickup(i, "relationship", e.target.value)} />
                    </div>
                  </div>
                </div>
              </div>
            ))}

            {pickups.length < 4 && (
              <button
                type="button"
                onClick={() => setPickups([...pickups, emptyPickup()])}
                className="text-[var(--color-primary)] font-medium hover:underline mb-6 block"
              >
                + Add another contact
              </button>
            )}

            {!pickupReady && (
              <div className="bg-amber-50 border border-amber-300 rounded-lg p-3 mb-4 text-sm text-amber-900 flex items-start gap-2">
                <span className="text-lg leading-none shrink-0" aria-hidden="true">&#9888;&#65039;</span>
                <div>
                  {validPickups.length === 0 ? (
                    <p>Add at least one contact (name, phone, and relationship required) to continue.</p>
                  ) : !sameContactForAll && uncoveredCampers.length > 0 ? (
                    <p>
                      Still need a contact for: <span className="font-semibold">{uncoveredCampers.map((c) => c.first_name).join(", ")}</span>.
                      Either tap their name on an existing contact above, or add another contact.
                    </p>
                  ) : null}
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={saving || !pickupReady}
              className="mt-4 w-full bg-[var(--color-primary)] hover:bg-[var(--color-primary-light)] text-white font-bold py-4 rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? "Saving..." : "Next: Camper Info"}
            </button>
          </form>
        )}

        {/* Step 3: Camper info (repeats per kid) */}
        {step === "camper" && (
          <form onSubmit={(e) => { e.preventDefault(); saveCamper(); }}>
            <h1 className="text-3xl font-bold text-[var(--color-primary)] mb-2">
              Camper {numKids > 1 ? `${currentCamper + 1} of ${numKids}` : "Information"}
            </h1>
            <p className="text-gray-500 mb-6">Tell us about your camper.</p>

            <div className="grid gap-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>First Name *</label>
                  <input /* required */ className={inputClass} value={campers[currentCamper].first_name} onChange={(e) => updateCamper(currentCamper, "first_name", e.target.value)} />
                </div>
                <div>
                  <label className={labelClass}>Last Name *</label>
                  <input /* required */ className={inputClass} value={campers[currentCamper].last_name} onChange={(e) => updateCamper(currentCamper, "last_name", e.target.value)} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>Age *</label>
                  <input /* required */ type="number" min="3" max="18" className={inputClass} value={campers[currentCamper].age} onChange={(e) => updateCamper(currentCamper, "age", e.target.value)} />
                </div>
                <div>
                  <label className={labelClass}>Last Grade Completed *</label>
                  <select /* required */ className={inputClass} value={campers[currentCamper].grade} onChange={(e) => updateCamper(currentCamper, "grade", e.target.value)}>
                    <option value="">Select</option>
                    <option value="Preschool">Preschool</option>
                    <option value="K">Kindergarten</option>
                    <option value="1st">1st</option>
                    <option value="2nd">2nd</option>
                    <option value="3rd">3rd</option>
                    <option value="4th">4th</option>
                    <option value="5th">5th</option>
                    <option value="6th and up">6th and up</option>
                  </select>
                </div>
              </div>

              <div>
                <label className={labelClass}>Food Allergies / Medical Conditions *</label>
                <textarea
                  /* required */
                  className={inputClass}
                  rows={3}
                  placeholder="List any food allergies, medical conditions, or medications. Write 'None' if not applicable."
                  value={campers[currentCamper].allergies_conditions}
                  onChange={(e) => updateCamper(currentCamper, "allergies_conditions", e.target.value)}
                />
              </div>
            </div>

            <button type="submit" disabled={saving} className="mt-8 w-full bg-[var(--color-primary)] hover:bg-[var(--color-primary-light)] text-white font-bold py-4 rounded-full transition-colors disabled:opacity-50">
              {saving
                ? "Saving..."
                : currentCamper < numKids - 1
                ? `Next: Camper ${currentCamper + 2} of ${numKids}`
                : "Next: Waivers & Consent"}
            </button>
          </form>
        )}

        {/* Step 4: Consent & Waivers */}
        {step === "consent" && (
          <form onSubmit={(e) => { e.preventDefault(); saveConsent(); }}>
            <h1 className="text-3xl font-bold text-[var(--color-primary)] mb-6">
              Consent &amp; Waivers
            </h1>
            <div className="grid gap-6">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  className="mt-1 w-5 h-5"
                  checked={consent.liability_waiver}
                  onChange={(e) => setConsent({ ...consent, liability_waiver: e.target.checked })}
                />
                <span className="text-gray-700">
                  <strong>Liability Waiver *</strong> — I understand that participation
                  in camp activities involves inherent risks. I release Bower Hill
                  Community Church and its volunteers from liability for any injury or
                  illness that may occur during camp.
                </span>
              </label>
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  className="mt-1 w-5 h-5"
                  checked={consent.photo_release}
                  onChange={(e) => setConsent({ ...consent, photo_release: e.target.checked })}
                />
                <span className="text-gray-700">
                  <strong>Photo/Video Release</strong> — I grant permission for photos
                  and videos of my child to be used in church communications and social
                  media.
                </span>
              </label>
              <div>
                <label className={labelClass}>Digital Signature (Full Name) *</label>
                <input
                  /* required */
                  className={inputClass}
                  placeholder="Type your full legal name"
                  value={consent.signed_by}
                  onChange={(e) => setConsent({ ...consent, signed_by: e.target.value })}
                />
              </div>
            </div>
            <button type="submit" disabled={saving} className="mt-8 w-full bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-white font-bold py-4 rounded-full transition-colors disabled:opacity-50">
              {saving ? "Saving..." : "Complete Registration"}
            </button>
          </form>
        )}

        {/* Done */}
        {step === "done" && (
          <div className="text-center py-16">
            <div className="text-6xl mb-4">&#9989;</div>
            <h1 className="text-3xl font-bold text-[var(--color-primary)] mb-4">
              Registration Complete!
            </h1>
            <p className="text-gray-500 text-lg mb-4">
              Thank you for registering your {numKids === 1 ? "camper" : `${numKids} campers`}!
            </p>
            <p className="text-gray-400 mb-8">
              Additional details will be emailed closer to camp week.
            </p>
            <Link
              href="/"
              className="inline-block bg-[var(--color-primary)] hover:bg-[var(--color-primary-light)] text-white font-bold px-8 py-3 rounded-full transition-colors"
            >
              Back to Home
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
