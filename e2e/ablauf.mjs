// End-to-End-Ablauf im Browser (siehe e2e/README.md)
import { chromium } from "playwright";
import crypto from "node:crypto";
import fs from "node:fs";
import { execSync } from "node:child_process";

const BASE = "http://localhost:3000";
const OUT = process.env.OUT;
fs.mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {});
const mobil = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true,
  userAgent: "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Mobile Safari/537.36" };
let schritt = 0;
const ok = (t) => console.log(`✓ ${++schritt}. ${t}`);
const shot = (page, name) => page.screenshot({ path: `${OUT}/${name}.png`, fullPage: true });
const sha = (b) => crypto.createHash("sha256").update(b).digest("hex");
async function neueSeite(ctxOpts = mobil) {
  const ctx = await browser.newContext({ ...ctxOpts, acceptDownloads: true });
  const page = await ctx.newPage();
  page.on("dialog", (d) => d.accept());
  page.on("pageerror", (e) => console.log("  [pageerror]", e.message));
  return { ctx, page };
}
const erwarte = async (locator, text) => {
  await locator.first().waitFor({ timeout: 15000 }).catch(async () => {
    throw new Error(`Nicht gefunden: ${text ?? locator}`);
  });
};

// ---------------------------------------------------------------- A: Demo-Betrieb
const chef = await neueSeite();
await chef.page.goto(`${BASE}/`);
await chef.page.waitForURL(/\/login/);
await chef.page.fill("input[name=email]", "inhaber@demo.local");
await chef.page.fill("input[name=passwort]", "demo1234");
await chef.page.click("button[type=submit]");
await chef.page.waitForURL(`${BASE}/`);
await erwarte(chef.page.getByRole("heading", { name: "Fälligkeiten" }));
await erwarte(chef.page.getByText("6 Themen sind noch nicht fachlich geprüft"));
await shot(chef.page, "01-uebersicht");
ok("Login Demo-Inhaber, Übersicht mit Ampel");

const ma = await neueSeite();
await ma.page.goto(`${BASE}/u/demo-vorab-dddddddddddddddddddddddd`);
await erwarte(ma.page.getByText("Vorab-Information"));
if (await ma.page.locator("input[name=name]").count()) throw new Error("Vorab-Seite darf kein Unterschriftsfeld zeigen");
await shot(ma.page, "02-vorab-lesen");
ok("Vorab-Link: Inhalt lesbar, keine Unterschrift möglich");

await ma.page.goto(`${BASE}/u/demo-offen-cccccccccccccccccccccccc`);
await erwarte(ma.page.getByRole("heading", { name: "Teilnahme bestätigen" }));
await shot(ma.page, "03-unterschrift-formular");
await ma.page.fill("input[name=name]", "Can Yilmaz");
await ma.page.check("input[name=bestaetigt]");
await ma.page.check("input[name=uebung]");
await ma.page.click("button[type=submit]");
await erwarte(ma.page.getByText("✓ Bestätigt am"));
await ma.page.reload();
await erwarte(ma.page.getByText("✓ Bestätigt am"));
await shot(ma.page, "04-unterschrift-fertig");
ok("Mitarbeiter unterschreibt per Link (Name + Aussage + Übung)");

await ma.page.goto(`${BASE}/u/gibt-es-nicht-1234567890abcdef`);
await erwarte(ma.page.getByText("Link ungültig oder abgelaufen"));
ok("Ungültiger Link wird abgewiesen");

await chef.page.goto(`${BASE}/unterweisungen/55555555-5555-4555-8555-000000000001`);
await erwarte(chef.page.getByText("3/3 bestätigt"));
await shot(chef.page, "05-unterweisung-durchgefuehrt");
await chef.page.getByRole("button", { name: "Abschließen und PDF erzeugen" }).click();
await erwarte(chef.page.getByRole("link", { name: "PDF herunterladen" }), "PDF-Link nach Abschluss");
await shot(chef.page, "06-abgeschlossen");
const pdfHash = (await chef.page.locator("dt:has-text('SHA-256 PDF-Datei') + dd").innerText()).trim();
ok("Abschluss erzeugt Nachweis");

const [dl] = await Promise.all([
  chef.page.waitForEvent("download"),
  chef.page.getByRole("link", { name: "PDF herunterladen" }).click(),
]);
const pdfPfad = `${OUT}/nachweis-demo.pdf`;
await dl.saveAs(pdfPfad);
const pdfBytes = fs.readFileSync(pdfPfad);
if (sha(pdfBytes) !== pdfHash) throw new Error("PDF-Hash stimmt nicht mit DB überein");
if (!dl.suggestedFilename().startsWith("Unterweisung_")) throw new Error("Dateiname: " + dl.suggestedFilename());
ok(`PDF-Download, SHA-256 stimmt (${dl.suggestedFilename()})`);

