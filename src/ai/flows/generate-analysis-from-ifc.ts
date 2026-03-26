'use server';

/**
 * @fileOverview Nachhaltigkeitsanalyse eines BIM-Modells
 *
 * Hybrid-Ansatz:
 *  1. Deterministische GWP/PENRT/AP-Berechnung via OBD.csv (obdService + sustainabilityCalculator)
 *  2. LLM nur noch für die textliche Zusammenfassung (summary)
 */

import { ai } from '@/ai/genkit';
import { AnalysisResult, AnalysisResultSchema } from '@/lib/types';
import { DEFAULT_MODEL } from '@/ai/models';
import { loadOBDDatabase } from '@/utils/obdService';
import { calculateLCA, type LCAResult } from '@/utils/sustainabilityCalculator';

// ---------------------------------------------------------------------------
// Hilfsfunktion: Rating aus GWP/m² ableiten
// ---------------------------------------------------------------------------
function rateGWP(gwpPerM2: number): 'low' | 'medium' | 'high' {
  // Benchmark QNG / DGNB für Wohngebäude (A1-A3): ca. 8-10 niedrig, 10-14 mittel, >14 hoch
  if (gwpPerM2 < 9) return 'low';
  if (gwpPerM2 < 15) return 'medium';
  return 'high';
}

function ratePENRT(penrtPerM2: number): 'low' | 'medium' | 'high' {
  if (penrtPerM2 < 150) return 'low';
  if (penrtPerM2 < 250) return 'medium';
  return 'high';
}

// ---------------------------------------------------------------------------
// Chart-Farben
// ---------------------------------------------------------------------------
const CHART_COLORS = [
  'hsl(var(--chart-1))',
  'hsl(var(--chart-2))',
  'hsl(var(--chart-3))',
  'hsl(var(--chart-4))',
  'hsl(var(--chart-5))',
];

// ---------------------------------------------------------------------------
// Haupt-Funktion
// ---------------------------------------------------------------------------

