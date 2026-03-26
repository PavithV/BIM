

/**
 * @fileOverview Deterministische LCA-Berechnung (EN 15978)
 *
 * Berechnet GWP, PENRT und AP basierend auf IFC-Mengendaten und
 * Ökobaudat (OBD.csv). Ersetzt die LLM-basierte Schätzung.
 */

import type { OBDEntry } from '@/lib/types';

// ---------------------------------------------------------------------------
// Typen
// ---------------------------------------------------------------------------

/** Einzelnes Element mit Material und Mengen (aus der komprimierten CSV) */
export interface CalcElement {
    type: string;       // z.B. "IfcWall"
    material: string;   // Materialname
    volume: number;     // m³
    area: number;       // m²
}

/** Ergebnis der LCA-Berechnung */
export interface LCAResult {
    gwpTotal: number;          // kg CO₂-Äq.  gesamt
    gwpPerM2: number;          // kg CO₂-Äq.  pro m² BGF
    penrtTotal: number;        // MJ  gesamt (Primärenergie nicht erneuerbar)
    penrtPerM2: number;        // MJ  pro m² BGF
    apTotal: number;           // kg SO₂-Äq.  gesamt
    floorArea: number;         // m² BGF (Näherung aus Slab-Flächen)
    materialBreakdown: MaterialBreakdownEntry[];
    unmatchedMaterials: string[];
}

export interface MaterialBreakdownEntry {
    name: string;
    volumeM3: number;
    massKg: number;
    gwp: number;
    matchedOBD: string | null;
}

// ---------------------------------------------------------------------------
// Fallback-Rohdichten (kg/m³)
// ---------------------------------------------------------------------------
const DENSITY_FALLBACKS: Record<string, number> = {
    beton: 2400,
    stahlbeton: 2500,
    stahl: 7850,
    aluminium: 2700,
    holz: 600,
    mauerwerk: 1500,
    mauerziegel: 1800,
    kalksandstein: 1800,
    ziegel: 1800,
    glas: 2500,
    gipskarton: 900,
    estrich: 2200,
    dämmung: 30,
    dämm: 30,
    eps: 20,
    xps: 35,
    mineralwolle: 60,
    putz: 1800,
    mörtel: 1900,
    kupfer: 8900,
};

/**
 * Sucht eine passende Fallback-Rohdichte basierend auf dem Materialnamen.
 */
function getFallbackDensity(material: string): number {
    const lower = material.toLowerCase();
    for (const [keyword, density] of Object.entries(DENSITY_FALLBACKS)) {
        if (lower.includes(keyword)) return density;
    }
    // Allgemeiner Fallback
    return 2000;
}

// ---------------------------------------------------------------------------
// Material-Matching
// ---------------------------------------------------------------------------

/**
 * Normalisiert einen String für fuzzy Vergleich:
 * Kleinbuchstaben, entfernt Sonderzeichen und Klammern.
 */
function normalize(s: string): string {
    return s
        .toLowerCase()
        .replace(/[®™©]/g, '')
        .replace(/\(.*?\)/g, '')
        .replace(/[^a-zäöüß0-9\s]/g, '')
        .replace(/\s+/g, ' ')
        .trim();
}

/**
 * Findet den besten OBD-Eintrag für ein IFC-Material.
 * Strategie:
 *   1. Exakter Match (normalisiert)
 *   2. Keyword-basiertes Mapping (Suche nach Begriffen wie "Stahlbeton", "Holz")
 *   3. Contains-Match (bevorzugt den kürzesten OBD-Namen für generische Matches wie "Beton")
 */
