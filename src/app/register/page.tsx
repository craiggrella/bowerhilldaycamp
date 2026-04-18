"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Header from "@/components/Header";
import { motion, AnimatePresence } from "framer-motion";
import { loadStripe } from "@stripe/stripe-js";
import { Elements, PaymentElement, useStripe, useElements } from "@stripe/react-stripe-js";

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);

const STORAGE_KEY = "bhdc-register-state";

// ─── Types ───────────────────────────────────────────────

type CampType = {
  id: string;
  name: string;
  description: string;
  schedule: string;
  price_cents: number;
};

type CamperEntry = {
  firstName: string;
  lastName: string;
  grade: string;
  age: string;
  allergies: string;
  campType: CampType | null;
  priceCents: number;
  afternoonOptOut: boolean;
  firstYear: boolean | null; // null = unanswered for eligible grades
};

type Guardian = {
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  address_line1: string;
  city: string;
  state: string;
  zip: string;
};

type Pickup = {
  name: string;
  phone: string;
  relationship: string;
  camperIndexes: number[]; // indexes into campers[] (before we have ids)
};

type Consent = {
  liability_waiver: boolean;
  photo_release: boolean;
  signed_by: string;
};

type Step =
  | "count"
  | "details"
  | "guardian"
  | "pickup"
  | "camperInfo"
  | "consent"
  | "review"
  | "payment"
  | "confirmed";

// ─── Constants ───────────────────────────────────────────

const GRADE_OPTIONS = ["Preschool", "K", "1st", "2nd", "3rd", "4th", "5th", "6th and up"];
const JR_GRADES = new Set(["Preschool", "K", "1st", "2nd"]);
const FIRST_YEAR_ELIGIBLE_GRADES = new Set(["Preschool", "K", "1st", "2nd", "3rd"]);
const HELPER_GRADE = "6th and up";

function isFirstYearEligibleGrade(grade: string): boolean {
  return FIRST_YEAR_ELIGIBLE_GRADES.has(grade);
}

function emptyCamper(): CamperEntry {
  return { firstName: "", lastName: "", grade: "", age: "", allergies: "", campType: null, priceCents: 0, afternoonOptOut: false, firstYear: null };
}

function emptyGuardian(): Guardian {
  return { first_name: "", last_name: "", email: "", phone: "", address_line1: "", city: "", state: "", zip: "" };
}

function emptyPickup(): Pickup {
  return { name: "", phone: "", relationship: "", camperIndexes: [] };
}

function emptyConsent(): Consent {
  return { liability_waiver: false, photo_release: false, signed_by: "" };
}

function getPriceCents(grade: string, firstYear: boolean | null): number {
  if (!grade) return 0;
  // First-year registrants in eligible grades (3rd and under) attend for free.
  if (firstYear === true && isFirstYearEligibleGrade(grade)) return 0;
  if (JR_GRADES.has(grade)) return 2500;
  if (grade === HELPER_GRADE) return 2500;
  return 7500;
}

function getSchedule(campName: string, optOut: boolean): string {
  if (campName === "Jr Day Camp") return "9:30 AM – 12:00 PM";
  if (optOut) return "9:30 AM – 12:00 PM (Morning only)";
  return "9:30 AM – 3:00 PM";
}

// ─── Format helpers ───────────────────────────────────────

// Keep only digits, cap at 10, format as xxx-xxx-xxxx as the user types.
function formatPhone(input: string): string {
  const digits = input.replace(/\D/g, "").slice(0, 10);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
}

function formatState(input: string): string {
  return input.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 2);
}

function formatZip(input: string): string {
  return input.replace(/\D/g, "").slice(0, 5);
}

// Simple email format check — not RFC-complete, but catches obvious mistakes
// while staying consistent with browser HTML5 validation.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^\d{3}-\d{3}-\d{4}$/;
const STATE_RE = /^[A-Z]{2}$/;
const ZIP_RE = /^\d{5}$/;

// ─── Component ───────────────────────────────────────────

