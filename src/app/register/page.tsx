"use client";

import { useState, useEffect } from "react";
import Header from "@/components/Header";
import { motion, AnimatePresence } from "framer-motion";
import { loadStripe } from "@stripe/stripe-js";
import { Elements, PaymentElement, LinkAuthenticationElement, useStripe, useElements } from "@stripe/react-stripe-js";

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
  campType: CampType | null;
  priceCents: number;
  afternoonOptOut: boolean;
};

type Step = "count" | "details" | "checkout" | "payment" | "confirmed";

// ─── Constants ───────────────────────────────────────────

const GRADE_OPTIONS = ["Preschool", "K", "1st", "2nd", "3rd", "4th", "5th", "6th and up"];
const JR_GRADES = new Set(["Preschool", "K", "1st", "2nd"]);
const HELPER_GRADE = "6th and up";

function emptyCamper(): CamperEntry {
  return { firstName: "", lastName: "", grade: "", campType: null, priceCents: 0, afternoonOptOut: false };
}

function getPriceCents(grade: string): number {
  if (!grade) return 0;
  if (JR_GRADES.has(grade)) return 2500;
  if (grade === HELPER_GRADE) return 2500;
  return 7500;
}

function getSchedule(campName: string, optOut: boolean): string {
  if (campName === "Jr Day Camp") return "9:30 AM – 12:00 PM";
  if (optOut) return "9:30 AM – 12:00 PM (Morning only)";
  return "9:30 AM – 3:00 PM";
}

// ─── Component ───────────────────────────────────────────

