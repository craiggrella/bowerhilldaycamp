import Link from "next/link";
import Header from "@/components/Header";

export default function DayCampPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <Header />

      <div className="max-w-3xl mx-auto px-6 py-16">
        {/* Title block */}
        <div className="text-center mb-10">
          <span className="inline-block text-xs font-bold uppercase tracking-widest px-3 py-1 rounded-full bg-orange-100 text-orange-700 mb-4">
            Full Day
          </span>
          <h1 className="text-4xl md:text-5xl font-bold text-[var(--color-primary)] mb-3">
            Day Camp
          </h1>
          <p className="text-gray-500 text-lg">
            A full day of camp for 3rd, 4th, and 5th graders.
          </p>
        </div>

        {/* Quick facts */}
        <div className="grid sm:grid-cols-3 gap-4 mb-10">
          <div className="bg-white rounded-xl border border-gray-200 p-5 text-center">
            <div className="text-xs uppercase tracking-wide text-gray-400 mb-1">Grades</div>
            <div className="font-bold text-gray-900">3rd – 5th</div>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-5 text-center">
            <div className="text-xs uppercase tracking-wide text-gray-400 mb-1">Hours</div>
            <div className="font-bold text-gray-900">9:30 AM – 3:00 PM</div>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-5 text-center">
            <div className="text-xs uppercase tracking-wide text-gray-400 mb-1">Price</div>
            <div className="font-bold text-gray-900">$75</div>
          </div>
        </div>

        {/* Description */}
        <div className="prose prose-gray max-w-none mb-10 text-gray-700 leading-relaxed">
          <p>
            Day Camp is the full Bower Hill experience — morning activities, lunch
            with friends, and an afternoon of programming. Kids spend the day moving
            between hands-on projects, outdoor games, music, and quiet group time
            with our staff.
          </p>
          <p>
            We keep groups small enough that every kid gets attention, and big enough
            that there&apos;s always someone to laugh with. Snack and lunch are
            included.
          </p>
        </div>

        {/* Morning only callout */}
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 mb-6">
          <h2 className="font-bold text-amber-900 mb-2">Morning only option</h2>
          <p className="text-amber-900 text-sm leading-relaxed">
            We know life gets busy — kids have sports and other commitments, and
            parents juggling Jr Day and Day Campers might not want to make multiple
            pickup trips. That&apos;s why Day Campers can choose to opt out of the
            afternoon session (12–3pm) and wrap up at the same time as Jr Day Camp.
            Even though they&apos;re ending early, the price stays the same — we
            order crafts and supplies for them either way.
          </p>
        </div>

        {/* Helper callout */}
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-5 mb-10">
          <h2 className="font-bold text-blue-900 mb-2">6th grade and up — Helpers</h2>
          <p className="text-blue-900 text-sm leading-relaxed">
            Kids who&apos;ve completed 6th grade or higher join us as helpers,
            supporting our staff in a leadership role with the younger campers.
            Helper rate is <strong>$25</strong>.
          </p>
        </div>

        {/* Where */}
        <div className="bg-white border border-gray-200 rounded-xl p-5 mb-10">
          <h2 className="font-bold text-gray-900 mb-2">Where</h2>
          <p className="text-gray-600 text-sm">
            Bower Hill Community Church<br />
            70 Moffett St, Pittsburgh, PA 15243
          </p>
        </div>

        {/* Register CTA */}
        <div className="text-center">
          <Link
            href="/register"
            className="inline-block bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-white font-bold text-xl px-12 py-5 rounded-full transition-colors shadow-lg"
          >
            Register for Day Camp
          </Link>
        </div>
      </div>
    </div>
  );
}
