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
import { aiLanguageLabel, type Language } from '@/lib/i18n';

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
  language?: Language;
}): Promise<AnalysisResult> {
  const language: Language = input.language ?? 'de';

  // -----------------------------------------------------------------------
  // 1. Deterministische Berechnung
  // -----------------------------------------------------------------------
  const obdEntries = loadOBDDatabase();
  // replacementMap wird bereits in compressIfcFile() auf die Materialnamen im erzeugten CSV angewendet.
  // Daher darf es hier nicht nochmal auf die CSV-Materialnamen angewendet werden (sonst droht Doppel-Mapping).
  const lca: LCAResult = calculateLCA(input.ifcFileContent, obdEntries);

  console.log('[LCA] GWP total:', lca.gwpTotal, 'kg CO₂-Äq.');
  console.log('[LCA] GWP/m²:', lca.gwpPerM2, 'kg CO₂-Äq./m²');
  console.log('[LCA] BGF:', lca.floorArea, 'm²');
  console.log('[LCA] Unmatched:', lca.unmatchedMaterials);

  // -----------------------------------------------------------------------
  // 2. Indikatoren (fest berechnet, kein LLM)
  // -----------------------------------------------------------------------
  const indicators: AnalysisResult['indicators'] = [
    {
      name: language === 'en' ? 'Global warming potential (GWP)' : 'Erderwärmungspotenzial (GWP)',
      value: lca.gwpPerM2.toFixed(2),
      unit: 'kg CO₂-Äq./m²',
      a: 'A1-A3',
      rating: rateGWP(lca.gwpPerM2),
    },
    {
      name: language === 'en' ? 'Non-renewable primary energy (PENRT)' : 'Primärenergie nicht erneuerbar (PENRT)',
      value: lca.penrtPerM2.toFixed(2),
      unit: 'MJ/m²',
      a: 'A1-A3',
      rating: ratePENRT(lca.penrtPerM2),
    },
    {
      name: language === 'en' ? 'Total GWP' : 'GWP Gesamt',
      value: lca.gwpTotalAllModules.toFixed(0),
      unit: 'kg CO₂-Äq.',
      a: 'A-D',
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
      name: language === 'en' ? 'Other' : 'Sonstige',
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
    ? (language === 'en'
      ? `\nUnmatched materials: ${lca.unmatchedMaterials.join(', ')}`
      : `\nNicht zugeordnete Materialien: ${lca.unmatchedMaterials.join(', ')}`)
    : '';

  const languageName = aiLanguageLabel(language);
  const summaryPrompt = `You are an expert in sustainable construction and life-cycle assessment according to EN 15978. Write a short and technically correct summary (3-5 sentences) in ${languageName} for the following calculated building LCA.

**Calculated indicators (Module A1-A3):**
- GWP: ${lca.gwpPerM2.toFixed(2)} kg CO₂-Äq./m² (Gesamt: ${lca.gwpTotal.toFixed(0)} kg CO₂-Äq.)
- PENRT: ${lca.penrtPerM2.toFixed(2)} MJ/m² (Gesamt: ${lca.penrtTotal.toFixed(0)} MJ)
- Geschätzte BGF: ${lca.floorArea.toFixed(0)} m²

**Top materials by mass:**
${materialListText}
${unmatchedText}

Assess the GWP value in the context of typical benchmarks (QNG/DGNB: roughly 8-10 kg CO₂-eq./m² for residential buildings is good, >14 is critical).
Highlight materials with high CO₂ impact and provide concrete improvement suggestions.
Return ONLY plain summary text, NO JSON, NO headings.`;

  let summary = '';
  try {
    const completion = await ai.chat.completions.create({
      model: input.model ?? DEFAULT_MODEL,
      messages: [
        { role: 'system', content: `You are an expert in sustainable construction. Reply concisely and technically in ${languageName}.` },
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
    summary = language === 'en'
      ? `The building LCA results in a GWP of ${lca.gwpPerM2.toFixed(2)} kg CO₂-eq./m² (A1-A3) with an estimated gross floor area of ${lca.floorArea.toFixed(0)} m². ` +
        `A total of ${lca.materialBreakdown.length} materials were analyzed. ` +
        (lca.unmatchedMaterials.length > 0
          ? `${lca.unmatchedMaterials.length} materials could not be matched to Ökobaudat.`
          : 'All materials could be matched to Ökobaudat.')
      : `Die Ökobilanz des Gebäudes ergibt ein GWP von ${lca.gwpPerM2.toFixed(2)} kg CO₂-Äq./m² (A1-A3) bei einer geschätzten BGF von ${lca.floorArea.toFixed(0)} m². ` +
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
    materialModuleDetails: lca.materialModuleDetails,
  };

  // Validierung über Zod-Schema
  return AnalysisResultSchema.parse(result);
}
