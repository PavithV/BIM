

/**
 * @fileOverview OBD.csv Parser (Ökobaudat)
 *
 * Liest die lokale OBD.csv ein, parst sie korrekt (Semikolon-Trennung,
 * deutsche Dezimalkommas) und filtert auf Modul A1-A3.
 */

import * as fs from 'fs';
import * as path from 'path';
import type { OBDEntry } from '@/lib/types';

// ---------------------------------------------------------------------------
// Singleton-Cache: CSV wird nur einmal gelesen
// ---------------------------------------------------------------------------
let cachedEntries: OBDEntry[] | null = null;

/**
 * Wandelt einen deutschen Dezimal-String ("3,7") in eine Zahl um.
 * Gibt NaN zurück, wenn der Wert nicht parsbar ist.
 */
function parseGermanFloat(raw: string | undefined): number {
    if (!raw || raw.trim() === '') return NaN;
    // Deutsches Komma → Punkt
    return parseFloat(raw.trim().replace(',', '.'));
}

/**
 * Lädt und parst die OBD.csv. Gibt nur Einträge mit Modul === "A1-A3" zurück.
 * Ergebnis wird gecacht, sodass die Datei nur einmal gelesen wird.
 */
export function loadOBDDatabase(): OBDEntry[] {
    if (cachedEntries) return cachedEntries;

    const csvPath = path.join(process.cwd(), 'OBD.csv');

    if (!fs.existsSync(csvPath)) {
        console.warn('[obdService] OBD.csv nicht gefunden unter:', csvPath);
        cachedEntries = [];
        return cachedEntries;
    }

    // Datei einlesen — versuche Windows-1252 über latin1 als Fallback
    let raw: string;
    try {
        raw = fs.readFileSync(csvPath, 'utf8');
    } catch {
        raw = fs.readFileSync(csvPath, 'latin1');
    }

    const lines = raw.split(/\r?\n/).filter(l => l.trim().length > 0);
    if (lines.length < 2) {
        console.warn('[obdService] OBD.csv ist leer oder hat nur einen Header.');
        cachedEntries = [];
        return cachedEntries;
    }

    // Header parsen
    const header = lines[0].split(';').map(h => h.trim());
    const idx = (colName: string): number =>
        header.findIndex(h => h === colName);

    const colName = idx('Name (de)');
    const colBezGroesse = idx('Bezugsgroesse');
    const colBezEinheit = idx('Bezugseinheit');
    const colRohdichte = idx('Rohdichte (kg/m3)');
    const colModul = idx('Modul');
    // Hinweis: In vielen OBD.csv-Dateien sind die Werte für Modul A1-A3 nicht in der Spalte "GWP" befüllt,
    // sondern stattdessen in "GWPtotal (A2)". Daher verwenden wir "GWPtotal (A2)" als primäre Quelle.
    const colGWP = idx('GWP');
    const colGWPtotalA2 = idx('GWPtotal (A2)');
    const colPENRT = idx('PENRT');
    // Gleiches Problem für AP: für A1-A3 stehen Werte häufig in "AP (A2)".
    const colAP = idx('AP');
    const colAP_A2 = idx('AP (A2)');

    // Prüfe ob die wichtigsten Spalten vorhanden sind
    if (colName < 0 || colModul < 0 || (colGWP < 0 && colGWPtotalA2 < 0)) {
        console.error('[obdService] OBD.csv fehlt wichtige Spalten. Header:', header.slice(0, 10));
        cachedEntries = [];
        return cachedEntries;
    }

    const entries: OBDEntry[] = [];

    for (let i = 1; i < lines.length; i++) {
        const parts = lines[i].split(';');

        // Nur Modul A1-A3
        const modul = parts[colModul]?.trim();
        if (modul !== 'A1-A3') continue;

        const name = parts[colName]?.trim();
        if (!name) continue;

        // Preferiere GWP aus "GWPtotal (A2)" falls vorhanden.
        let gwp = parseGermanFloat(parts[colGWP]);
        if (isNaN(gwp) && colGWPtotalA2 >= 0) {
            gwp = parseGermanFloat(parts[colGWPtotalA2]);
        }
        if (isNaN(gwp)) continue; // ohne GWP-Wert nutzlos

        const bezugsgroesse = colBezGroesse >= 0 ? parseGermanFloat(parts[colBezGroesse]) : 1;
        const bezugseinheit = colBezEinheit >= 0 ? (parts[colBezEinheit]?.trim() || 'kg') : 'kg';
        const rohdichteRaw = colRohdichte >= 0 ? parseGermanFloat(parts[colRohdichte]) : NaN;
        const penrt = colPENRT >= 0 ? parseGermanFloat(parts[colPENRT]) : 0;
        let ap = colAP >= 0 ? parseGermanFloat(parts[colAP]) : NaN;
        if ((isNaN(ap) || ap === 0) && colAP_A2 >= 0) {
            // Fallback: Viele Datensätze liefern AP für A1-A3 in "AP (A2)".
            ap = parseGermanFloat(parts[colAP_A2]);
        }
        if (isNaN(ap)) ap = 0;

        entries.push({
            name,
            bezugsgroesse: isNaN(bezugsgroesse) || bezugsgroesse === 0 ? 1 : bezugsgroesse,
            bezugseinheit: bezugseinheit.toLowerCase(),
            rohdichte: isNaN(rohdichteRaw) ? null : rohdichteRaw,
            gwp,
            penrt: isNaN(penrt) ? 0 : penrt,
            ap: isNaN(ap) ? 0 : ap,
        });
    }

    console.log(`[obdService] ${entries.length} OBD-Einträge geladen (Modul A1-A3).`);
    cachedEntries = entries;
    return cachedEntries;
}