function matchMaterialToOBD(
    ifcMaterial: string,
    obdEntries: OBDEntry[],
): OBDEntry | null {
    const normIfc = normalize(ifcMaterial);
    if (!normIfc) return null;

    // 1. Exakter Match
    for (const entry of obdEntries) {
        if (normalize(entry.name) === normIfc) return entry;
    }

    // 2. Keyword-Fallback
    // Wenn IFC-Name z.B. "Stahlbeton C30/37" ist, suchen wir "beton"
    const keywordMappings = [
        { kw: 'stahlbeton', search: 'beton' }, // Transportbeton, Normalbeton
        { kw: 'beton', search: 'beton' },
        { kw: 'holz', search: 'vollholz' }, // z.B. Konstruktionsvollholz
        { kw: 'ziegel', search: 'mauerziegel' },
        { kw: 'kalksandstein', search: 'kalksandstein' },
        { kw: 'gipskarton', search: 'gipskarton' },
        { kw: 'mineralwolle', search: 'glaswolle' },
        { kw: 'steinwolle', search: 'steinwolle' },
        { kw: 'glaswolle', search: 'glaswolle' },
        { kw: 'glas', search: 'flachglas' },
        { kw: 'eps', search: 'eps' },
        { kw: 'xps', search: 'xps' },
        { kw: 'putz', search: 'putz' },
        { kw: 'estrich', search: 'estrich' },
        { kw: 'aluminium', search: 'aluminium' },
        { kw: 'alu', search: 'aluminium' },
        { kw: 'kupfer', search: 'kupfer' },
        { kw: 'dämm', search: 'dämm' },
    ];

    let searchString = normIfc;

    for (const { kw, search } of keywordMappings) {
        if (normIfc.includes(kw)) {
            searchString = search;
            break;
        }
    }

    // 3. Contains-Match
    // Wir suchen alle Einträge in der OBD, die den searchString enthalten (oder umgekehrt)
    // und nehmen den KÜRZESTEN OBD-Namen. Ein kurzer Name ist meist ein generisches Material (z.B. "Mauerziegel")
    // anstatt "PAVATEX Holzfaserdämmstoffe im Trockenverfahren 110-200 kg/m3".
    let bestMatch: OBDEntry | null = null;
    let bestLen = Infinity;

    for (const entry of obdEntries) {
        const normObd = normalize(entry.name);
        if (!normObd) continue;

        if (normIfc.includes(normObd) || normObd.includes(searchString)) {
            if (normObd.length < bestLen) {
                bestMatch = entry;
                bestLen = normObd.length;
            }
        }
    }

    return bestMatch;
}

// ---------------------------------------------------------------------------
// GWP-Berechnung pro Element
// ---------------------------------------------------------------------------

function calcElementImpact(
    el: CalcElement,
    obd: OBDEntry,
): { gwp: number; penrt: number; ap: number; massKg: number } {
    const unit = obd.bezugseinheit.toLowerCase().trim();
    const bz = obd.bezugsgroesse || 1;
    const rohdichte = obd.rohdichte ?? getFallbackDensity(el.material);

    let factor = 0;
    let massKg = 0;

    if (unit === 'm3' || unit === 'm³') {
        // Fall A: Bezugseinheit ist m³
        factor = el.volume / bz;
        massKg = el.volume * rohdichte;
    } else if (unit === 'kg') {
        // Fall B: Bezugseinheit ist kg → Volumen × Rohdichte
        massKg = el.volume * rohdichte;
        factor = massKg / bz;
    } else if (unit === 'm2' || unit === 'm²') {
        // Fall C: Bezugseinheit ist m²
        factor = el.area / bz;
        massKg = el.volume * rohdichte;
    } else {
        // Unbekannte Einheit → Versuch über kg
        massKg = el.volume * rohdichte;
        factor = massKg / bz;
    }

    return {
        gwp: factor * obd.gwp,
        penrt: factor * obd.penrt,
        ap: factor * obd.ap,
        massKg,
    };
}

// ---------------------------------------------------------------------------
// Haupt-Berechnung
// ---------------------------------------------------------------------------

/**
 * Parst die komprimierte IFC-CSV (von compressIfcFile) in CalcElements.
 *
 * Format: "Typ;Material;Volumen_m3;Flaeche_m2;Total_CO2;Total_Cost"
 * (Header in Zeile 1, Daten ab Zeile 2)
 */
export function parseCompressedCSV(csvContent: string): CalcElement[] {
    const lines = csvContent.split('\n').filter(l => l.trim().length > 0);
    if (lines.length < 2) return [];

    const header = lines[0].split(';').map(h => h.trim().toLowerCase());
    const typIdx = header.indexOf('typ');
    const matIdx = header.indexOf('material');
    const volIdx = header.indexOf('volumen_m3');
    const areaIdx = header.indexOf('flaeche_m2');

    if (typIdx < 0 || matIdx < 0) {
        console.warn('[sustainabilityCalculator] CSV-Header nicht erkannt:', lines[0]);
        return [];
    }

    const elements: CalcElement[] = [];

    for (let i = 1; i < lines.length; i++) {
        const parts = lines[i].split(';');
        const material = parts[matIdx]?.trim();
        if (!material || material === 'Nicht definiert' || material === 'Unbekannt') continue;

        elements.push({
            type: parts[typIdx]?.trim() || 'Unknown',
            material,
            volume: parseFloat(parts[volIdx] || '0') || 0,
            area: parseFloat(parts[areaIdx] || '0') || 0,
        });
    }

    return elements;
}

/**
 * Führt die deterministische LCA-Berechnung durch.
 *
 * @param compressedCSV - Komprimierte IFC-Daten (CSV von compressIfcFile)
 * @param obdEntries    - Geparste OBD-Einträge (A1-A3)
 * @param replacementMap - Optional: vom Benutzer bestätigte Material-Zuordnungen
 */
