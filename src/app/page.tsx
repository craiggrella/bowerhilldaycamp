"use client";

import Link from "next/link";
import Image from "next/image";
import { motion } from "framer-motion";

// Real camp photos live in /public/images. Each tile keeps its original
// square/rectangle shape and frame color; the image sits inside a 10px border.
// Images 9, 10, and 11 get the biggest placements.
const galleryImages = [
  { src: "/images/BHCC Day Camp 00009.png", alt: "Kids at camp",        color: "#FF6B35", span: "md:col-span-2 md:row-span-2" }, // big 2x2 top-left
  { src: "/images/BHCC Day Camp 00001.png", alt: "Crafts time",         color: "#4CAF50", span: "" },
  { src: "/images/BHCC Day Camp 00010.png", alt: "Outdoor games",       color: "#7B2D8E", span: "md:row-span-2" },                 // tall right
  { src: "/images/BHCC Day Camp 00002.png", alt: "Group singing",       color: "#E5243B", span: "" },
  { src: "/images/BHCC Day Camp 00003.png", alt: "Science experiments", color: "#00BCD4", span: "" },
  { src: "/images/BHCC Day Camp 00004.png", alt: "Bible stories",       color: "#C41E3A", span: "" },
  { src: "/images/BHCC Day Camp 00011.png", alt: "Water games",         color: "#FFB800", span: "md:col-span-2" },                // wide bottom-right
];

