const ZONE = "Europe/Berlin";

export function datum(iso: string | null | undefined): string {
  if (!iso) return "–";
  const [j, m, t] = iso.slice(0, 10).split("-");
  return `${t}.${m}.${j}`;
}

export function zeitpunkt(iso: string | null | undefined): string {
  if (!iso) return "–";
  return new Intl.DateTimeFormat("de-DE", {
    timeZone: ZONE,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(new Date(iso)) + " Uhr";
}

export function name(m: { vorname: string; nachname: string }): string {
  return `${m.vorname} ${m.nachname}`;
}