export default function RegisterPage() {
  const [step, setStep] = useState<Step>("count");
  const [campTypes, setCampTypes] = useState<CampType[]>([]);
  const [numCampers, setNumCampers] = useState(1);
  const [campers, setCampers] = useState<CamperEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [registrationId, setRegistrationId] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);

  const totalCents = campers.reduce((sum, c) => sum + c.priceCents, 0);

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

  // Hydrate form state from sessionStorage on mount (survives back-button)
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (raw) {
        const saved = JSON.parse(raw);
        if (typeof saved.numCampers === "number") setNumCampers(saved.numCampers);
        if (Array.isArray(saved.campers) && saved.campers.length) setCampers(saved.campers);
        // Don't restore terminal/transient steps — bounce back to review
        if (saved.step === "details" || saved.step === "checkout") setStep(saved.step);
        else if (saved.step === "payment" || saved.step === "confirmed") setStep("checkout");
      }
    } catch {
      // ignore corrupt storage
    }
    setHydrated(true);
  }, []);

  // Persist whenever the form state changes (after initial hydration)
  useEffect(() => {
    if (!hydrated) return;
    if (step === "confirmed") return; // confirmed clears storage explicitly in handleCheckout
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ numCampers, campers, step }));
    } catch {
      // ignore quota / private mode failures
    }
  }, [hydrated, numCampers, campers, step]);

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

  function updateCamper(index: number, field: "firstName" | "lastName", value: string) {
    setCampers((prev) => prev.map((c, i) => (i === index ? { ...c, [field]: value } : c)));
  }

  function updateGrade(index: number, grade: string) {
    setCampers((prev) =>
      prev.map((c, i) => {
        if (i !== index) return c;
        return {
          ...c,
          grade,
          campType: resolveCampType(grade),
          priceCents: getPriceCents(grade),
          afternoonOptOut: false,
        };
      })
    );
  }

  function toggleAfternoonOptOut(index: number) {
    setCampers((prev) =>
      prev.map((c, i) => (i === index ? { ...c, afternoonOptOut: !c.afternoonOptOut } : c))
    );
  }

  // ─── Checkout ────────────────────────────────────────

  async function handleCheckout(stripePaymentId: string, stripeStatus: string, contactEmail: string) {
    try {
      const res = await fetch("/api/registrations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amountCents: totalCents,
          stripePaymentId,
          stripeStatus,
          contactEmail,
          campers: campers.map((c) => ({
            campTypeId: c.campType?.id ?? null,
            firstName: c.firstName,
            lastName: c.lastName,
            grade: c.grade,
            afternoonOptOut: c.afternoonOptOut,
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert("Payment succeeded but we hit a problem saving your registration. Please contact us — your charge ID is " + stripePaymentId + "\n\n" + (data.error || ""));
        console.error("Registration save failed:", data);
        return;
      }
      setRegistrationId(data.registrationId);
      setStep("confirmed");
      try { sessionStorage.removeItem(STORAGE_KEY); } catch {}
    } catch (e) {
      alert("Payment succeeded but we couldn't reach the server. Please contact us — your charge ID is " + stripePaymentId);
      console.error(e);
    }
  }

  // ─── Derived ─────────────────────────────────────────

  const detailsReady = campers.every((c) => c.firstName.trim() && c.lastName.trim() && c.grade);

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
    { key: "checkout", label: "3. Review" },
    { key: "payment", label: "4. Payment" },
  ];

  const showProgress = step !== "count" && step !== "confirmed";

  // ─── Render ──────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Header rightText="Registration" />

      {showProgress && (
        <div className="max-w-2xl mx-auto px-6 pt-8 w-full">
          <div className="flex items-center gap-2 text-sm mb-8 flex-wrap">
            {stepList.map((s, i) => (
              <span key={s.key} className="flex items-center gap-2">
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
                  Kids who&apos;ve finished 6th grade or beyond join as helpers, supporting staff in a leadership role with our younger campers. That&apos;s why we offer a special helper rate of $25 per camper at 6th grade and up.
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
                      <label className="block text-sm font-medium text-gray-700 mb-1">First Name</label>
                      <input
                        className="w-full border border-gray-300 rounded-lg px-4 py-3 text-gray-900 focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] focus:border-transparent"
                        placeholder="First name"
                        value={camper.firstName}
                        onChange={(e) => updateCamper(i, "firstName", e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Last Name</label>
                      <input
                        className="w-full border border-gray-300 rounded-lg px-4 py-3 text-gray-900 focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] focus:border-transparent"
                        placeholder="Last name"
                        value={camper.lastName}
                        onChange={(e) => updateCamper(i, "lastName", e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Last Grade Completed</label>
                    <select
                      className="w-full border border-gray-300 rounded-lg px-4 py-3 text-gray-900 focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] focus:border-transparent"
                      value={camper.grade}
                      onChange={(e) => updateGrade(i, e.target.value)}
                    >
                      <option value="">Select grade</option>
                      {GRADE_OPTIONS.map((g) => (
                        <option key={g} value={g}>{g}</option>
                      ))}
                    </select>
                  </div>

                  {/* Camp type badge (appears after grade selection) */}
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
                        <span className="text-gray-400 text-sm ml-2">
                          {getSchedule(camper.campType.name, camper.afternoonOptOut)}
                        </span>
                      </div>
                      <span className="font-bold text-[var(--color-primary)]">
                        ${(camper.priceCents / 100).toFixed(0)}
                      </span>
                    </motion.div>
                  )}

                  {/* Afternoon opt-out checkbox (Day Camp only) */}
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
                </div>
              ))}
            </div>

            {/* Running total */}
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
              onClick={() => setStep("checkout")}
              disabled={!detailsReady}
              className="mt-6 w-full bg-[var(--color-primary)] hover:bg-[var(--color-primary-light)] text-white font-bold text-lg py-4 rounded-full transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            >
              Continue to Review
            </button>

            </div>
            </div>
          </motion.div>
        )}

        {/* ═══════ SCREEN 3: REVIEW & CHECKOUT ═══════ */}
        {step === "checkout" && (
          <motion.div
            key="checkout"
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
              Review &amp; Complete
            </h1>
            <p className="text-gray-500 mb-6">
              After checkout you&apos;ll receive an email with a printable schedule for each camper.
            </p>

            <div className="bg-white border border-gray-200 rounded-xl p-6 mb-6">
              {campers.map((c, i) => (
                <div key={i} className="mb-4 last:mb-0">
                  <div className="flex justify-between mb-1">
                    <span className="font-bold text-gray-900">{c.firstName} {c.lastName}</span>
                    <span className="font-medium">${(c.priceCents / 100).toFixed(0)}</span>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                      c.campType?.name === "Day Camp" ? "bg-orange-100 text-orange-700" : "bg-green-100 text-green-700"
                    }`}>
                      {c.campType?.name}
                    </span>
                    <span className="text-gray-400 text-xs">Grade: {c.grade}</span>
                    <span className="text-gray-400 text-xs">&bull; {getSchedule(c.campType!.name, c.afternoonOptOut)}</span>
                  </div>
                  {i < campers.length - 1 && <hr className="mt-3" />}
                </div>
              ))}
              <hr className="my-4" />
              <div className="flex justify-between text-lg font-bold">
                <span>Total</span>
                <span>${(totalCents / 100).toFixed(0)}</span>
              </div>
            </div>

            <button
              onClick={() => setStep("payment")}
              className="w-full bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-white font-bold text-lg py-4 rounded-full transition-colors"
            >
              Continue to Payment
            </button>
            <p className="text-center text-gray-400 text-sm mt-4">
              Secure payment via Stripe. Emergency info collected after.
            </p>
          </motion.div>
        )}

        {/* ═══════ SCREEN 4: PAYMENT ═══════ */}
        {step === "payment" && (
          <motion.div
            key="payment"
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -30 }}
            transition={{ duration: 0.3 }}
            className="max-w-2xl mx-auto px-6 pb-16 w-full"
          >
            <button onClick={() => setStep("checkout")} className="text-sm text-[var(--color-primary)] mb-4 hover:underline">
              &larr; Back
            </button>
            <h1 className="text-3xl font-bold text-[var(--color-primary)] mb-2">
              Payment
            </h1>
            <p className="text-gray-500 mb-6">
              Total: <span className="font-bold text-gray-900">${(totalCents / 100).toFixed(0)}</span>
            </p>
            <PaymentStep amountCents={totalCents} onSuccess={handleCheckout} />
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
                You&apos;ll receive an email with a printable schedule for each camper.
              </p>
              <div className="bg-amber-50 border border-amber-300 rounded-xl p-4 text-left text-amber-900 text-sm flex items-start gap-3">
                <span className="text-2xl leading-none shrink-0" aria-hidden="true">&#9888;&#65039;</span>
                <div>
                  <p className="font-bold mb-1">Remember — we still need your emergency contact information.</p>
                  <p>Please continue adding that information by clicking the continue button below.</p>
                </div>
              </div>
            </div>

            {/* Per-kid schedule cards */}
            <div className="grid gap-4 mb-8">
              {campers.map((c, i) => (
                <div key={i} className="bg-white border border-gray-200 rounded-xl p-5">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="font-bold text-gray-900">{c.firstName} {c.lastName}</span>
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                      c.campType?.name === "Day Camp" ? "bg-orange-100 text-orange-700" : "bg-green-100 text-green-700"
                    }`}>
                      {c.campType?.name}
                    </span>
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

            <a
              href={`/register/info?registration_id=${registrationId}&num_kids=${campers.length}`}
              className="block w-full text-center bg-[var(--color-primary)] hover:bg-[var(--color-primary-light)] text-white font-bold text-lg py-4 rounded-full transition-colors"
            >
              Continue — Provide Contact &amp; Emergency Info
            </a>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Payment components ──────────────────────────────────

function PaymentStep({
  amountCents,
  onSuccess,
}: {
  amountCents: number;
  onSuccess: (paymentIntentId: string, status: string, email: string) => void;
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
      <PaymentForm onSuccess={onSuccess} />
    </Elements>
  );
}

function PaymentForm({ onSuccess }: { onSuccess: (paymentIntentId: string, status: string, email: string) => void }) {
  const stripe = useStripe();
  const elements = useElements();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!stripe || !elements) return;
    if (!email.trim()) {
      setError("Please enter an email address.");
      return;
    }
    if (!name.trim()) {
      setError("Please enter the name on the card.");
      return;
    }
    setSubmitting(true);
    setError(null);
    const { error: stripeError, paymentIntent } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        payment_method_data: { billing_details: { email, name: name.trim() } },
      },
      redirect: "if_required",
    });
    if (stripeError) {
      setError(stripeError.message ?? "Payment failed");
      setSubmitting(false);
      return;
    }
    if (paymentIntent?.status === "succeeded") {
      onSuccess(paymentIntent.id, paymentIntent.status, email);
      return;
    }
    setError(`Unexpected payment status: ${paymentIntent?.status ?? "unknown"}`);
    setSubmitting(false);
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-4">
      <div className="bg-white border border-gray-200 rounded-xl p-5 grid gap-3">
        <LinkAuthenticationElement
          onChange={(e) => setEmail(e.value.email)}
        />
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Name</label>
          <input
            type="text"
            autoComplete="cc-name"
            placeholder="Full name"
            className="w-full border border-gray-300 rounded-md px-3 py-2.5 text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] focus:border-transparent"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </div>
      </div>
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