await chef.page.goto(`${BASE}/archiv`);
await erwarte(chef.page.getByText("1 Nachweise"));
await chef.page.setInputFiles("input[type=file]", pdfPfad);
await erwarte(chef.page.getByText("Unverändert."));
await shot(chef.page, "07-archiv-pruefen");
const manipuliert = Buffer.from(pdfBytes); manipuliert[manipuliert.length - 20] ^= 1;
fs.writeFileSync(`${OUT}/manipuliert.pdf`, manipuliert);
await chef.page.setInputFiles("input[type=file]", `${OUT}/manipuliert.pdf`);
await erwarte(chef.page.getByText("Keine Übereinstimmung"));
ok("Archiv: Prüfung erkennt Original und Manipulation");

const [zipDl] = await Promise.all([
  chef.page.waitForEvent("download"),
  chef.page.getByRole("link", { name: /Export/ }).click(),
]);
await zipDl.saveAs(`${OUT}/export.zip`);
execSync(`rm -rf ${OUT}/export && mkdir -p ${OUT}/export && cd ${OUT}/export && unzip -q ../export.zip && sha256sum -c SHA256SUMS.txt`, { stdio: "inherit" });
const csv = fs.readFileSync(`${OUT}/export/uebersicht.csv`, "utf8");
if (csv.split("\r\n").filter(Boolean).length !== 4) throw new Error("CSV sollte Kopf + 3 Zeilen haben");
ok("ZIP-Export mit PDFs, CSV und gültigen Prüfsummen");

await chef.page.goto(`${BASE}/`);
await erwarte(chef.page.getByText(/Absturzsicherung \/ PSA gegen Absturz: bis/));
await shot(chef.page, "08-uebersicht-nach-abschluss");
ok("Übersicht zeigt neue Fälligkeit (grün)");

// ---------------------------------------------------------------- B: Neuer Betrieb, kompletter Ablauf
const neu = await neueSeite();
await neu.page.goto(`${BASE}/registrieren`);
await neu.page.fill("input[name=email]", "neu@test.local");
await neu.page.fill("input[name=passwort]", "geheim-123");
await neu.page.check("input[name=hinweise]");
await neu.page.click("button[type=submit]");
await neu.page.waitForURL(/\/einrichten/);
await neu.page.fill("input[name=name]", "Dach & Wand Test KG");
await neu.page.fill("input[name=anzeigename]", "Petra Probe");
await neu.page.click("button[type=submit]");
await neu.page.waitForURL(/\/themen\?willkommen=1/);
await shot(neu.page, "09-themen-bibliothek");
ok("Registrierung + Betrieb einrichten");

await neu.page.locator("li", { hasText: "Leitern" }).getByRole("button", { name: "Übernehmen" }).click();
await neu.page.waitForURL(/\/themen\/[0-9a-f-]{36}$/);
await neu.page.fill("textarea[name=inhalt]", "## Leitern\n- Inhalt vom Betrieb (Test)\n- Zweiter Punkt");
await neu.page.getByRole("button", { name: "Speichern" }).click();
await erwarte(neu.page.getByText("Gespeichert."));
await neu.page.fill("input[name=geprueft_von]", "Frau Sicher, Fachkraft für Arbeitssicherheit");
await neu.page.check("input[name=bestaetigt]");
await neu.page.getByRole("button", { name: "Prüfung vermerken" }).click();
await erwarte(neu.page.getByRole("button", { name: "Prüfvermerk zurücknehmen" }));
ok("Thema übernommen, bearbeitet und als geprüft vermerkt");

await neu.page.goto(`${BASE}/mitarbeiter`);
await neu.page.fill("input[name=vorname]", "Lena");
await neu.page.fill("input[name=nachname]", "Lang");
await neu.page.click("button[type=submit]");
await erwarte(neu.page.getByText("Lena Lang wurde angelegt."));
await neu.page.fill("input[name=vorname]", "Tim");
await neu.page.fill("input[name=nachname]", "Jung");
await neu.page.check("input[name=jugendlich]");
await neu.page.click("button[type=submit]");
await erwarte(neu.page.getByText("Tim Jung wurde angelegt."));
ok("Zwei Mitarbeitende angelegt (einer jugendlich)");

