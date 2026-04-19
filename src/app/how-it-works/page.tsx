import Link from "next/link";
import Header from "@/components/Header";

const steps = [
  {
    number: "1",
    color: "#FF6B35",
    emoji: "🧭",
    title: "Choose Your Camp",
    description:
      "There are two different tracks, based on the child\u2019s completed grade. Jr. Day Camp, for preK (potty-trained) through 2nd grade runs daily from 9:30 a.m. until noon. Day Camp, for 3rd-5th grade, runs daily from 9:30 a.m. \u2013 3 p.m. Both are packed with fun! Older youth in grades 6th and up register as Day Camp helpers and will be assigned to one of the above tracks. Tell us how many campers you're registering and complete your payment securely. Easy peasy.",
  },
  {
    number: "2",
    color: "#4CAF50",
    emoji: "🕒",
    title: "Flexible Options",
    description:
      "We know life is busy and kids may have other commitments. Day Campers can choose to opt out of the afternoon session (12\u20133pm) and wrap up at the same time as Jr Day Camp.",
  },
  {
    number: "3",
    color: "#7B2D8E",
    emoji: "📋",
    title: "Contact & Emergency Info",
    description:
      "You\u2019ll also be asked to complete the important stuff - parent info, emergency contacts, and allergy information all on line. We value keeping your kids safe!",
  },
  {
    number: "4",
    color: "#1E88E5",
    emoji: "📬",
    title: "Check Your Inbox",
    description:
      "You'll get 1 confirmation email with all the info you need \u2014 a payment receipt and all the camp details: where to go, when to drop off, and a recap of all the camper info you submitted.",
  },
];

export default function HowItWorksPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <Header />

      <div className="max-w-3xl mx-auto px-6 pt-16 pb-56">
        <h1 className="text-4xl md:text-5xl font-bold text-center text-[var(--color-primary)] mb-4">
          How It Works
        </h1>
        <p className="text-center text-gray-500 text-lg mb-16">
          Getting registered is easy — here&apos;s the game plan.
        </p>

        <div className="relative">
          {/* Vertical line connecting steps */}
          <div className="absolute left-8 md:left-12 top-0 bottom-0 w-1 bg-gray-200 hidden md:block" />

          <div className="grid gap-12">
            {steps.map((step, i) => (
              <div key={i} className="relative flex gap-6 md:gap-8 items-start">
                {/* Step circle */}
                <div
                  className="relative z-10 flex-shrink-0 w-16 h-16 md:w-24 md:h-24 rounded-full flex flex-col items-center justify-center text-white font-bold shadow-lg"
                  style={{ backgroundColor: step.color }}
                >
                  <span className="text-2xl md:text-4xl leading-none">{step.emoji}</span>
                </div>

                {/* Content card */}
                <div className="flex-1 bg-white rounded-2xl p-6 md:p-8 shadow-sm border border-gray-100">
                  <div className="flex items-center gap-3 mb-2">
                    <span
                      className="text-sm font-bold px-3 py-1 rounded-full text-white"
                      style={{ backgroundColor: step.color }}
                    >
                      Step {step.number}
                    </span>
                  </div>
                  <h2 className="text-2xl md:text-3xl font-bold text-gray-900 mb-2">
                    {step.title}
                  </h2>
                  <p className="text-gray-500 text-lg leading-relaxed">
                    {step.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="text-center mt-16">
          <Link
            href="/register"
            className="inline-block bg-[#DC2626] hover:bg-[#B91C1C] text-white font-bold text-xl px-12 py-5 rounded-full transition-colors shadow-lg"
          >
            Let&apos;s Go — Register Now
          </Link>
        </div>
      </div>
    </div>
  );
}
