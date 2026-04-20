import Link from "next/link";
import Image from "next/image";
import Header from "@/components/Header";

export default function DayCampPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <Header />

      {/* Solid-color hero with title, pill, and quick facts */}
      <div className="w-full bg-[#3b2562] text-white py-12 md:py-16">
        <div className="max-w-3xl mx-auto px-6 text-center">
          <span className="inline-block text-xs font-bold uppercase tracking-widest px-3 py-1 rounded-full bg-white text-purple-700 mb-4">
            Full Day
          </span>
          <h1 className="text-4xl md:text-5xl font-bold mb-3">
            Day Camp
          </h1>
          <p className="text-white/80 text-lg mb-8">
            A full day of camp for 3rd, 4th, and 5th graders.
          </p>
          <div className="grid sm:grid-cols-3 gap-4">
            <div className="bg-white rounded-xl p-5 text-center">
              <div className="text-xs uppercase tracking-wide text-gray-400 mb-1">Grades</div>
              <div className="font-bold text-gray-900">3rd – 5th</div>
            </div>
            <div className="bg-white rounded-xl p-5 text-center">
              <div className="text-xs uppercase tracking-wide text-gray-400 mb-1">Hours</div>
              <div className="font-bold text-gray-900">9:30 AM – 3:00 PM</div>
            </div>
            <div className="bg-white rounded-xl p-5 text-center">
              <div className="text-xs uppercase tracking-wide text-gray-400 mb-1">Price</div>
              <div className="font-bold text-gray-900">$75</div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-6 py-12">
        {/* Photo */}
        <div
          className="relative w-full h-[260px] md:h-[400px] rounded-2xl overflow-hidden mb-10"
          style={{ border: "10px solid #FFB800" }}
        >
          <Image
            src="/images/BHCC Day Camp 00012.png"
            alt="Day Camp kids in action"
            fill
            sizes="(min-width: 768px) 768px, 100vw"
            className="object-cover object-center"
          />
        </div>

        {/* Description */}
        <div className="space-y-6 max-w-none mb-10 text-gray-700 leading-relaxed">
          <p>
            Kids love to help, so we’ve lined up an all-new experience - a
            service-learning track. During the morning, kids will learn about and
            complete mission projects for local non-profit organizations. Kids
            bring-their-own lunch, and then spend the afternoon doing structured
            games, crafts and activities just for them. Cost includes snacks and
            supplies for the daily mission projects. If your child only plans to
            stay for the morning, you can opt out of the afternoon session.
          </p>
        </div>

        {/* Morning only callout */}
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 mb-6">
          <h2 className="font-bold text-amber-900 mb-2">Morning only option</h2>
          <p className="text-amber-900 text-sm leading-relaxed">
            We know life is busy and kids may have other commitments. Day Campers
            can choose to opt out of the afternoon session (12–3pm), but the cost
            remains the same to cover supplies for the daily mission projects.
          </p>
        </div>

        {/* Youth Volunteer callout */}
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-5 mb-10">
          <h2 className="font-bold text-blue-900 mb-2">6th grade and up - Youth Volunteer</h2>
          <p className="text-blue-900 text-sm leading-relaxed">
            Kids who&apos;ve completed 6th grade or higher register as volunteers.
            Youth will be assigned to help in the morning with one of the camp
            tracks and spend the afternoon doing structured games, crafts and
            activities. Volunteers receive a discount for their help.
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
