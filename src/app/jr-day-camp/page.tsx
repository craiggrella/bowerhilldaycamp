import Link from "next/link";
import Header from "@/components/Header";

export default function JrDayCampPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <Header />

      <div className="max-w-3xl mx-auto px-6 py-16">
        {/* Title block */}
        <div className="text-center mb-10">
          <span className="inline-block text-xs font-bold uppercase tracking-widest px-3 py-1 rounded-full bg-green-100 text-green-700 mb-4">
            Half Day
          </span>
          <h1 className="text-4xl md:text-5xl font-bold text-[var(--color-primary)] mb-3">
            Jr Day Camp
          </h1>
          <p className="text-gray-500 text-lg">
            A gentle half-day for our youngest campers — preschool through 2nd grade.
          </p>
        </div>

        {/* Quick facts */}
        <div className="grid sm:grid-cols-3 gap-4 mb-10">
          <div className="bg-white rounded-xl border border-gray-200 p-5 text-center">
            <div className="text-xs uppercase tracking-wide text-gray-400 mb-1">Grades</div>
            <div className="font-bold text-gray-900">PreK – 2nd</div>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-5 text-center">
            <div className="text-xs uppercase tracking-wide text-gray-400 mb-1">Hours</div>
            <div className="font-bold text-gray-900">9:30 AM – 12:00 PM</div>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-5 text-center">
            <div className="text-xs uppercase tracking-wide text-gray-400 mb-1">Price</div>
            <div className="font-bold text-gray-900">$25</div>
          </div>
        </div>

        {/* Description */}
        <div className="prose prose-gray max-w-none mb-10 text-gray-700 leading-relaxed">
          <p>
            Jr Day Camp is a perfect first taste of camp — half-day, low-key, and
            packed with the things little kids love: crafts, songs, simple games,
            and snack time with new friends.
          </p>
          <p>
            Our staff gives the youngest campers extra attention and keeps the pace
            comfortable. Drop-off and pickup happen at the same place, and the
            morning ends in time for lunch at home.
          </p>
        </div>

        {/* Potty trained note */}
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 mb-10">
          <h2 className="font-bold text-amber-900 mb-2">A quick note for parents</h2>
          <p className="text-amber-900 text-sm leading-relaxed">
            Jr Day Campers need to be fully potty trained. Our staff isn&apos;t able
            to assist with diaper changes or bathroom accidents, so please make sure
            your camper is comfortable using the bathroom independently before
            registering.
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
            Register for Jr Day Camp
          </Link>
        </div>
      </div>
    </div>
  );
}
