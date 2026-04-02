import Link from "next/link";
import Image from "next/image";

export default function Header({ rightText }: { rightText?: string }) {
  return (
    <header className="bg-[#1a0e2e] text-white py-4 px-6 border-b border-white/10">
      <div className="max-w-6xl mx-auto flex items-center justify-between">
        <Link href="/" className="flex items-center gap-3 group">
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
        {rightText && (
          <div className="text-xs text-white/40 uppercase tracking-widest">
            {rightText}
          </div>
        )}
      </div>
    </header>
  );
}