await neu.page.goto(`${BASE}/unterweisungen/neu`);
await neu.page.getByRole("link", { name: /Leitern/ }).click();
await erwarte(neu.page.getByRole("heading", { name: "Teilnehmende" }));
await shot(neu.page, "10-planen");
await neu.page.getByRole("button", { name: "Unterweisung anlegen" }).click();
await neu.page.waitForURL(/\/unterweisungen\/[0-9a-f-]{36}$/);
await erwarte(neu.page.getByText("0/2 bestätigt"));
ok("Unterweisung geplant (Fällige vorausgewählt)");

await neu.page.getByRole("button", { name: /Links für alle Offenen erzeugen/ }).click();
const urls = await (async () => {
  await neu.page.locator("input[readonly]").nth(1).waitFor();
  return neu.page.locator("input[readonly]").evaluateAll((els) => els.map((e) => e.value));
})();
if (urls.length !== 2 || !urls.every((u) => /\/u\/[A-Za-z0-9_-]{43}$/.test(u))) throw new Error("Links: " + urls);
await shot(neu.page, "11-links");
ok("Unterschrifts-Links erzeugt");

await neu.page.check("input[name=persoenlich]");
await neu.page.getByRole("button", { name: "Als durchgeführt markieren" }).click();
await erwarte(neu.page.getByRole("heading", { name: "Abschließen und Nachweis erzeugen" }));
ok("Als durchgeführt markiert");

for (const [i, url] of urls.entries()) {
  const m = await neueSeite();
  await m.page.goto(url);
  await erwarte(m.page.getByRole("heading", { name: "Teilnahme bestätigen" }));
  await m.page.fill("input[name=name]", i === 0 ? "Lena Lang" : "Tim Jung");
  await m.page.check("input[name=bestaetigt]");
  await m.page.click("button[type=submit]");
  await erwarte(m.page.getByText("✓ Bestätigt am"));
  await m.ctx.close();
}
ok("Beide unterschreiben über ihren Link");

await neu.page.reload();
await erwarte(neu.page.getByText("2/2 bestätigt"));
await neu.page.getByRole("button", { name: "Abschließen und PDF erzeugen" }).click();
await erwarte(neu.page.getByRole("link", { name: "PDF herunterladen" }));
const id2 = neu.page.url().split("/").pop();
ok("Zweite Unterweisung abgeschlossen");

const [dl2] = await Promise.all([neu.page.waitForEvent("download"), neu.page.getByRole("link", { name: "PDF herunterladen" }).click()]);
await dl2.saveAs(`${OUT}/nachweis-neu.pdf`);

await neu.page.goto(`${BASE}/unterweisungen/neu?nachtrag=${id2}`);
await erwarte(neu.page.getByRole("heading", { name: "Nachtrag anlegen" }));
await neu.page.fill("textarea[name=bemerkung]", "Test: Nachtrag wegen Schreibfehler im Ort");
await neu.page.getByRole("button", { name: "Unterweisung anlegen" }).click();
await neu.page.waitForURL(/\/unterweisungen\/[0-9a-f-]{36}$/);
await erwarte(neu.page.getByText("Nachtrag zu"));
ok("Nachtrag zu abgeschlossener Unterweisung angelegt");

// Mandantentrennung im Browser
await neu.page.goto(`${BASE}/unterweisungen/55555555-5555-4555-8555-000000000001`);
await erwarte(neu.page.getByRole("heading", { name: "Nicht gefunden" }));
await neu.page.goto(`${BASE}/mitarbeiter/33333333-3333-4333-8333-000000000001`);
await erwarte(neu.page.getByRole("heading", { name: "Nicht gefunden" }));
await neu.page.goto(`${BASE}/`);
if (await neu.page.getByText("Anna Becker").count()) throw new Error("Fremde Mitarbeiter sichtbar!");
await shot(neu.page, "12-neuer-betrieb-uebersicht");
ok("Mandantentrennung: fremde Daten nicht erreichbar");

// Desktop-Ansicht
const desk = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const dp = await desk.newPage();
await dp.goto(`${BASE}/login`);
await dp.fill("input[name=email]", "inhaber@demo.local");
await dp.fill("input[name=passwort]", "demo1234");
await dp.click("button[type=submit]");
await dp.waitForURL(`${BASE}/`);
await dp.screenshot({ path: `${OUT}/13-desktop-uebersicht.png`, fullPage: true });
await dp.goto(`${BASE}/unterweisungen/55555555-5555-4555-8555-000000000002`);
await dp.screenshot({ path: `${OUT}/14-desktop-geplant.png`, fullPage: true });
ok("Desktop-Screenshots");

await browser.close();
console.log("\nALLE E2E-SCHRITTE BESTANDEN");