export async function generateAnalysisFromIfc(input: {
  ifcFileContent: string;
  model?: string;
  replacementMap?: Record<string, string>;
}): Promise<AnalysisResult> {

  // -----------------------------------------------------------------------
  // 1. Deterministische Berechnung
  // -----------------------------------------------------------------------
  const obdEntries = loadOBDDatabase();
  const lca: LCAResult = calculateLCA(input.ifcFileContent, obdEntries, input.replacementMap);

  console.log('[LCA] GWP total:', lca.gwpTotal, 'kg CO₂-Äq.');
  console.log('[LCA] GWP/m²:', lca.gwpPerM2, 'kg CO₂-Äq./m²');
  console.log('[LCA] BGF:', lca.floorArea, 'm²');
  console.log('[LCA] Unmatched:', lca.unmatchedMaterials);

  // -----------------------------------------------------------------------
  // 2. Indikatoren (fest berechnet, kein LLM)
  // -----------------------------------------------------------------------
  const indicators: AnalysisResult['indicators'] = [
    {
      name: 'Erderwärmungspotenzial (GWP)',
      value: lca.gwpPerM2.toFixed(2),
      unit: 'kg CO₂-Äq./m²',
      a: 'A1-A3',
      rating: rateGWP(lca.gwpPerM2),
    },
    {
      name: 'Primärenergie nicht erneuerbar (PENRT)',
      value: lca.penrtPerM2.toFixed(2),
      unit: 'MJ/m²',
      a: 'A1-A3',
      rating: ratePENRT(lca.penrtPerM2),
    },
    {
      name: 'GWP Gesamt',
      value: lca.gwpTotal.toFixed(0),
      unit: 'kg CO₂-Äq.',
      a: 'A1-A3',
      rating: rateGWP(lca.gwpPerM2),
    },
  ];

  // -----------------------------------------------------------------------
  // 3. Materialzusammensetzung (berechnet)
  // -----------------------------------------------------------------------
  const totalMass = lca.materialBreakdown.reduce((s, m) => s + m.massKg, 0);

  const topMaterials = lca.materialBreakdown.slice(0, 5);
  const otherMass = lca.materialBreakdown.slice(5).reduce((s, m) => s + m.massKg, 0);

  const materialComposition: AnalysisResult['materialComposition'] = topMaterials.map((m, i) => ({
    name: m.name,
    value: totalMass > 0 ? Math.round((m.massKg / totalMass) * 1000) / 10 : 0,
    fill: CHART_COLORS[i % CHART_COLORS.length],
  }));

  if (otherMass > 0 && totalMass > 0) {
    materialComposition.push({
      name: 'Sonstige',
      value: Math.round((otherMass / totalMass) * 1000) / 10,
      fill: 'hsl(var(--chart-5))',
    });
  }

  // -----------------------------------------------------------------------
  // 4. LLM nur für Zusammenfassung (summary)
  // -----------------------------------------------------------------------
  const materialListText = lca.materialBreakdown
    .slice(0, 8)
    .map(m => `- ${m.name}: ${m.massKg.toFixed(0)} kg, GWP: ${m.gwp.toFixed(1)} kg CO₂-Äq.${m.matchedOBD ? ` (OBD: ${m.matchedOBD})` : ' (kein OBD-Match)'}`)
    .join('\n');

  const unmatchedText = lca.unmatchedMaterials.length > 0
    ? `\nNicht zugeordnete Materialien: ${lca.unmatchedMaterials.join(', ')}`
    : '';

  const summaryPrompt = `Sie sind ein Experte für nachhaltiges Bauen und Ökobilanzierung nach EN 15978. Schreiben Sie eine kurze, fachlich korrekte Zusammenfassung (3-5 Sätze) auf Deutsch zu folgender berechneter Ökobilanz eines Gebäudemodells.

**Berechnete Kennzahlen (Modul A1-A3):**
- GWP: ${lca.gwpPerM2.toFixed(2)} kg CO₂-Äq./m² (Gesamt: ${lca.gwpTotal.toFixed(0)} kg CO₂-Äq.)
- PENRT: ${lca.penrtPerM2.toFixed(2)} MJ/m² (Gesamt: ${lca.penrtTotal.toFixed(0)} MJ)
- Geschätzte BGF: ${lca.floorArea.toFixed(0)} m²

**Top-Materialien nach Masse:**
${materialListText}
${unmatchedText}

Bewerten Sie den GWP-Wert im Kontext üblicher Benchmarks (QNG/DGNB: ca. 8-10 kg CO₂-Äq./m² für Wohngebäude ist gut, >14 ist kritisch).
Heben Sie Materialien mit hohem CO₂-Beitrag hervor und nennen Sie konkrete Verbesserungsvorschläge.
Antworten Sie NUR mit dem reinen Zusammenfassungstext, KEIN JSON, KEINE Überschriften.`;

  let summary = '';
  try {
    const completion = await ai.chat.completions.create({
      model: input.model ?? DEFAULT_MODEL,
      messages: [
        { role: 'system', content: 'Sie sind ein Experte für nachhaltiges Bauen. Antworten Sie prägnant und fachlich auf Deutsch.' },
        { role: 'user', content: summaryPrompt },
      ],
    });

    summary = completion.choices[0]?.message?.content?.trim() || '';

    // Falls LLM doch JSON oder Markdown zurückgibt, Text extrahieren
    if (summary.startsWith('{') || summary.startsWith('```')) {
      summary = summary.replace(/```[a-z]*\n?/g, '').replace(/```/g, '').trim();
      try {
        const parsed = JSON.parse(summary);
        summary = parsed.summary || parsed.text || summary;
      } catch {
        // War kein JSON, Text behalten
      }
    }
  } catch (error) {
    console.error('[LCA] LLM summary generation failed:', error);
    summary = `Die Ökobilanz des Gebäudes ergibt ein GWP von ${lca.gwpPerM2.toFixed(2)} kg CO₂-Äq./m² (A1-A3) bei einer geschätzten BGF von ${lca.floorArea.toFixed(0)} m². ` +
      `Insgesamt wurden ${lca.materialBreakdown.length} Materialien analysiert. ` +
      (lca.unmatchedMaterials.length > 0
        ? `${lca.unmatchedMaterials.length} Materialien konnten nicht der Ökobaudat zugeordnet werden.`
        : 'Alle Materialien konnten der Ökobaudat zugeordnet werden.');
  }

  // -----------------------------------------------------------------------
  // 5. Ergebnis zusammensetzen
  // -----------------------------------------------------------------------
  const result: AnalysisResult = {
    summary,
    indicators,
    materialComposition,
  };

  // Validierung über Zod-Schema
  return AnalysisResultSchema.parse(result);
}
