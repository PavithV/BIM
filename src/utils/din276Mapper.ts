/**
 * @fileOverview DIN 276 Kostengruppen-Zuordnung und Mengen-Aggregation
 *
 * Ordnet IFC-Bauteile (CompactElement) automatisiert den DIN 276
 * Kostengruppen zu und aggregiert Mengen (Flächen, Volumina, Längen).
 */

import type { CompactElement } from './ifcParser';

// ─── DIN 276 Kostengruppen-Definitionen ─────────────────────────────────────

/** Bezeichnung der DIN 276 Kostengruppen (2. Ebene) */
export const DIN276_LABELS: Record<string, string> = {
    '310': 'Baugrube / Erdbau',
    '320': 'Gründung',
    '330': 'Außenwände',
    '334': 'Außentüren und -fenster',
    '340': 'Innenwände',
    '344': 'Innentüren und -fenster',
    '350': 'Decken',
    '360': 'Dächer',
    '370': 'Infrastrukturanlagen',
    '380': 'Baukonstruktive Einbauten',
    '390': 'Sonstige Maßnahmen',
};

import { BKI_COSTS } from '../lib/bki-data';

/** Aggregiertes Ergebnis für eine Kostengruppe */
export interface Din276CostGroupResult {
    kg: string;
    label: string;
    totalArea: number;
    totalVolume: number;
    totalLength: number;
    elementCount: number;
    elements: CompactElement[];
    // Neue Felder für BKI-Kosten
    totalCost: number;
    unitPrice: number;
    unit: string;
}

/** Gesamtergebnis der DIN 276 Mengenauswertung */
export interface Din276QuantityResult {
    groups: Din276CostGroupResult[];
    totalArea: number;
    totalVolume: number;
    totalCost: number; // Neu
}

// ─── Heuristik-Hilfsfunktionen ──────────────────────────────────────────────

const EXTERNAL_KEYWORDS = [
    'außen', 'aussen', 'extern', 'exterior', 'external', 'fassade', 'facade',
];
const FOUNDATION_KEYWORDS = [
    'fundament', 'bodenplatte', 'foundation', 'gründung', 'gruendung',
    'sohle', 'kellerdecke',
];

/**
 * Prüft ob ein Element als "extern" gilt.
 * Nutzt zuerst `properties.IsExternal`, dann Namens-Heuristik.
 */
function isExternal(el: CompactElement): boolean {
    // 1. Explizite Property (am zuverlässigsten)
    const isExt = el.properties?.IsExternal ?? el.properties?.isExternal;
    if (isExt === true || isExt === 'TRUE' || isExt === '.T.') return true;
    if (isExt === false || isExt === 'FALSE' || isExt === '.F.') return false;

    // 2. Namens-/Property-Heuristik
    const searchText = `${el.name ?? ''} ${el.material ?? ''}`.toLowerCase();
    return EXTERNAL_KEYWORDS.some((kw) => searchText.includes(kw));
}

/**
 * Prüft ob eine Decke/Platte als Gründung/Fundament gilt.
 */
function isFoundation(el: CompactElement): boolean {
    const searchText = `${el.name ?? ''}`.toLowerCase();
    return FOUNDATION_KEYWORDS.some((kw) => searchText.includes(kw));
}

// ─── Zuordnung ──────────────────────────────────────────────────────────────

/**
 * Ordnet jedem Element eine DIN 276 Kostengruppe zu.
 * Gibt ein neues Array zurück (mutiert nicht).
 */
export function assignDIN276CostGroups(
    elements: CompactElement[],
): CompactElement[] {
    return elements.map((el) => {
        const kg = mapElementToKG(el);
        if (!kg) return el; // Nicht zuordenbar → unverändert
        return { ...el, din276_kg: kg };
    });
}

/**
 * Heuristik: bestimmt KG für ein einzelnes Element.
 * Gibt `undefined` zurück wenn der Typ nicht zugeordnet werden kann.
 */
