"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import Link from "next/link";
import Header from "@/components/Header";

type FormStep = "guardian" | "pickup" | "camper" | "medical" | "consent" | "done";

type PickupPerson = {
  name: string;
  phone: string;
  relationship: string;
};

type CamperData = {
  first_name: string;
  last_name: string;
  age: string;
  grade: string;
  role: string;

  allergies_conditions: string;
};

const emptyPickup = (): PickupPerson => ({ name: "", phone: "", relationship: "" });

const emptyCamper = (): CamperData => ({
  first_name: "",
  last_name: "",
  age: "",
  grade: "",
  role: "",
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
    const { error } = await supabase.from("guardians").insert({
      registration_id: registrationId,
      first_name: guardian.first_name,
      last_name: guardian.last_name,
      relationship: "Parent/Guardian",
      email: guardian.email,
      phone: guardian.phone,
      address_line1: guardian.address_line1,
      city: guardian.city,
      state: guardian.state,
      zip: guardian.zip,
    });
    setSaving(false);
    if (error) {
      alert("Error saving. Please try again.");
      console.error(error);
      return;
    }
    setStep("pickup");
  }

  async function savePickups() {
    setSaving(true);
    const validPickups = pickups.filter((p) => p.name.trim());
    // Save as emergency contacts + build authorized pickup list
    for (const p of validPickups) {
      const nameParts = p.name.trim().split(" ");
      const firstName = nameParts[0] || "";
      const lastName = nameParts.slice(1).join(" ") || "";
      const { error } = await supabase.from("emergency_contacts").insert({
        registration_id: registrationId,
        first_name: firstName,
        last_name: lastName,
        relationship: p.relationship,
        phone: p.phone,
      });
      if (error) {
        alert("Error saving. Please try again.");
        console.error(error);
        setSaving(false);
        return;
      }
    }
    setSaving(false);
    setCurrentCamper(0);
    setStep("camper");
  }

  async function saveCamper() {
    setSaving(true);
    const c = campers[currentCamper];
    const { error } = await supabase.from("campers").insert({
      registration_id: registrationId,
      first_name: c.first_name,
      last_name: c.last_name,
      date_of_birth: null, // using age instead
      gender: null,
      grade: c.grade,
    });
    if (error) {
      alert("Error saving. Please try again.");
      console.error(error);
      setSaving(false);
      return;
    }
    // Save medical info for this camper
    await supabase.from("medical_info").insert({
      registration_id: registrationId,
      allergies: c.allergies_conditions,
      special_needs: c.role === "helper_noon" || c.role === "helper_3pm" ? `Helper: ${c.role}` : null,
    });
    setSaving(false);

    if (currentCamper < numKids - 1) {
      setCurrentCamper(currentCamper + 1);
    } else {
      setStep("consent");
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
    const { error } = await supabase.from("consents").insert({
      registration_id: registrationId,
      liability_waiver: consent.liability_waiver,
      photo_release: consent.photo_release,
      authorized_pickup_persons: pickupNames,
      signed_by: consent.signed_by,
    });
    setSaving(false);
    if (error) {
      alert("Error saving. Please try again.");
      console.error(error);
      return;
    }
    setStep("done");
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
            <p className="text-gray-500 mb-6">
              Adults (other than yourself) authorized to pick up your child. These also serve as emergency contacts.
            </p>

            {pickups.map((pickup, i) => (
              <div key={i} className="bg-white border border-gray-200 rounded-xl p-6 mb-4">
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

            <button type="submit" disabled={saving} className="mt-4 w-full bg-[var(--color-primary)] hover:bg-[var(--color-primary-light)] text-white font-bold py-4 rounded-full transition-colors disabled:opacity-50">
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
                    <option value="1st-3rd">1st - 3rd Grade</option>
                    <option value="4th-5th">4th - 5th Grade</option>
                    <option value="Middle School">Middle School</option>
                    <option value="High School">High School</option>
                  </select>
                </div>
              </div>

              {/* Conditional: 4th-5th grader role */}
              {campers[currentCamper].grade === "4th-5th" && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                  <label className={labelClass}>4th-5th Grader Role</label>
                  <p className="text-gray-500 text-sm mb-3">
                    4th and 5th graders can attend as a camper or serve as a helper.
                  </p>
                  <div className="grid gap-2">
                    {[
                      { value: "camper", label: "Camper Only" },
                      { value: "helper_noon", label: "Helper (Home at Noon)" },
                      { value: "helper_3pm", label: "Helper (Stay Until 3pm)" },
                    ].map((opt) => (
                      <label key={opt.value} className="flex items-center gap-3 cursor-pointer">
                        <input
                          type="radio"
                          name="role"
                          value={opt.value}
                          checked={campers[currentCamper].role === opt.value}
                          onChange={(e) => updateCamper(currentCamper, "role", e.target.value)}
                          className="w-4 h-4"
                        />
                        <span className="text-gray-700">{opt.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}


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
