"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import Header from "@/components/Header";

type CampType = {
  id: string;
  name: string;
  description: string;
  schedule: string;
  price_cents: number;
};

type Activity = {
  id: string;
  name: string;
  description: string;
  type: string;
};

type CampSelection = {
  camp: CampType;
  count: number;
};

type KidEntry = {
  name: string;
  campType: CampType;
  activityIds: string[];
};

type Step = "camp" | "activities" | "checkout";

const TYPE_COLORS: Record<string, string> = {
  Creative: "bg-purple-100 text-purple-700",
  Active: "bg-orange-100 text-orange-700",
  Spiritual: "bg-blue-100 text-blue-700",
  Educational: "bg-green-100 text-green-700",
};

export default function RegisterPage() {
  const [step, setStep] = useState<Step>("camp");
  const [campTypes, setCampTypes] = useState<CampType[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [selections, setSelections] = useState<CampSelection[]>([]);
  const [kids, setKids] = useState<KidEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [openKid, setOpenKid] = useState(0);

  const totalKids = selections.reduce((sum, s) => sum + s.count, 0);
  const totalCents = selections.reduce((sum, s) => sum + s.camp.price_cents * s.count, 0);

  useEffect(() => {
    async function fetchData() {
      const [campRes, actRes] = await Promise.all([
        supabase.from("camp_types").select("*").order("price_cents", { ascending: false }),
        supabase.from("activities").select("*").order("type").order("name"),
      ]);
      if (campRes.data) {
        setCampTypes(campRes.data);
        setSelections(campRes.data.map((camp) => ({ camp, count: 0 })));
      }
      setActivities(actRes.data || []);
      setLoading(false);
    }
    fetchData();
  }, []);

  function updateCount(index: number, delta: number) {
    setSelections((prev) =>
      prev.map((s, i) =>
        i === index ? { ...s, count: Math.max(0, Math.min(10, s.count + delta)) } : s
      )
    );
  }

  function handleContinueToActivities() {
    const newKids: KidEntry[] = [];
    for (const sel of selections) {
      for (let i = 0; i < sel.count; i++) {
        newKids.push({ name: "", campType: sel.camp, activityIds: [] });
      }
    }
    setKids(newKids);
    setStep("activities");
  }

  function updateKidName(index: number, name: string) {
    setKids((prev) => prev.map((k, i) => (i === index ? { ...k, name } : k)));
  }

  function getMaxActivities(campName: string): number {
    return campName === "Jr Day Camp" ? 2 : 4;
  }

  function toggleActivity(kidIndex: number, activityId: string) {
    setKids((prev) =>
      prev.map((k, i) => {
        if (i !== kidIndex) return k;
        const has = k.activityIds.includes(activityId);
        if (has) {
          return { ...k, activityIds: k.activityIds.filter((id) => id !== activityId) };
        }
        const max = getMaxActivities(k.campType.name);
        if (k.activityIds.length >= max) return k; // don't add more
        return { ...k, activityIds: [...k.activityIds, activityId] };
      })
    );
  }

  function handleCheckout() {
    alert("Stripe checkout coming soon! After payment you'll fill out info for each camper.");
  }

  const allKidsReady = kids.every(
    (k) => k.name.trim() && k.activityIds.length === getMaxActivities(k.campType.name)
  );

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-500 text-lg">Loading...</p>
      </div>
    );
  }

  const stepList: { key: Step; label: string }[] = [
    { key: "camp", label: "1. Camp & Kids" },
    { key: "activities", label: "2. Activities" },
    { key: "checkout", label: "3. Pay" },
  ];

  // Group activities by type
  const activityByType: Record<string, Activity[]> = {};
  for (const a of activities) {
    if (!activityByType[a.type]) activityByType[a.type] = [];
    activityByType[a.type].push(a);
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header rightText="Registration" />

      <div className="max-w-2xl mx-auto px-6 pt-8">
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

      <div className="max-w-2xl mx-auto px-6 pb-16">
        {/* Step 1: Camp & Kids */}
        {step === "camp" && (
          <div>
            <h1 className="text-3xl font-bold text-[var(--color-primary)] mb-2">
              Choose Your Camp
            </h1>
            <p className="text-gray-500 mb-8">
              Pick how many kids for each program. You can register for both!
            </p>
            <div className="grid gap-4">
              {selections.map((sel, i) => (
                <div
                  key={sel.camp.id}
                  className={`bg-white border-2 rounded-xl p-6 transition-colors ${
                    sel.count > 0 ? "border-[var(--color-accent)]" : "border-gray-200"
                  }`}
                >
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="text-xl font-bold text-gray-900">{sel.camp.name}</h3>
                      <p className="text-gray-500 mt-1">{sel.camp.schedule}</p>
                      <p className="text-gray-400 text-sm mt-1">{sel.camp.description}</p>
                    </div>
                    <div className="text-2xl font-bold text-[var(--color-primary)]">
                      ${(sel.camp.price_cents / 100).toFixed(0)}
                      <span className="text-sm text-gray-400 font-normal">/kid</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-sm text-gray-500">Kids:</span>
                    <button
                      onClick={() => updateCount(i, -1)}
                      className="w-10 h-10 rounded-full bg-gray-100 hover:bg-gray-200 text-lg font-bold text-gray-600 transition-colors flex items-center justify-center"
                    >
                      &minus;
                    </button>
                    <span className="text-2xl font-bold text-[var(--color-primary)] w-8 text-center">
                      {sel.count}
                    </span>
                    <button
                      onClick={() => updateCount(i, 1)}
                      className="w-10 h-10 rounded-full bg-gray-100 hover:bg-gray-200 text-lg font-bold text-gray-600 transition-colors flex items-center justify-center"
                    >
                      +
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {totalKids > 0 && (
              <div className="mt-6 bg-white border border-gray-200 rounded-xl p-4">
                {selections.filter((s) => s.count > 0).map((s) => (
                  <div key={s.camp.id} className="flex justify-between text-gray-600 mb-1">
                    <span>{s.camp.name} &times; {s.count}</span>
                    <span>${((s.camp.price_cents * s.count) / 100).toFixed(0)}</span>
                  </div>
                ))}
                <hr className="my-2" />
                <div className="flex justify-between font-bold text-gray-900">
                  <span>{totalKids} {totalKids === 1 ? "camper" : "campers"}</span>
                  <span>${(totalCents / 100).toFixed(0)}</span>
                </div>
              </div>
            )}

            <button
              onClick={handleContinueToActivities}
              disabled={totalKids === 0}
              className="mt-6 w-full bg-[var(--color-primary)] hover:bg-[var(--color-primary-light)] text-white font-bold text-lg py-4 rounded-full transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            >
              Continue
            </button>
          </div>
        )}

        {/* Step 2: Name each kid + pick activities */}
        {step === "activities" && (
          <div>
            <button
              onClick={() => setStep("camp")}
              className="text-sm text-[var(--color-primary)] mb-4 hover:underline"
            >
              &larr; Back
            </button>
            <h1 className="text-3xl font-bold text-[var(--color-primary)] mb-2">
              Pick Activities
            </h1>
            <p className="text-gray-500 mb-8">
              Name each camper and choose the activities they want to do.
            </p>

            <div className="grid gap-4">
              {kids.map((kid, kidIdx) => {
                const max = getMaxActivities(kid.campType.name);
                const count = kid.activityIds.length;
                const isOpen = openKid === kidIdx;
                const isDone = kid.name.trim() && count === max;
                return (
                <div
                  key={kidIdx}
                  className={`bg-white border-2 rounded-xl overflow-hidden transition-colors ${
                    isDone ? "border-green-300" : isOpen ? "border-[var(--color-accent)]" : "border-gray-200"
                  }`}
                >
                  {/* Toggle header */}
                  <button
                    onClick={() => setOpenKid(isOpen ? -1 : kidIdx)}
                    className="w-full flex items-center justify-between p-5 text-left"
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-full text-white flex items-center justify-center text-sm font-bold shrink-0 ${isDone ? "bg-green-500" : "bg-[var(--color-primary)]"}`}>
                        {isDone ? "✓" : kidIdx + 1}
                      </div>
                      <div>
                        <span className="font-bold text-gray-900">
                          {kid.name || `Camper ${kidIdx + 1}`}
                        </span>
                        <span className="text-sm text-gray-400 ml-2">{kid.campType.name}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-400">{count}/{max} activities</span>
                      <span className={`text-gray-400 transition-transform ${isOpen ? "rotate-180" : ""}`}>
                        &#9662;
                      </span>
                    </div>
                  </button>

                  {isOpen && (
                  <div className="px-5 pb-5">
                  <div className="mb-5">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      First Name
                    </label>
                    <input
                      className="w-full border border-gray-300 rounded-lg px-4 py-3 text-gray-900 focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] focus:border-transparent"
                      placeholder="Enter first name"
                      value={kid.name}
                      onChange={(e) => updateKidName(kidIdx, e.target.value)}
                    />
                  </div>

                  <div>
                    {(() => {
                      const max = getMaxActivities(kid.campType.name);
                      const count = kid.activityIds.length;
                      const isFull = count >= max;
                      return (
                        <>
                          <div className="mb-3">
                            <label className="block text-sm font-bold text-gray-900">
                              Activities — {kid.campType.name} (choose {max})
                            </label>
                            <div className="flex items-center gap-2 mt-1">
                              <div className="flex gap-1">
                                {Array.from({ length: max }).map((_, si) => (
                                  <div
                                    key={si}
                                    className={`w-3 h-3 rounded-full ${si < count ? "bg-[var(--color-accent)]" : "bg-gray-200"}`}
                                  />
                                ))}
                              </div>
                              <span className={`text-xs font-medium ${isFull ? "text-green-600" : "text-gray-400"}`}>
                                {count}/{max} selected{isFull ? " ✓" : ""}
                              </span>
                            </div>
                          </div>

                          {isFull && (
                            <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-3 text-sm text-amber-700">
                              All {max} activities selected. Uncheck one to pick a different activity.
                            </div>
                          )}
                        </>
                      );
                    })()}

                    {Object.entries(activityByType).map(([type, acts]) => {
                      const max = getMaxActivities(kid.campType.name);
                      const isFull = kid.activityIds.length >= max;
                      return (
                      <div key={type} className="mb-4">
                        <div className="flex items-center gap-2 mb-2">
                          <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${TYPE_COLORS[type] || "bg-gray-100 text-gray-600"}`}>
                            {type}
                          </span>
                        </div>
                        <div className="grid gap-1.5">
                          {acts.map((activity) => {
                            const selected = kid.activityIds.includes(activity.id);
                            const disabled = !selected && isFull;
                            return (
                              <label
                                key={activity.id}
                                className={`flex items-start gap-3 px-3 py-2.5 rounded-lg border transition-colors ${
                                  selected
                                    ? "border-[var(--color-accent)] bg-amber-50 cursor-pointer"
                                    : disabled
                                    ? "border-gray-100 opacity-40 cursor-not-allowed"
                                    : "border-gray-100 hover:border-gray-200 cursor-pointer"
                                }`}
                              >
                                <input
                                  type="checkbox"
                                  checked={selected}
                                  disabled={disabled}
                                  onChange={() => toggleActivity(kidIdx, activity.id)}
                                  className="w-4 h-4 mt-0.5 accent-[var(--color-accent)]"
                                />
                                <div>
                                  <span className="font-medium text-gray-900 text-sm">{activity.name}</span>
                                  <p className="text-gray-400 text-xs">{activity.description}</p>
                                </div>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    );
                    })}
                  </div>
                  </div>
                  )}
                </div>
                );
              })}
            </div>

            <button
              onClick={() => setStep("checkout")}
              disabled={!allKidsReady}
              className="mt-8 w-full bg-[var(--color-primary)] hover:bg-[var(--color-primary-light)] text-white font-bold text-lg py-4 rounded-full transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            >
              Continue to Payment
            </button>
          </div>
        )}

        {/* Step 3: Checkout */}
        {step === "checkout" && (
          <div>
            <button
              onClick={() => setStep("activities")}
              className="text-sm text-[var(--color-primary)] mb-4 hover:underline"
            >
              &larr; Back
            </button>
            <h1 className="text-3xl font-bold text-[var(--color-primary)] mb-2">
              Review &amp; Pay
            </h1>
            <div className="bg-white border border-gray-200 rounded-xl p-6 mb-6">
              {kids.map((kid, i) => (
                <div key={i} className="mb-4 last:mb-0">
                  <div className="flex justify-between mb-1">
                    <span className="font-bold text-gray-900">{kid.name || `Camper ${i + 1}`}</span>
                    <span className="font-medium">${(kid.campType.price_cents / 100).toFixed(0)}</span>
                  </div>
                  <p className="text-gray-400 text-sm mb-1">{kid.campType.name}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {kid.activityIds.map((aid) => {
                      const act = activities.find((a) => a.id === aid);
                      return act ? (
                        <span key={aid} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                          {act.name}
                        </span>
                      ) : null;
                    })}
                  </div>
                  {i < kids.length - 1 && <hr className="mt-3" />}
                </div>
              ))}
              <hr className="my-4" />
              <div className="flex justify-between text-lg font-bold">
                <span>Total</span>
                <span>${(totalCents / 100).toFixed(0)}</span>
              </div>
            </div>
            <button
              onClick={handleCheckout}
              className="w-full bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-white font-bold text-lg py-4 rounded-full transition-colors"
            >
              Pay ${(totalCents / 100).toFixed(0)} Now
            </button>
            <p className="text-center text-gray-400 text-sm mt-4">
              After payment, you&apos;ll provide detailed info for each camper.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