function mapElementToKG(el: CompactElement): string | undefined {
    const type = (el.type ?? '').toUpperCase();
    const searchText = `${el.name ?? ''} ${el.material ?? ''}`.toLowerCase();

    switch (true) {
        // ── Wände ──
        case type === 'IFCWALL' || type === 'IFCWALLSTANDARDCASE':
            return isExternal(el) ? '330' : '340';

        // ── Decken / Bodenplatten ──
        case type === 'IFCSLAB' || type === 'IFCPLATE':
            return isFoundation(el) ? '320' : '350';

        // ── Dach ──
        case type === 'IFCROOF':
            return '360';

        // ── Fundamente ──
        case type === 'IFCFOOTING':
            return '320';

        // ── Fenster & Türen ──
        case type === 'IFCWINDOW' || type === 'IFCDOOR':
            return isExternal(el) ? '334' : '344';

        // ── Stützen ──
        case type === 'IFCCOLUMN' || type === 'IFCMEMBER':
            return isExternal(el) ? '330' : '340';

        // ── Träger / Balken / Unterzüge (Fachliche Korrektur) ──
        case type === 'IFCBEAM':
            if (searchText.includes('dach') || searchText.includes('roof') || searchText.includes('sparren')) return '360';
            return '350'; // Meistens Unterzüge unter Decken

        // ── Treppen / Rampen (Fachliche Korrektur auf KG 350) ──
        case type === 'IFCSTAIR' || type === 'IFCRAMP':
            return '350';

        // ── Geländer ──
        case type === 'IFCRAILING':
            return '390'; // Sonstige Maßnahmen (oft separat ausgeschrieben)

        // ── Verkleidungen / Beläge (Verfeinert) ──
        case type === 'IFCCOVERING':
            if (searchText.includes('dach') || searchText.includes('roof')) return '360';
            if (searchText.includes('fassade') || searchText.includes('facade') || searchText.includes('wdvs')) return '330';
            if (searchText.includes('boden') || searchText.includes('floor') || searchText.includes('estrich')) return '350';
            if (searchText.includes('wand') || searchText.includes('wall') || searchText.includes('putz')) return isExternal(el) ? '330' : '340';
            if (searchText.includes('decke') || searchText.includes('ceiling')) return '350';
            return '370';

        // ── Generische Elemente (Fallback-Heuristik) ──
        case type === 'IFCBUILDINGELEMENTPROXY':
            if (searchText.includes('wand') || searchText.includes('wall')) return isExternal(el) ? '330' : '340';
            if (searchText.includes('decke') || searchText.includes('slab') || searchText.includes('boden')) return '350';
            if (searchText.includes('dach') || searchText.includes('roof')) return '360';
            if (searchText.includes('fundament') || searchText.includes('footing')) return '320';
            if (searchText.includes('fenster') || searchText.includes('window')) return isExternal(el) ? '334' : '344';
            if (searchText.includes('tür') || searchText.includes('door') || searchText.includes('tuer')) return isExternal(el) ? '334' : '344';
            if (searchText.includes('stütze') || searchText.includes('column') || searchText.includes('stuetze')) return isExternal(el) ? '330' : '340';
            if (searchText.includes('träger') || searchText.includes('beam') || searchText.includes('unterzug')) return '350';
            if (searchText.includes('treppe') || searchText.includes('stair')) return '350';
            return undefined;

        default:
            return undefined;
    }
}

// ─── Aggregation ────────────────────────────────────────────────────────────

/**
 * Aggregiert Mengen (Fläche, Volumen, Länge) pro Kostengruppe.
 */
export function calculateDIN276Quantities(
    elements: CompactElement[],
): Din276QuantityResult {
    const groupMap = new Map<string, Din276CostGroupResult>();

    for (const el of elements) {
        const kg = el.din276_kg;
        if (!kg) continue;

        let group = groupMap.get(kg);
        if (!group) {
            const bkiData = BKI_COSTS[kg] || { pricePerUnit: 0, unit: 'm2' };
            group = {
                kg,
                label: DIN276_LABELS[kg] ?? `KG ${kg}`,
                totalArea: 0,
                totalVolume: 0,
                totalLength: 0,
                elementCount: 0,
                elements: [],
                totalCost: 0,
                unitPrice: bkiData.pricePerUnit,
                unit: bkiData.unit,
            };
            groupMap.set(kg, group);
        }

        group.totalArea += el.quantities?.area ?? 0;
        group.totalVolume += el.quantities?.volume ?? 0;
        group.totalLength += el.quantities?.length ?? 0;
        group.elementCount += 1;
        group.elements.push(el);
    }

    // Berechne Kosten für alle Gruppen
    for (const group of groupMap.values()) {
        if (group.unit === 'm3') {
            group.totalCost = group.totalVolume * group.unitPrice;
        } else if (group.unit === 'm2') {
            group.totalCost = group.totalArea * group.unitPrice;
        }
    }

    // Sortiere nach KG-Nummer
    const groups = Array.from(groupMap.values()).sort(
        (a, b) => parseInt(a.kg, 10) - parseInt(b.kg, 10),
    );

    const totalArea = groups.reduce((s, g) => s + g.totalArea, 0);
    const totalVolume = groups.reduce((s, g) => s + g.totalVolume, 0);
    const totalCost = groups.reduce((s, g) => s + g.totalCost, 0);

    return { groups, totalArea, totalVolume, totalCost };
}