export function calculateLCA(
    compressedCSV: string,
    obdEntries: OBDEntry[],
    replacementMap?: Record<string, string>,
): LCAResult {
    const elements = parseCompressedCSV(compressedCSV);

    let gwpTotal = 0;
    let penrtTotal = 0;
    let apTotal = 0;
    let floorArea = 0;

    const materialAgg = new Map<string, MaterialBreakdownEntry>();
    const unmatchedSet = new Set<string>();

    console.log('\n======================================================');
    console.log(' LCA BERECHNUNGSDETAILS (Verwendete Materialien & Werte)');
    console.log('======================================================');

    for (const el of elements) {
        // Materialname ggf. durch User-Mapping ersetzen
        const resolvedMaterial = replacementMap?.[el.material] || el.material;

        // OBD-Match finden
        const obdMatch = matchMaterialToOBD(resolvedMaterial, obdEntries);

        if (!obdMatch) {
            unmatchedSet.add(el.material);
            // Trotzdem Masse schätzen für materialComposition
            const density = getFallbackDensity(el.material);
            const massKg = el.volume * density;
            const existing = materialAgg.get(el.material);
            if (existing) {
                existing.volumeM3 += el.volume;
                existing.massKg += massKg;
            } else {
                materialAgg.set(el.material, {
                    name: el.material,
                    volumeM3: el.volume,
                    massKg,
                    gwp: 0,
                    matchedOBD: null,
                });
            }
            continue;
        }

        const impact = calcElementImpact(el, obdMatch);
        gwpTotal += impact.gwp;
        penrtTotal += impact.penrt;
        apTotal += impact.ap;

        console.log(`[Berechnung] Element: ${el.type} | Material (IFC): '${el.material}'`);
        if (resolvedMaterial !== el.material) {
            console.log(`             Mapping durch Benutzer: -> '${resolvedMaterial}'`);
        }
        console.log(`             Gefundener OBD-Eintrag: '${obdMatch.name}'`);
        console.log(`             OBD-Werte: Einheit=${obdMatch.bezugseinheit}, GWP-Faktor=${obdMatch.gwp}, Rohdichte=${obdMatch.rohdichte ?? 'Fallback (' + getFallbackDensity(el.material) + ')'}`);
        console.log(`             IFC-Mengen: Volume=${el.volume.toFixed(4)}m³, Area=${el.area.toFixed(4)}m² -> Resultierende Masse=${impact.massKg.toFixed(2)}kg`);
        console.log(`             => Berechnetes GWP für dieses Element: ${impact.gwp.toFixed(2)} kg CO₂-Äq.\n`);

        // Materialaggregation
        const key = obdMatch.name;
        const existing = materialAgg.get(key);
        if (existing) {
            existing.volumeM3 += el.volume;
            existing.massKg += impact.massKg;
            existing.gwp += impact.gwp;
        } else {
            materialAgg.set(key, {
                name: el.material,
                volumeM3: el.volume,
                massKg: impact.massKg,
                gwp: impact.gwp,
                matchedOBD: obdMatch.name,
            });
        }

        // Geschossfläche aus Slab-Elementen näherungsweise bestimmen
        const typeLower = el.type.toLowerCase();
        if (typeLower.includes('slab') || typeLower.includes('decke')) {
            floorArea += el.area;
        }
    }

    // Fallback BGF wenn keine Slabs gefunden
    if (floorArea <= 0) {
        // Summiere alle Flächen und teile durch 6 als grobe Approximation
        const totalArea = elements.reduce((sum, el) => sum + el.area, 0);
        floorArea = totalArea > 0 ? totalArea / 6 : 1;
    }

    const gwpPerM2 = floorArea > 0 ? gwpTotal / floorArea : 0;
    const penrtPerM2 = floorArea > 0 ? penrtTotal / floorArea : 0;

    // Nach Masse sortieren (Top-Materialien)
    const breakdown = Array.from(materialAgg.values())
        .sort((a, b) => b.massKg - a.massKg);

    console.log('======================================================');
    console.log('[LCA Zusammenfassung] GWP Gesamt:', Math.round(gwpTotal * 100) / 100, 'kg CO₂-Äq.');
    console.log('[LCA Zusammenfassung] GWP pro m²:', Math.round(gwpPerM2 * 100) / 100);
    console.log('======================================================\n');

    return {
        gwpTotal: Math.round(gwpTotal * 100) / 100,
        gwpPerM2: Math.round(gwpPerM2 * 100) / 100,
        penrtTotal: Math.round(penrtTotal * 100) / 100,
        penrtPerM2: Math.round(penrtPerM2 * 100) / 100,
        apTotal: Math.round(apTotal * 1000) / 1000,
        floorArea: Math.round(floorArea * 100) / 100,
        materialBreakdown: breakdown,
        unmatchedMaterials: Array.from(unmatchedSet),
    };
}
