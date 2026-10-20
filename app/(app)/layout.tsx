import { Fusszeile } from "@/components/fusszeile";
import { Navigation } from "@/components/navigation";
import { holeKontext } from "@/lib/kontext";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { betrieb, mitglied } = await holeKontext();
  return (
    <div className="min-h-dvh">
      <header className="bg-marke-900 text-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3">
          <div className="min-w-0">
            <p className="truncate font-semibold">{betrieb.name}</p>
            <p className="truncate text-xs text-marke-100">
              {mitglied.anzeigename} · {mitglied.rolle === "inhaber" ? "Inhaber/in" : "Unterweisende/r"}
            </p>
          </div>
          <Navigation />
          <form action="/auth/abmelden" method="post">
            <button className="rounded-md px-2 py-1 text-xs text-marke-100 hover:bg-white/10">Abmelden</button>
          </form>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-6">{children}</main>
      <Fusszeile />
    </div>
  );
}
