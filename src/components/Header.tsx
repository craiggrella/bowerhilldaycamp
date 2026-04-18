"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";

const links = [
  { href: "/", label: "Home" },
  { href: "/how-it-works", label: "How it Works" },
  { href: "/day-camp", label: "Day Camp" },
  { href: "/jr-day-camp", label: "Jr Day Camp" },
];

export default function Header({ rightText }: { rightText?: string }) {
  const [open, setOpen] = useState(false);

  // Close on Escape + lock page scroll while menu is open
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    if (open) {
      document.addEventListener("keydown", onKey);
      const prev = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.removeEventListener("keydown", onKey);
        document.body.style.overflow = prev;
      };
    }
  }, [open]);

  return (
    <>
      <header className="bg-[#1a0e2e] text-white py-4 px-6 border-b border-white/10 relative z-40 print:hidden">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3 group" onClick={() => setOpen(false)}>
            <Image
              src="/images/WeirdAnimalsLogo_LR.png"
              alt="Weird Animals"
              width={120}
              height={72}
              className="w-28 h-auto"
            />
            <div className="leading-tight">
              <span className="text-xs tracking-[0.2em] uppercase text-white/50 block">
                Bower Hill
              </span>
              <span className="text-sm font-bold text-white group-hover:text-white/80 transition-colors">
                Day Camp &amp; Jr Day Camp
              </span>
            </div>
          </Link>

          <div className="flex items-center gap-4">
            {rightText && (
              <div className="hidden sm:block text-xs text-white/40 uppercase tracking-widest">
                {rightText}
              </div>
            )}
            <button
              type="button"
              aria-label="Open menu"
              aria-expanded={open}
              onClick={() => setOpen(true)}
              className="flex items-center justify-center w-10 h-10 rounded-md border border-white/20 hover:border-white/50 hover:bg-white/5 transition-colors"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <line x1="4" y1="7" x2="20" y2="7" />
                <line x1="4" y1="12" x2="20" y2="12" />
                <line x1="4" y1="17" x2="20" y2="17" />
              </svg>
            </button>
          </div>
        </div>
      </header>

      {/* Full-page menu takeover */}
      {open && (
        <div className="fixed inset-0 z-[60] bg-[#1a0e2e] text-white flex flex-col print:hidden">
          {/* Top bar inside the menu — close button */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
            <span className="text-xs tracking-[0.2em] uppercase text-white/50">Menu</span>
            <button
              type="button"
              aria-label="Close menu"
              onClick={() => setOpen(false)}
              className="flex items-center justify-center w-10 h-10 rounded-md border border-white/20 hover:border-white/50 hover:bg-white/5 transition-colors"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <line x1="5" y1="5" x2="19" y2="19" />
                <line x1="19" y1="5" x2="5" y2="19" />
              </svg>
            </button>
          </div>

          {/* Nav */}
          <nav className="flex-1 overflow-y-auto flex items-center justify-center px-6">
            <ul className="w-full max-w-md flex flex-col gap-2 py-10">
              {links.map((l) => (
                <li key={l.href}>
                  <Link
                    href={l.href}
                    onClick={() => setOpen(false)}
                    className="block text-center text-3xl md:text-4xl font-bold text-white/90 hover:text-white py-4 rounded-xl hover:bg-white/5 transition-colors"
                  >
                    {l.label}
                  </Link>
                </li>
              ))}
              <li className="pt-6">
                <Link
                  href="/register"
                  onClick={() => setOpen(false)}
                  className="block text-center bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-white font-bold text-2xl md:text-3xl py-5 rounded-full transition-colors shadow-lg"
                >
                  Register
                </Link>
              </li>
            </ul>
          </nav>
        </div>
      )}
    </>
  );
}
