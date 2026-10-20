import { Fusszeile } from "@/components/fusszeile";
import { APP_NAME } from "@/lib/texte";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh">
      <main className="mx-auto max-w-md px-4 pt-12">
        <p className="mb-6 text-center text-sm font-semibold uppercase tracking-wider text-marke-700">{APP_NAME}</p>
        <div className="karte p-6">{children}</div>
      </main>
      <Fusszeile />
    </div>
  );
}
