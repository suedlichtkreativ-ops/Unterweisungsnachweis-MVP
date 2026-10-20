import type { Ampel } from "@/lib/faelligkeit";
import type { Pruefstatus, UnterweisungStatus } from "@/lib/typen";
import { PRUEFSTATUS_TEXT, STATUS_TEXT } from "@/lib/texte";

const AMPEL_KLASSE: Record<Ampel, string> = {
  gruen: "bg-emerald-100 text-emerald-900 border-emerald-300",
  gelb: "bg-amber-100 text-amber-900 border-amber-300",
  rot: "bg-red-100 text-red-900 border-red-300",
};
const AMPEL_PUNKT: Record<Ampel, string> = { gruen: "bg-emerald-500", gelb: "bg-amber-400", rot: "bg-red-600" };
export const AMPEL_TEXT: Record<Ampel, string> = { gruen: "aktuell", gelb: "bald fällig", rot: "fällig" };

export function AmpelPunkt({ ampel }: { ampel: Ampel }) {
  return <span aria-hidden className={`inline-block size-2.5 shrink-0 rounded-full ${AMPEL_PUNKT[ampel]}`} />;
}

export function AmpelChip({ ampel, children }: { ampel: Ampel; children: React.ReactNode }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${AMPEL_KLASSE[ampel]}`}>
      <AmpelPunkt ampel={ampel} />
      {children}
    </span>
  );
}

export function PruefAbzeichen({ status }: { status: Pruefstatus }) {
  return status === "geprueft" ? (
    <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-900">
      ✓ {PRUEFSTATUS_TEXT.geprueft}
    </span>
  ) : (
    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-900">
      ⚠ {PRUEFSTATUS_TEXT.nicht_geprueft}
    </span>
  );
}

const STATUS_KLASSE: Record<UnterweisungStatus, string> = {
  geplant: "bg-slate-200 text-slate-800",
  durchgefuehrt: "bg-amber-100 text-amber-900",
  abgeschlossen: "bg-emerald-100 text-emerald-900",
};
export function StatusAbzeichen({ status }: { status: UnterweisungStatus }) {
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_KLASSE[status]}`}>
      {STATUS_TEXT[status]}
    </span>
  );
}
