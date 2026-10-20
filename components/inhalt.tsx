/**
 * Minimaler, sicherer Markdown-Renderer für Themeninhalte:
 * "## Überschrift", "- Aufzählung", Leerzeile = Absatz. Kein HTML.
 */
export function Inhalt({ text }: { text: string }) {
  const bloecke: React.ReactNode[] = [];
  let liste: string[] = [];
  let absatz: string[] = [];

  const abschliessen = () => {
    if (absatz.length) {
      bloecke.push(<p key={bloecke.length}>{absatz.join(" ")}</p>);
      absatz = [];
    }
    if (liste.length) {
      bloecke.push(
        <ul key={bloecke.length} className="list-disc space-y-1 pl-5">
          {liste.map((l, i) => (
            <li key={i}>{l}</li>
          ))}
        </ul>,
      );
      liste = [];
    }
  };

  for (const roh of text.split("\n")) {
    const zeile = roh.trim();
    if (!zeile) {
      abschliessen();
    } else if (zeile.startsWith("#")) {
      abschliessen();
      bloecke.push(
        <h3 key={bloecke.length} className="pt-2 font-semibold">
          {zeile.replace(/^#+\s*/, "")}
        </h3>,
      );
    } else if (/^[-*]\s+/.test(zeile)) {
      if (absatz.length) abschliessen();
      liste.push(zeile.replace(/^[-*]\s+/, ""));
    } else {
      if (liste.length) abschliessen();
      absatz.push(zeile);
    }
  }
  abschliessen();
  return <div className="space-y-2 text-[15px] leading-relaxed">{bloecke}</div>;
}
