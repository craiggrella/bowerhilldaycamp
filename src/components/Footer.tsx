export default function Footer() {
  return (
    <footer className="bg-[#1a0e2e] py-10 px-6 border-t border-white/5 print:hidden">
      <div className="max-w-4xl mx-auto text-center">
        <p className="text-white/20 text-xs">
          &copy; {new Date().getFullYear()}{" "}
          <a
            href="https://www.bowerhillchurch.org/"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-white/40 underline"
          >
            Bower Hill Community Church
          </a>
          . All rights reserved.
        </p>
      </div>
    </footer>
  );
}
