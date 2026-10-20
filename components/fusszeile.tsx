import Link from "next/link";
import { DISCLAIMER_KURZ } from "@/lib/texte";

export function Fusszeile() {
  return (
    <footer className="mx-auto max-w-5xl px-4 pb-28 pt-8 text-xs text-slate-500 md:pb-8">
      <p>
        {DISCLAIMER_KURZ} <Link href="/hinweise">Hinweise, Datenschutz &amp; Löschkonzept</Link>
      </p>
    </footer>
  );
}