export default function RegisterPage() {
  const [step, setStep] = useState<Step>("count");
  const [campTypes, setCampTypes] = useState<CampType[]>([]);
  const [numCampers, setNumCampers] = useState(1);
  const [campers, setCampers] = useState<CamperEntry[]>([]);
  const [guardian, setGuardian] = useState<Guardian>(emptyGuardian());
  const [pickups, setPickups] = useState<Pickup[]>([emptyPickup()]);
  const [sameContactForAll, setSameContactForAll] = useState(true);
  const [currentCamperInfo, setCurrentCamperInfo] = useState(0);
  const [consent, setConsent] = useState<Consent>(emptyConsent());
  const [loading, setLoading] = useState(true);
  const [registrationId, setRegistrationId] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);

  const totalCents = campers.reduce((sum, c) => sum + c.priceCents, 0);
  const numKids = campers.length;

  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch("/api/camp-types");
        const data = await res.json();
        setCampTypes(data.campTypes || []);
      } catch (e) {
        console.error("Failed to load camp types", e);
      }
      setLoading(false);
    }
    fetchData();
  }, []);

  // Hydrate form state from sessionStorage on mount (survives back-button).
  // The setState calls here are a one-time hydration that only fires on mount,
  // so the lint rule about cascading renders doesn't apply — disable for this block.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (raw) {
        const saved = JSON.parse(raw);
        if (typeof saved.numCampers === "number") setNumCampers(saved.numCampers);
        if (Array.isArray(saved.campers) && saved.campers.length) setCampers(saved.campers);
        if (saved.guardian) setGuardian(saved.guardian);
        if (Array.isArray(saved.pickups) && saved.pickups.length) setPickups(saved.pickups);
        if (typeof saved.sameContactForAll === "boolean") setSameContactForAll(saved.sameContactForAll);
        if (typeof saved.currentCamperInfo === "number") setCurrentCamperInfo(saved.currentCamperInfo);
        if (saved.consent) setConsent(saved.consent);
        // Don't restore terminal/transient steps — bounce back to review
        if (
          saved.step === "details" ||
          saved.step === "guardian" ||
          saved.step === "pickup" ||
          saved.step === "camperInfo" ||
          saved.step === "consent" ||
          saved.step === "review"
        ) {
          setStep(saved.step);
        } else if (saved.step === "payment" || saved.step === "confirmed") {
          setStep("review");
        }
      }
    } catch {
      // ignore corrupt storage
    }
    setHydrated(true);
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  // Persist whenever the form state changes (after initial hydration)
  useEffect(() => {
    if (!hydrated) return;
    if (step === "confirmed") return; // confirmed clears storage explicitly in handleCheckout
    try {
      sessionStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ numCampers, campers, guardian, pickups, sameContactForAll, currentCamperInfo, consent, step })
      );
    } catch {
      // ignore quota / private mode failures
    }
  }, [hydrated, numCampers, campers, guardian, pickups, sameContactForAll, currentCamperInfo, consent, step]);

  function resolveCampType(grade: string): CampType | null {
    if (!grade) return null;
    const name = JR_GRADES.has(grade) ? "Jr Day Camp" : "Day Camp";
    return campTypes.find((ct) => ct.name === name) || null;
  }

  // ─── Navigation ──────────────────────────────────────

  function goToDetails() {
    setCampers((prev) => {
      const next: CamperEntry[] = [];
      for (let i = 0; i < numCampers; i++) {
        next.push(prev[i] || emptyCamper());
      }
      return next;
    });
    setStep("details");
  }

  // ─── Camper updates ──────────────────────────────────

  function updateCamperField<K extends keyof CamperEntry>(index: number, field: K, value: CamperEntry[K]) {
    setCampers((prev) => prev.map((c, i) => (i === index ? { ...c, [field]: value } : c)));
  }

  function updateGrade(index: number, grade: string) {
    setCampers((prev) =>
      prev.map((c, i) => {
        if (i !== index) return c;
        // Only ask the first-year question for eligible grades; non-eligible grades always store false.
        const newFirstYear = isFirstYearEligibleGrade(grade) ? null : false;
        return {
          ...c,
          grade,
          campType: resolveCampType(grade),
          priceCents: getPriceCents(grade, newFirstYear),
          afternoonOptOut: false,
          firstYear: newFirstYear,
        };
      })
    );
  }

  function setFirstYear(index: number, value: boolean) {
    setCampers((prev) =>
      prev.map((c, i) => {
        if (i !== index) return c;
        return { ...c, firstYear: value, priceCents: getPriceCents(c.grade, value) };
      })
    );
  }

  function toggleAfternoonOptOut(index: number) {
    setCampers((prev) =>
      prev.map((c, i) => (i === index ? { ...c, afternoonOptOut: !c.afternoonOptOut } : c))
    );
  }

  function updatePickup(index: number, field: keyof Pickup, value: string) {
    setPickups((prev) => prev.map((p, i) => (i === index ? { ...p, [field]: value } : p)));
  }

  function togglePickupCamper(pickupIndex: number, camperIndex: number) {
    setPickups((prev) =>
      prev.map((p, i) => {
        if (i !== pickupIndex) return p;
        const has = p.camperIndexes.includes(camperIndex);
        return {
          ...p,
          camperIndexes: has
            ? p.camperIndexes.filter((x) => x !== camperIndex)
            : [...p.camperIndexes, camperIndex],
        };
      })
    );
  }

  // ─── Submission after payment succeeds ───────────────

  async function handleCheckout(stripePaymentId: string, stripeStatus: string) {
    try {
      const res = await fetch("/api/registrations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amountCents: totalCents,
          stripePaymentId: stripePaymentId || null,
          stripeStatus: stripeStatus || (totalCents === 0 ? "free" : "unknown"),
          campers: campers.map((c) => ({
            campTypeId: c.campType?.id ?? null,
            firstName: c.firstName,
            lastName: c.lastName,
            grade: c.grade,
            age: c.age,
            allergies: c.allergies,
            afternoonOptOut: c.afternoonOptOut,
            firstYear: c.firstYear === true,
            priceCents: c.priceCents,
          })),
          guardian,
          pickups: pickups.filter((p) => p.name.trim()),
          sameContactForAll,
          consent,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(
          "Payment succeeded but we hit a problem saving your registration. Please contact us — your charge ID is " +
            stripePaymentId +
            "\n\n" +
            (data.error || "")
        );
        console.error("Registration save failed:", data);
        return;
      }
      setRegistrationId(data.registrationId);
      setStep("confirmed");
      try { sessionStorage.removeItem(STORAGE_KEY); } catch {}
    } catch (e) {
      alert(
        "Payment succeeded but we couldn't reach the server. Please contact us — your charge ID is " +
          stripePaymentId
      );
      console.error(e);
    }
  }

  // ─── Derived ─────────────────────────────────────────

  const detailsReady = campers.every((c) => {
    if (!c.firstName.trim() || !c.lastName.trim() || !c.grade) return false;
    // If the grade is eligible for the first-year question, require an explicit answer.
    if (isFirstYearEligibleGrade(c.grade) && c.firstYear === null) return false;
    return true;
  });

  const guardianReady = Boolean(
    guardian.first_name.trim() &&
      guardian.last_name.trim() &&
      EMAIL_RE.test(guardian.email.trim()) &&
      PHONE_RE.test(guardian.phone.trim()) &&
      // state/zip optional, but if filled must be valid format
      (!guardian.state || STATE_RE.test(guardian.state)) &&
      (!guardian.zip || ZIP_RE.test(guardian.zip))
  );

  const validPickups = pickups.filter((p) => p.name.trim() && PHONE_RE.test(p.phone.trim()) && p.relationship.trim());
  const coveredCamperIndexes = new Set<number>(
    sameContactForAll
      ? campers.map((_, i) => i)
      : validPickups.flatMap((p) => p.camperIndexes)
  );
  const uncoveredCampers = campers.filter((_, i) => !coveredCamperIndexes.has(i));
  const pickupReady = validPickups.length > 0 && uncoveredCampers.length === 0;

  const consentReady = consent.signed_by.trim().length > 0;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-500 text-lg">Loading...</p>
      </div>
    );
  }

  // ─── Progress bar (hidden on count + confirmed) ──────

  const stepList: { key: Step; label: string }[] = [
    { key: "count", label: "1. Campers" },
    { key: "details", label: "2. Details" },
    { key: "guardian", label: "3. Parent" },
    { key: "pickup", label: "4. Pickup" },
    { key: "camperInfo", label: "5. Info" },
    { key: "consent", label: "6. Waivers" },
    { key: "review", label: "7. Review" },
    { key: "payment", label: "8. Pay" },
  ];

  const showProgress = step !== "count" && step !== "confirmed";

  const inputClass = "w-full border border-gray-300 rounded-lg px-4 py-3 text-gray-900 focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] focus:border-transparent";
  const labelClass = "block text-sm font-medium text-gray-700 mb-1";

  // ─── Render ──────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Header rightText="Registration" />

      {showProgress && (
        <div className="max-w-2xl mx-auto px-6 pt-8 w-full">
          <div className="flex items-center gap-1 text-xs mb-8 flex-wrap">
            {stepList.map((s, i) => (
              <span key={s.key} className="flex items-center gap-1">
                {i > 0 && <span className="text-gray-300">&rarr;</span>}
                <span className={step === s.key ? "font-bold text-[var(--color-primary)]" : "text-gray-400"}>
                  {s.label}
                </span>
              </span>
            ))}
          </div>
        </div>
      )}

      <AnimatePresence mode="wait">
        {/* ═══════ SCREEN 1: HOW MANY CAMPERS ═══════ */}
        {step === "count" && (
          <motion.div
            key="count"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3 }}
            className="flex-1 flex items-center justify-center px-6"
          >
            <div className="text-center max-w-md w-full">
              <motion.h1
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="text-3xl md:text-5xl font-black text-[var(--color-primary)] mb-3 leading-tight"
              >
                How many campers are you registering?
              </motion.h1>
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.25 }}
                className="text-gray-400 mb-12"
              >
                We&apos;ll get their details next.
              </motion.p>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.35 }}
                className="flex items-center justify-center gap-8 mb-12"
              >
                <button
                  onClick={() => setNumCampers(Math.max(1, numCampers - 1))}
                  className="w-14 h-14 rounded-full bg-white border-2 border-gray-200 hover:border-[var(--color-accent)] text-2xl font-bold text-gray-500 transition-colors flex items-center justify-center"
                >
                  &minus;
                </button>
                <div className="text-7xl md:text-8xl font-black text-[var(--color-primary)]">
                  {numCampers}
                </div>
                <button
                  onClick={() => setNumCampers(Math.min(10, numCampers + 1))}
                  className="w-14 h-14 rounded-full bg-white border-2 border-gray-200 hover:border-[var(--color-accent)] text-2xl font-bold text-gray-500 transition-colors flex items-center justify-center"
                >
                  +
                </button>
              </motion.div>

              <motion.button
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5 }}
                onClick={goToDetails}
                className="w-full max-w-sm mx-auto bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-white font-bold text-lg py-4 rounded-full transition-colors"
              >
                Continue
              </motion.button>
            </div>
          </motion.div>
        )}

        {/* ═══════ SCREEN 2: CAMPER DETAILS ═══════ */}
        {step === "details" && (
          <motion.div
            key="details"
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -30 }}
            transition={{ duration: 0.3 }}
            className="max-w-5xl mx-auto px-6 pb-16 w-full"
          >
            <button onClick={() => setStep("count")} className="text-sm text-[var(--color-primary)] mb-4 hover:underline">
              &larr; Back
            </button>
            <h1 className="text-3xl font-bold text-[var(--color-primary)] mb-2">
              Tell us about your campers
            </h1>
            <p className="text-gray-500 mb-8">
              Enter each camper&apos;s name and the last grade they completed.
            </p>

            <div className="grid gap-6 lg:grid-cols-[1fr_320px] items-start">

            <aside className="lg:col-start-2 lg:row-start-1 lg:sticky lg:top-6 bg-white border border-gray-200 rounded-xl p-5 text-sm">
              <h2 className="font-bold text-[var(--color-primary)] text-lg mb-5">About the camps</h2>

              <div className="mb-6">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-green-100 text-green-700">Jr Day Camp</span>
                  <span className="font-bold text-gray-900">$25</span>
                </div>
                <p className="text-gray-500 text-xs mb-2">9:30 AM – 12:00 PM</p>
                <p className="text-gray-600">A gentle half-day of crafts, games, songs, and snack for our youngest campers.</p>
                <p className="text-gray-400 text-xs mt-2"><span className="font-medium text-gray-500">Grades:</span> Preschool, K, 1st, 2nd</p>
              </div>

              <div className="mb-6">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-orange-100 text-orange-700">Day Camp</span>
                  <span className="font-bold text-gray-900">$75</span>
                </div>
                <p className="text-gray-500 text-xs mb-2">9:30 AM – 3:00 PM</p>
                <p className="text-gray-600">A full day of camp — morning activities, lunch, plus afternoon programming.</p>
                <p className="text-gray-400 text-xs mt-2"><span className="font-medium text-gray-500">Grades:</span> 3rd, 4th, 5th</p>
              </div>

              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-6">
                <p className="font-semibold text-amber-900 text-xs mb-2">Morning only option</p>
                <p className="text-amber-900 text-xs leading-snug">
                  We know life gets busy, kids have sports and other commitments, and parents with Jr Day and Day Campers might not want to make multiple trips for pickup. That&apos;s why Day Campers can choose to opt out of the afternoon session (12–3pm) and wrap up at the same time as Jr Day Camp. Even though they&apos;re ending early, the price remains the same as normal Day Camp price because we order crafts/supplies for them to complete during the time they are with us.
                </p>
              </div>

              <div className="mb-6">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-orange-100 text-orange-700">Day Camp</span>
                  <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">Helper</span>
                  <span className="font-bold text-gray-900">$25</span>
                </div>
                <p className="text-gray-500 text-xs mb-2">9:30 AM – 3:00 PM</p>
                <p className="text-gray-600">Helper rate for campers who&apos;ve completed 6th grade or higher.</p>
                <p className="text-gray-400 text-xs mt-2"><span className="font-medium text-gray-500">Grades:</span> 6th and up</p>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <p className="font-semibold text-blue-900 text-xs mb-2">6th grade and up — helpers</p>
                <p className="text-blue-900 text-xs leading-snug">
                  Kids who&apos;ve finished 6th grade or beyond join as helpers, supporting our staff in a leadership role with our younger campers. That&apos;s why we offer a special helper rate of $25 per camper at 6th grade and up.
                </p>
              </div>
            </aside>

            <div className="lg:col-start-1 lg:row-start-1">

            <div className="grid gap-4">
              {campers.map((camper, i) => (
                <div key={i} className="bg-white border-2 border-gray-200 rounded-xl p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-8 h-8 rounded-full bg-[var(--color-primary)] text-white flex items-center justify-center text-sm font-bold shrink-0">
                      {i + 1}
                    </div>
                    <span className="text-sm text-gray-400">Camper {i + 1}</span>
                  </div>

                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor={`c-first-${i}`}>First Name</label>
                      <input
                        id={`c-first-${i}`}
                        autoComplete="off"
                        autoCapitalize="words"
                        className={inputClass}
                        placeholder="First name"
                        value={camper.firstName}
                        onChange={(e) => updateCamperField(i, "firstName", e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor={`c-last-${i}`}>Last Name</label>
                      <input
                        id={`c-last-${i}`}
                        autoComplete="off"
                        autoCapitalize="words"
                        className={inputClass}
                        placeholder="Last name"
                        value={camper.lastName}
                        onChange={(e) => updateCamperField(i, "lastName", e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Last Grade Completed</label>
                    <select
                      className={inputClass}
                      value={camper.grade}
                      onChange={(e) => updateGrade(i, e.target.value)}
                    >
                      <option value="">Select grade</option>
                      {GRADE_OPTIONS.map((g) => (
                        <option key={g} value={g}>{g}</option>
                      ))}
                    </select>
                  </div>

                  {camper.campType && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      className="bg-gray-50 rounded-lg p-3 flex items-center justify-between"
                    >
                      <div>
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                          camper.campType.name === "Day Camp"
                            ? "bg-orange-100 text-orange-700"
                            : "bg-green-100 text-green-700"
                        }`}>
                          {camper.campType.name}
                        </span>
                        {camper.grade === "6th and up" && (
                          <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 ml-1">
                            Helper
                          </span>
                        )}
                        <span className="text-gray-400 text-sm ml-2">
                          {getSchedule(camper.campType.name, camper.afternoonOptOut)}
                        </span>
                      </div>
                      <span className="font-bold text-[var(--color-primary)]">
                        ${(camper.priceCents / 100).toFixed(0)}
                      </span>
                    </motion.div>
                  )}

                  {camper.campType?.name === "Day Camp" && (
                    <motion.label
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      className="mt-3 flex items-start gap-3 cursor-pointer bg-amber-50 border border-amber-200 rounded-lg p-3"
                    >
                      <input
                        type="checkbox"
                        checked={camper.afternoonOptOut}
                        onChange={() => toggleAfternoonOptOut(i)}
                        className="w-4 h-4 mt-0.5 accent-[var(--color-accent)]"
                      />
                      <div className="text-sm">
                        <span className="font-medium text-gray-900">Morning only — opt out of afternoon (12–3pm)</span>
                        <p className="text-gray-500 text-xs">
                          Camper will be picked up at noon. Same price.
                        </p>
                      </div>
                    </motion.label>
                  )}

                  {isFirstYearEligibleGrade(camper.grade) && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      className="mt-3 bg-emerald-50 border border-emerald-200 rounded-lg p-3"
                    >
                      <p className="text-sm font-medium text-emerald-900 mb-1">
                        Is this their first year at Bower Hill Day Camp?
                      </p>
                      <p className="text-xs text-emerald-800 mb-3">
                        First-year campers in 3rd grade and under attend for <strong>FREE</strong>.
                      </p>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => setFirstYear(i, true)}
                          className={`text-sm font-semibold px-4 py-1.5 rounded-full border transition-colors ${
                            camper.firstYear === true
                              ? "bg-emerald-600 text-white border-emerald-600"
                              : "bg-white text-emerald-700 border-emerald-300 hover:border-emerald-500"
                          }`}
                        >
                          Yes — first year
                        </button>
                        <button
                          type="button"
                          onClick={() => setFirstYear(i, false)}
                          className={`text-sm font-semibold px-4 py-1.5 rounded-full border transition-colors ${
                            camper.firstYear === false
                              ? "bg-emerald-600 text-white border-emerald-600"
                              : "bg-white text-emerald-700 border-emerald-300 hover:border-emerald-500"
                          }`}
                        >
                          No — returning
                        </button>
                      </div>
                    </motion.div>
                  )}
                </div>
              ))}
            </div>

            {campers.some((c) => c.campType) && (
              <div className="mt-6 bg-white border border-gray-200 rounded-xl p-4">
                {campers.filter((c) => c.campType).map((c, i) => (
                  <div key={i} className="flex justify-between text-gray-500 text-sm mb-1">
                    <span>{c.firstName || `Camper ${i + 1}`} — {c.campType!.name}</span>
                    <span>${(c.priceCents / 100).toFixed(0)}</span>
                  </div>
                ))}
                <hr className="my-2" />
                <div className="flex justify-between font-bold text-gray-900">
                  <span>Total</span>
                  <span>${(totalCents / 100).toFixed(0)}</span>
                </div>
              </div>
            )}

            <button
              onClick={() => setStep("guardian")}
              disabled={!detailsReady}
              className="mt-6 w-full bg-[var(--color-primary)] hover:bg-[var(--color-primary-light)] text-white font-bold text-lg py-4 rounded-full transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            >
              Continue to Parent Info
            </button>

            </div>
            </div>
          </motion.div>
        )}

        {/* ═══════ SCREEN 3: GUARDIAN ═══════ */}
        {step === "guardian" && (
          <motion.div
            key="guardian"
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -30 }}
            transition={{ duration: 0.3 }}
            className="max-w-2xl mx-auto px-6 pb-16 w-full"
          >
            <button onClick={() => setStep("details")} className="text-sm text-[var(--color-primary)] mb-4 hover:underline">
              &larr; Back
            </button>
            <h1 className="text-3xl font-bold text-[var(--color-primary)] mb-2">
              Parent / Guardian
            </h1>
            <p className="text-gray-500 mb-6">This is where we&apos;ll send your receipt and confirmation.</p>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (guardianReady) setStep("pickup");
              }}
              className="grid gap-4"
            >
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelClass} htmlFor="g-first">First Name *</label>
                  <input
                    id="g-first"
                    required
                    autoComplete="given-name"
                    autoCapitalize="words"
                    className={inputClass}
                    value={guardian.first_name}
                    onChange={(e) => setGuardian({ ...guardian, first_name: e.target.value })}
                  />
                </div>
                <div>
                  <label className={labelClass} htmlFor="g-last">Last Name *</label>
                  <input
                    id="g-last"
                    required
                    autoComplete="family-name"
                    autoCapitalize="words"
                    className={inputClass}
                    value={guardian.last_name}
                    onChange={(e) => setGuardian({ ...guardian, last_name: e.target.value })}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelClass} htmlFor="g-email">Email *</label>
                  <input
                    id="g-email"
                    required
                    type="email"
                    inputMode="email"
                    autoComplete="email"
                    autoCapitalize="off"
                    autoCorrect="off"
                    spellCheck={false}
                    pattern="[^\s@]+@[^\s@]+\.[^\s@]+"
                    placeholder="you@example.com"
                    className={inputClass}
                    value={guardian.email}
                    onChange={(e) => setGuardian({ ...guardian, email: e.target.value })}
                  />
                </div>
                <div>
                  <label className={labelClass} htmlFor="g-phone">Phone *</label>
                  <input
                    id="g-phone"
                    required
                    type="tel"
                    inputMode="tel"
                    autoComplete="tel"
                    pattern="\d{3}-\d{3}-\d{4}"
                    placeholder="412-555-1234"
                    maxLength={12}
                    className={inputClass}
                    value={guardian.phone}
                    onChange={(e) => setGuardian({ ...guardian, phone: formatPhone(e.target.value) })}
                  />
                </div>
              </div>
              <div>
                <label className={labelClass} htmlFor="g-addr">Address</label>
                <input
                  id="g-addr"
                  autoComplete="street-address"
                  className={inputClass}
                  placeholder="Street address"
                  value={guardian.address_line1}
                  onChange={(e) => setGuardian({ ...guardian, address_line1: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className={labelClass} htmlFor="g-city">City</label>
                  <input
                    id="g-city"
                    autoComplete="address-level2"
                    autoCapitalize="words"
                    className={inputClass}
                    value={guardian.city}
                    onChange={(e) => setGuardian({ ...guardian, city: e.target.value })}
                  />
                </div>
                <div>
                  <label className={labelClass} htmlFor="g-state">State</label>
                  <input
                    id="g-state"
                    autoComplete="address-level1"
                    autoCapitalize="characters"
                    pattern="[A-Z]{2}"
                    maxLength={2}
                    placeholder="PA"
                    className={inputClass}
                    value={guardian.state}
                    onChange={(e) => setGuardian({ ...guardian, state: formatState(e.target.value) })}
                  />
                </div>
                <div>
                  <label className={labelClass} htmlFor="g-zip">ZIP</label>
                  <input
                    id="g-zip"
                    type="text"
                    inputMode="numeric"
                    autoComplete="postal-code"
                    pattern="\d{5}"
                    maxLength={5}
                    placeholder="15243"
                    className={inputClass}
                    value={guardian.zip}
                    onChange={(e) => setGuardian({ ...guardian, zip: formatZip(e.target.value) })}
                  />
                </div>
              </div>
              <button
                type="submit"
                disabled={!guardianReady}
                className="mt-4 w-full bg-[var(--color-primary)] hover:bg-[var(--color-primary-light)] text-white font-bold text-lg py-4 rounded-full transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              >
                Continue to Emergency Contacts
              </button>
            </form>
          </motion.div>
        )}

        {/* ═══════ SCREEN 4: PICKUP / EMERGENCY ═══════ */}
        {step === "pickup" && (
          <motion.div
            key="pickup"
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -30 }}
            transition={{ duration: 0.3 }}
            className="max-w-2xl mx-auto px-6 pb-16 w-full"
          >
            <button onClick={() => setStep("guardian")} className="text-sm text-[var(--color-primary)] mb-4 hover:underline">
              &larr; Back
            </button>
            <h1 className="text-3xl font-bold text-[var(--color-primary)] mb-2">
              Authorized Pickup &amp; Emergency Contacts
            </h1>
            <p className="text-gray-500 mb-4">
              Adults (other than yourself) authorized to pick up your child. These also serve as emergency contacts.
            </p>

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
                      ? `Applies to ${campers.map((c) => c.firstName).filter(Boolean).join(", ") || `all ${numKids} campers`}`
                      : "You'll assign contacts to specific campers below"}
                  </p>
                </div>
              </label>
            )}

            {pickups.map((pickup, i) => (
              <div key={i} className="bg-white border border-gray-200 rounded-xl p-6 mb-4">
                {!sameContactForAll && numKids > 1 && (
                  <div className="mb-5 pb-5 border-b border-gray-200">
                    <label className={labelClass}>This authorized contact is for the following campers:</label>
                    <div className="flex flex-wrap gap-2">
                      {campers.map((c, ci) => {
                        const selected = pickup.camperIndexes.includes(ci);
                        return (
                          <button
                            key={ci}
                            type="button"
                            onClick={() => togglePickupCamper(i, ci)}
                            className={`text-sm px-3 py-1 rounded-full border transition-colors ${
                              selected
                                ? "bg-[var(--color-primary)] text-white border-[var(--color-primary)]"
                                : "bg-white text-gray-400 border-gray-300 hover:border-gray-400"
                            }`}
                          >
                            {c.firstName || `Camper ${ci + 1}`}
                          </button>
                        );
                      })}
                    </div>
                    <p className="text-xs text-gray-400 mt-1">Tap names to select which campers this contact is for</p>
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
                    <label className={labelClass} htmlFor={`p-name-${i}`}>Full Name *</label>
                    <input
                      id={`p-name-${i}`}
                      autoComplete="name"
                      autoCapitalize="words"
                      className={inputClass}
                      placeholder="First and Last Name"
                      value={pickup.name}
                      onChange={(e) => updatePickup(i, "name", e.target.value)}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className={labelClass} htmlFor={`p-phone-${i}`}>Phone *</label>
                      <input
                        id={`p-phone-${i}`}
                        type="tel"
                        inputMode="tel"
                        autoComplete="tel"
                        pattern="\d{3}-\d{3}-\d{4}"
                        placeholder="412-555-1234"
                        maxLength={12}
                        className={inputClass}
                        value={pickup.phone}
                        onChange={(e) => updatePickup(i, "phone", formatPhone(e.target.value))}
                      />
                    </div>
                    <div>
                      <label className={labelClass} htmlFor={`p-rel-${i}`}>Relationship *</label>
                      <input
                        id={`p-rel-${i}`}
                        autoCapitalize="words"
                        className={inputClass}
                        placeholder="e.g. Grandparent, Aunt"
                        value={pickup.relationship}
                        onChange={(e) => updatePickup(i, "relationship", e.target.value)}
                      />
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
                      Still need a contact for:{" "}
                      <span className="font-semibold">{uncoveredCampers.map((c) => c.firstName || "unnamed").join(", ")}</span>.
                      Either tap their name on an existing contact above, or add another contact.
                    </p>
                  ) : null}
                </div>
              </div>
            )}

            <button
              type="button"
              onClick={() => { setCurrentCamperInfo(0); setStep("camperInfo"); }}
              disabled={!pickupReady}
              className="mt-4 w-full bg-[var(--color-primary)] hover:bg-[var(--color-primary-light)] text-white font-bold text-lg py-4 rounded-full transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            >
              Continue to Camper Info
            </button>
          </motion.div>
        )}

        {/* ═══════ SCREEN 5: CAMPER INFO (age + medical, per kid) ═══════ */}
        {step === "camperInfo" && campers[currentCamperInfo] && (
          <motion.div
            key={`camperInfo-${currentCamperInfo}`}
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -30 }}
            transition={{ duration: 0.3 }}
            className="max-w-2xl mx-auto px-6 pb-16 w-full"
          >
            <button
              onClick={() => {
                if (currentCamperInfo > 0) setCurrentCamperInfo(currentCamperInfo - 1);
                else setStep("pickup");
              }}
              className="text-sm text-[var(--color-primary)] mb-4 hover:underline"
            >
              &larr; Back
            </button>
            <h1 className="text-3xl font-bold text-[var(--color-primary)] mb-2">
              Camper {numKids > 1 ? `${currentCamperInfo + 1} of ${numKids}` : "Information"}
            </h1>
            <p className="text-gray-500 mb-6">
              {campers[currentCamperInfo].firstName} {campers[currentCamperInfo].lastName}
            </p>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!campers[currentCamperInfo].age.trim() || !campers[currentCamperInfo].allergies.trim()) return;
                if (currentCamperInfo < numKids - 1) setCurrentCamperInfo(currentCamperInfo + 1);
                else setStep("consent");
              }}
              className="grid gap-4"
            >
              <div>
                <label className={labelClass} htmlFor="c-age">Age *</label>
                <input
                  id="c-age"
                  required
                  type="number"
                  inputMode="numeric"
                  min="3"
                  max="18"
                  className={inputClass}
                  value={campers[currentCamperInfo].age}
                  onChange={(e) => updateCamperField(currentCamperInfo, "age", e.target.value)}
                />
              </div>
              <div>
                <label className={labelClass}>Food Allergies / Medical Conditions *</label>
                <textarea
                  required
                  className={inputClass}
                  rows={3}
                  placeholder="List any food allergies, medical conditions, or medications. Write 'None' if not applicable."
                  value={campers[currentCamperInfo].allergies}
                  onChange={(e) => updateCamperField(currentCamperInfo, "allergies", e.target.value)}
                />
              </div>
              <button
                type="submit"
                className="mt-4 w-full bg-[var(--color-primary)] hover:bg-[var(--color-primary-light)] text-white font-bold text-lg py-4 rounded-full transition-colors"
              >
                {currentCamperInfo < numKids - 1 ? `Next: Camper ${currentCamperInfo + 2}` : "Continue to Waivers"}
              </button>
            </form>
          </motion.div>
        )}

        {/* ═══════ SCREEN 6: CONSENT ═══════ */}
        {step === "consent" && (
          <motion.div
            key="consent"
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -30 }}
            transition={{ duration: 0.3 }}
            className="max-w-2xl mx-auto px-6 pb-16 w-full"
          >
            <button
              onClick={() => {
                setCurrentCamperInfo(numKids - 1);
                setStep("camperInfo");
              }}
              className="text-sm text-[var(--color-primary)] mb-4 hover:underline"
            >
              &larr; Back
            </button>
            <h1 className="text-3xl font-bold text-[var(--color-primary)] mb-6">
              Consent &amp; Waivers
            </h1>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!consentReady) return;
                setStep("review");
              }}
              className="grid gap-6"
            >
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  className="mt-1 w-5 h-5"
                  checked={consent.liability_waiver}
                  onChange={(e) => setConsent({ ...consent, liability_waiver: e.target.checked })}
                />
                <span className="text-gray-700">
                  <strong>Liability Waiver</strong> — I understand that participation in camp activities involves inherent risks. I release Bower Hill Community Church and its volunteers from liability for any injury or illness that may occur during camp.
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
                  <strong>Photo/Video Release</strong> — I grant permission for photos and videos of my child to be used in church communications and social media.
                </span>
              </label>
              <div>
                <label className={labelClass} htmlFor="consent-sig">Digital Signature (Full Name) *</label>
                <input
                  id="consent-sig"
                  required
                  autoComplete="name"
                  autoCapitalize="words"
                  className={inputClass}
                  placeholder="Type your full legal name"
                  value={consent.signed_by}
                  onChange={(e) => setConsent({ ...consent, signed_by: e.target.value })}
                />
              </div>
              <button
                type="submit"
                disabled={!consentReady}
                className="w-full bg-[var(--color-primary)] hover:bg-[var(--color-primary-light)] text-white font-bold text-lg py-4 rounded-full transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              >
                Continue to Review
              </button>
            </form>
          </motion.div>
        )}

        {/* ═══════ SCREEN 7: REVIEW ═══════ */}
        {step === "review" && (
          <motion.div
            key="review"
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -30 }}
            transition={{ duration: 0.3 }}
            className="max-w-2xl mx-auto px-6 pb-16 w-full"
          >
            <button onClick={() => setStep("consent")} className="text-sm text-[var(--color-primary)] mb-4 hover:underline">
              &larr; Back
            </button>
            <h1 className="text-3xl font-bold text-[var(--color-primary)] mb-2">
              Review &amp; Pay
            </h1>
            <p className="text-gray-500 mb-6">
              Please review everything below. Hit the button at the bottom to pay and finish.
            </p>

            {/* Parent */}
            <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4">
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">Parent</h2>
              <div className="text-gray-900 font-medium">{guardian.first_name} {guardian.last_name}</div>
              <div className="text-gray-600 text-sm">{guardian.email}</div>
              <div className="text-gray-600 text-sm">{guardian.phone}</div>
              {guardian.address_line1 && (
                <div className="text-gray-600 text-sm mt-1">
                  {guardian.address_line1}{guardian.city ? `, ${guardian.city}` : ""}{guardian.state ? `, ${guardian.state}` : ""} {guardian.zip}
                </div>
              )}
            </div>

            {/* Campers */}
            <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4">
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Campers</h2>
              {campers.map((c, i) => (
                <div key={i} className="mb-3 last:mb-0 pb-3 last:pb-0 border-b last:border-b-0 border-gray-100">
                  <div className="flex justify-between mb-1">
                    <span className="font-bold text-gray-900">{c.firstName} {c.lastName}</span>
                    <span className="font-medium">${(c.priceCents / 100).toFixed(0)}</span>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className={`font-bold px-2 py-0.5 rounded-full ${
                      c.campType?.name === "Day Camp" ? "bg-orange-100 text-orange-700" : "bg-green-100 text-green-700"
                    }`}>
                      {c.campType?.name}
                    </span>
                    {c.grade === "6th and up" && (
                      <span className="font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">Helper</span>
                    )}
                    {c.firstYear === true && (
                      <span className="font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">1st Year — Free</span>
                    )}
                    <span className="text-gray-400">Grade: {c.grade}</span>
                    <span className="text-gray-400">&bull; Age: {c.age}</span>
                    <span className="text-gray-400">&bull; {getSchedule(c.campType!.name, c.afternoonOptOut)}</span>
                  </div>
                  {c.allergies && c.allergies.toLowerCase() !== "none" && (
                    <div className="text-gray-500 text-xs mt-1">Allergies/Medical: {c.allergies}</div>
                  )}
                </div>
              ))}
            </div>

            {/* Pickups */}
            <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4">
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Authorized Pickup / Emergency Contacts</h2>
              <ul className="text-sm text-gray-700 space-y-1">
                {validPickups.map((p, i) => (
                  <li key={i}>
                    <span className="font-medium">{p.name}</span>
                    <span className="text-gray-500"> — {p.relationship} — {p.phone}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Consent */}
            <div className="bg-white border border-gray-200 rounded-xl p-5 mb-6">
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">Waivers</h2>
              <div className="text-sm text-gray-700">
                <div>Liability: {consent.liability_waiver ? "Accepted" : "Not accepted"}</div>
                <div>Photo/Video: {consent.photo_release ? "Accepted" : "Not accepted"}</div>
                <div>Signed by: <span className="font-medium">{consent.signed_by}</span></div>
              </div>
            </div>

            {/* Total */}
            <div className="bg-white border border-gray-200 rounded-xl p-5 mb-6 flex justify-between text-lg font-bold">
              <span>Total</span>
              <span>${(totalCents / 100).toFixed(0)}</span>
            </div>

            {totalCents === 0 ? (
              <button
                onClick={() => handleCheckout("", "free")}
                className="w-full bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-white font-bold text-lg py-4 rounded-full transition-colors"
              >
                Complete Registration — Free
              </button>
            ) : (
              <button
                onClick={() => setStep("payment")}
                className="w-full bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-white font-bold text-lg py-4 rounded-full transition-colors"
              >
                Continue to Payment
              </button>
            )}
          </motion.div>
        )}

        {/* ═══════ SCREEN 8: PAYMENT ═══════ */}
        {step === "payment" && (
          <motion.div
            key="payment"
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -30 }}
            transition={{ duration: 0.3 }}
            className="max-w-2xl mx-auto px-6 pb-16 w-full"
          >
            <button onClick={() => setStep("review")} className="text-sm text-[var(--color-primary)] mb-4 hover:underline">
              &larr; Back
            </button>
            <h1 className="text-3xl font-bold text-[var(--color-primary)] mb-2">
              Payment
            </h1>
            <p className="text-gray-500 mb-6">
              Total: <span className="font-bold text-gray-900">${(totalCents / 100).toFixed(0)}</span>
            </p>
            <PaymentStep
              amountCents={totalCents}
              guardian={guardian}
              onSuccess={handleCheckout}
            />
          </motion.div>
        )}

        {/* ═══════ CONFIRMATION ═══════ */}
        {step === "confirmed" && (
          <motion.div
            key="confirmed"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.4 }}
            className="max-w-2xl mx-auto px-6 py-16 w-full"
          >
            <div className="text-center mb-10">
              <div className="text-6xl mb-4">&#9989;</div>
              <h1 className="text-3xl font-bold text-[var(--color-primary)] mb-2">
                Registration Complete!
              </h1>
              <p className="text-gray-500 mb-4">
                A confirmation email with your receipt and all the details is on its way to {guardian.email}.
              </p>
            </div>

            <div className="grid gap-4 mb-8">
              {campers.map((c, i) => (
                <div key={i} className="bg-white border border-gray-200 rounded-xl p-5">
                  <div className="flex flex-wrap items-center gap-2 mb-2">
                    <span className="font-bold text-gray-900">{c.firstName} {c.lastName}</span>
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                      c.campType?.name === "Day Camp" ? "bg-orange-100 text-orange-700" : "bg-green-100 text-green-700"
                    }`}>
                      {c.campType?.name}
                    </span>
                    {c.grade === "6th and up" && (
                      <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">
                        Helper
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-500">{getSchedule(c.campType!.name, c.afternoonOptOut)}</p>
                </div>
              ))}
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-8 text-sm text-blue-800">
              <p className="font-bold mb-1">Camp Location</p>
              <p>Bower Hill Community Church</p>
              <p>70 Moffett St, Pittsburgh, PA 15243</p>
            </div>

            <Link
              href="/"
              className="block w-full text-center bg-[var(--color-primary)] hover:bg-[var(--color-primary-light)] text-white font-bold text-lg py-4 rounded-full transition-colors"
            >
              Back to Home
            </Link>
            {registrationId && (
              <p className="text-center text-gray-300 text-xs mt-4 font-mono">
                Ref: {registrationId.slice(0, 8)}
              </p>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Payment components ──────────────────────────────────

function PaymentStep({
  amountCents,
  guardian,
  onSuccess,
}: {
  amountCents: number;
  guardian: Guardian;
  onSuccess: (paymentIntentId: string, status: string) => void;
}) {
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function createIntent() {
      try {
        const res = await fetch("/api/payments/create-intent", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ amountCents }),
        });
        const data = await res.json();
        if (cancelled) return;
        if (!res.ok) {
          setError(data.error || "Could not initialize payment");
          return;
        }
        setClientSecret(data.clientSecret);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Network error");
      }
    }
    createIntent();
    return () => { cancelled = true; };
  }, [amountCents]);

  if (error) {
    return <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700 text-sm">{error}</div>;
  }
  if (!clientSecret) {
    return <p className="text-gray-400">Preparing secure payment form…</p>;
  }
  return (
    <Elements stripe={stripePromise} options={{ clientSecret, appearance: { theme: "stripe" } }}>
      <PaymentForm guardian={guardian} onSuccess={onSuccess} />
    </Elements>
  );
}

function PaymentForm({
  guardian,
  onSuccess,
}: {
  guardian: Guardian;
  onSuccess: (paymentIntentId: string, status: string) => void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!stripe || !elements) return;
    setSubmitting(true);
    setError(null);
    const fullName = `${guardian.first_name} ${guardian.last_name}`.trim();
    const { error: stripeError, paymentIntent } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        payment_method_data: { billing_details: { email: guardian.email, name: fullName } },
      },
      redirect: "if_required",
    });
    if (stripeError) {
      setError(stripeError.message ?? "Payment failed");
      setSubmitting(false);
      return;
    }
    if (paymentIntent?.status === "succeeded") {
      onSuccess(paymentIntent.id, paymentIntent.status);
      return;
    }
    setError(`Unexpected payment status: ${paymentIntent?.status ?? "unknown"}`);
    setSubmitting(false);
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-4">
      <div className="bg-white border border-gray-200 rounded-xl p-5">
        <PaymentElement
          options={{
            layout: { type: "accordion", defaultCollapsed: false, radios: "never", spacedAccordionItems: false },
            wallets: { applePay: "auto", googlePay: "auto", link: "never" },
            fields: { billingDetails: { address: { country: "auto", postalCode: "auto" } } },
          }}
        />
      </div>
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-red-700 text-sm">{error}</div>
      )}
      <button
        type="submit"
        disabled={!stripe || submitting}
        className="w-full bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-white font-bold text-lg py-4 rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {submitting ? "Processing…" : "Pay & Complete Registration"}
      </button>
    </form>
  );
}