export default function Home() {
  return (
    <div className="bg-[#1a0e2e] text-white overflow-hidden">
      {/* ===================== HERO ===================== */}
      <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
        {/* Animated gradient background */}
        <div className="absolute inset-0 bg-gradient-to-br from-[#1a0e2e] via-[#2a1245] to-[#120a20] animate-gradient" />

        {/* Floating color blobs */}
        {/* Liturgical color blobs — gold, red, green, purple */}
        <div className="absolute top-20 left-10 w-72 h-72 bg-[#FFB800]/15 rounded-full blur-[100px] animate-float" />
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-[#C41E3A]/15 rounded-full blur-[120px] animate-float-delay" />
        <div className="absolute top-1/3 right-1/4 w-64 h-64 bg-[#4CAF50]/10 rounded-full blur-[100px] animate-float-delay-2" />
        <div className="absolute bottom-1/3 left-1/4 w-80 h-80 bg-[#5B2C87]/20 rounded-full blur-[130px] animate-float" />

        {/* Content */}
        <div className="relative z-10 text-center px-6 max-w-4xl">
          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="leading-none mb-8"
          >
            <span className="block text-sm md:text-base font-bold uppercase tracking-[0.3em] bg-gradient-to-r from-[#FFB800] via-[#FF6B35] to-[#E5243B] bg-clip-text text-transparent">
              Bower Hill
            </span>
            <span className="block text-2xl md:text-3xl font-black uppercase tracking-[0.15em] text-white/80 mt-1">
              Day Camp &amp; Jr Day Camp
            </span>
          </motion.h1>

          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="mb-10"
          >
            <Image
              src="/images/WeirdAnimalsLogo_LR.png"
              alt="Weird Animals - Where Jesus' Love Is One-of-a-Kind"
              width={500}
              height={300}
              className="mx-auto w-56 md:w-80 drop-shadow-2xl"
              priority
            />
          </motion.div>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.5 }}
            className="text-white text-2xl md:text-4xl font-bold mb-10 tracking-tight"
          >
            July 27th – 31st, 2026
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.6 }}
            className="flex flex-col sm:flex-row gap-4 justify-center"
          >
            <Link
              href="/register"
              className="inline-block bg-gradient-to-r from-[#FF6B35] to-[#FFB800] text-black font-bold text-lg px-10 py-4 rounded-full transition-all hover:scale-105 animate-pulse-glow"
            >
              Register Now
            </Link>
            <Link
              href="/how-it-works"
              className="inline-block bg-white/5 hover:bg-white/10 backdrop-blur text-white font-bold text-lg px-10 py-4 rounded-full transition-all border border-white/10 hover:border-white/30"
            >
              How It Works
            </Link>
          </motion.div>
        </div>

      </section>

      {/* ===================== SCROLLING TEXT MARQUEE ===================== */}
      <section className="py-6 bg-gradient-to-r from-[#FF6B35] via-[#E5243B] via-[#7B2D8E] via-[#4CAF50] to-[#FFB800] overflow-hidden">
        <div className="flex whitespace-nowrap animate-marquee">
          {Array.from({ length: 10 }).map((_, i) => (
            <span key={i} className="text-white/90 font-black text-lg uppercase tracking-wider mx-8">
              Music &bull; Crafts &bull; Games &bull; Bible &bull; Science &bull; Friends &bull; Adventure &bull; Fun
            </span>
          ))}
        </div>
      </section>

      {/* ===================== PHOTO GRID ===================== */}
      <section className="py-20 px-6 bg-[#1a0e2e]">
        <div className="max-w-6xl mx-auto">
          <motion.h2
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-4xl md:text-6xl font-black text-center mb-4"
          >
            This Is <span className="bg-gradient-to-r from-[#FFB800] to-[#FF6B35] bg-clip-text text-transparent">Camp</span>
          </motion.h2>
          <div className="mb-14" />

          {/* Photo grid — 4 cols, 3 rows */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 auto-rows-[180px]">
            {galleryImages.map((img, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 40 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.08 }}
                className={`relative overflow-hidden rounded-2xl ${img.span} group`}
                style={{ border: `10px solid ${img.color}` }}
              >
                <Image
                  src={img.src}
                  alt={img.alt}
                  fill
                  sizes="(min-width: 768px) 25vw, 50vw"
                  className="object-cover transition-transform duration-500 group-hover:scale-110"
                />
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ===================== PROGRAMS ===================== */}
      <section className="py-20 px-6 bg-[#150b24]">
        <div className="max-w-5xl mx-auto">
          <motion.h2
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-4xl md:text-6xl font-black text-center mb-14"
          >
            Pick Your <span className="bg-gradient-to-r from-[#4CAF50] to-[#00BCD4] bg-clip-text text-transparent">Adventure</span>
          </motion.h2>

          <div className="grid md:grid-cols-2 gap-6">
            {[
              {
                name: "Day Camp",
                sub: "Full Day",
                gradient: "from-[#FF6B35] to-[#E5243B]",
                desc: "The whole experience. All day. All in.",
                href: "/day-camp",
              },
              {
                name: "Jr Day Camp",
                sub: "Half Day",
                gradient: "from-[#4CAF50] to-[#00BCD4]",
                desc: "Same energy. Half the day. Perfect for little ones.",
                href: "/jr-day-camp",
              },
            ].map((camp, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: i === 0 ? -30 : 30 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                whileHover={{ scale: 1.02 }}
              >
                <Link
                  href={camp.href}
                  className="block relative overflow-hidden rounded-3xl p-8 md:p-12 bg-white/5 border border-white/10 hover:border-white/20 transition-all cursor-pointer group h-full"
                >
                  <div className={`absolute top-0 left-0 w-full h-1 bg-gradient-to-r ${camp.gradient}`} />
                  <p className={`text-sm font-bold uppercase tracking-widest bg-gradient-to-r ${camp.gradient} bg-clip-text text-transparent mb-3`}>
                    {camp.sub}
                  </p>
                  <h3 className="text-3xl md:text-4xl font-black text-white mb-3">
                    {camp.name}
                  </h3>
                  <p className="text-white/40 text-lg">{camp.desc}</p>
                  <div className="mt-6">
                    <span className="text-white/30 group-hover:text-white/60 transition-colors text-sm">
                      Learn more &rarr;
                    </span>
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ===================== TESTIMONIAL ===================== */}
      <section className="py-20 px-6 bg-[#1a0e2e] relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-[#FFB800]/5 rounded-full blur-[120px]" />
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="max-w-3xl mx-auto text-center relative z-10"
        >
          <div className="inline-block bg-gradient-to-r from-[#FF6B35] to-[#FFB800] rounded-full px-4 py-1 text-xs font-bold uppercase tracking-widest text-black mb-8">
            From a real parent
          </div>
          <blockquote className="text-2xl md:text-4xl font-bold text-white/90 leading-tight">
            &ldquo;My daughter talked about Day Camp every single day for the rest of the summer.&rdquo;
          </blockquote>
        </motion.div>
      </section>

      {/* ===================== STATS ===================== */}
      <section className="py-16 px-6 bg-[#150b24]">
        <div className="max-w-4xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-8">
          {[
            { number: "150+", label: "Kids", color: "#FF6B35" },
            { number: "50+", label: "Volunteers", color: "#4CAF50" },
            { number: "15+", label: "Years", color: "#7B2D8E" },
            { number: "1", label: "Wild Week", color: "#FFB800" },
          ].map((stat, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className="text-center"
            >
              <div className="text-4xl md:text-6xl font-black" style={{ color: stat.color }}>
                {stat.number}
              </div>
              <div className="text-white/30 text-sm mt-1 uppercase tracking-wider">{stat.label}</div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ===================== FINAL CTA ===================== */}
      <section className="py-24 px-6 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-[#FF6B35] via-[#E5243B] to-[#FFB800] animate-gradient" />
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          className="relative z-10 max-w-3xl mx-auto text-center"
        >
          <h2 className="text-4xl md:text-6xl font-black text-white mb-4">
            Don&apos;t Miss Out
          </h2>
          <p className="text-white/70 text-lg mb-10">
            Spots fill up fast. Lock yours in now.
          </p>
          <Link
            href="/register"
            className="inline-block bg-[#1a0e2e] text-white font-bold text-lg px-14 py-5 rounded-full hover:bg-[#2a1245] transition-all hover:scale-105"
          >
            Register Now
          </Link>
        </motion.div>
      </section>

    </div>
  );
}
