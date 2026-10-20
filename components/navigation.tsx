"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const PUNKTE = [
  { href: "/", text: "Übersicht", symbol: "◉" },
  { href: "/unterweisungen", text: "Unterweisungen", symbol: "✎" },
  { href: "/mitarbeiter", text: "Mitarbeiter", symbol: "☺" },
  { href: "/themen", text: "Themen", symbol: "☰" },
  { href: "/archiv", text: "Archiv", symbol: "▤" },
];

function aktiv(pfad: string, href: string) {
  return href === "/" ? pfad === "/" : pfad.startsWith(href);
}

export function Navigation() {
  const pfad = usePathname();
  return (
    <>
      {/* Desktop */}
      <nav className="hidden gap-1 md:flex">
        {PUNKTE.map((p) => (
          <Link
            key={p.href}
            href={p.href}
            className={`rounded-md px-3 py-2 text-sm font-medium no-underline hover:no-underline ${
              aktiv(pfad, p.href) ? "bg-white/15 text-white" : "text-marke-100 hover:bg-white/10"
            }`}
          >
            {p.text}
          </Link>
        ))}
      </nav>
      {/* Mobil: Leiste unten */}
      <nav className="fixed inset-x-0 bottom-0 z-20 grid grid-cols-5 border-t border-slate-200 bg-white pb-[env(safe-area-inset-bottom)] md:hidden">
        {PUNKTE.map((p) => (
          <Link
            key={p.href}
            href={p.href}
            className={`flex flex-col items-center gap-0.5 py-2 text-[11px] no-underline hover:no-underline ${
              aktiv(pfad, p.href) ? "font-semibold text-marke-700" : "text-slate-500"
            }`}
          >
            <span aria-hidden className="text-lg leading-none">
              {p.symbol}
            </span>
            {p.text}
          </Link>
        ))}
      </nav>
    </>
  );
}
