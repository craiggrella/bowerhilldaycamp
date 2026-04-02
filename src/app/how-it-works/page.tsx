import Link from "next/link";
import Header from "@/components/Header";

const steps = [
  {
    number: "1",
    color: "#FF6B35",
    emoji: "🏕️",
    title: "Choose Your Camp",
    description:
      "Day Camp (full day of adventure) or Jr Day Camp (half day for the little ones). Both are packed with fun! Tell us how many campers you're registering and complete your payment securely. Easy peasy.",
  },
  {
    number: "2",
    color: "#4CAF50",
    emoji: "🎨",
    title: "Choose Your Activity Tracts",
    description:
      "Select from awesome activity tracts throughout the day — arts & crafts, sports, music, nature, and more. Make it your own!",
  },
  {
    number: "3",
    color: "#7B2D8E",
    emoji: "📋",
    title: "Contact & Emergency Info",
    description:
      "Fill out the important stuff — parent info, emergency contacts, medical details, and waivers. We keep your kids safe!",
  },
];

export default function HowItWorksPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <Header />

      <div className="max-w-3xl mx-auto px-6 py-16">
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
            className="inline-block bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-white font-bold text-xl px-12 py-5 rounded-full transition-colors shadow-lg"
          >
            Let&apos;s Go — Register Now
          </Link>
        </div>
      </div>
    </div>
  );
}
