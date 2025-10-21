'use server';

/**
 * @fileOverview Provides a sustainability analysis of a BIM model from its IFC data.
 *
 * - generateAnalysisFromIfc - A function that performs the analysis.
 * - GenerateAnalysisFromIfcInput - The input type for the function.
 */

import { ai } from '@/ai/genkit';
import { GenerateAnalysisFromIfcInputSchema, AnalysisResult, AnalysisResultSchema } from '@/lib/types';


export async function generateAnalysisFromIfc(input: { ifcFileContent: string }): Promise<AnalysisResult> {
  const { output } = await analysisPrompt(input);
  if (!output) {
    throw new Error("Analysis failed to produce an output.");
  }
  return output;
}

const analysisPrompt = ai.definePrompt({
  name: 'generateAnalysisFromIfcPrompt',
  input: { schema: GenerateAnalysisFromIfcInputSchema },
  output: { schema: AnalysisResultSchema },
  prompt: `Sie sind ein Experte für nachhaltiges Bauen und analysieren IFC-Modelldaten. Antworten Sie immer auf Deutsch.
  Analysieren Sie den folgenden Inhalt der IFC-Datei und geben Sie eine Nachhaltigkeitsanalyse zurück.

  Die Analyse sollte Folgendes umfassen:
  1.  **summary**: Eine prägnante textliche Zusammenfassung der wichtigsten Nachhaltigkeitsaspekte des Gebäudes. Heben Sie kritische Punkte und Verbesserungspotenziale hervor.
  2.  **indicators**: Eine Liste von 3 Schlüsselindikatoren basierend auf EN 15978. Jeder Indikator sollte haben:
      *   'name': Name des Indikators (z. B. 'Erderwärmungspotenzial (GWP)').
      *   'value': Ein geschätzter numerischer Wert als String.
      *   'unit': Die Einheit (z. B. 'kg CO₂-Äq/m²').
      *   'a': Die betrachtete Phase (z. B. 'A1-A3').
      *   'rating': Eine Bewertung ('low', 'medium', 'high'), wobei 'high' ein Problembereich ist.
  3.  **materialComposition**: Eine Liste der 5 wichtigsten Materialien nach Massenanteil (geschätzt). Jedes Material sollte haben:
      *   'name': Der Name des Materials (z. B. 'Beton').
      *   'value': Der prozentuale Anteil als Zahl.
      *   'fill': Ein zugewiesener Farbwert in HSL (z. B. 'hsl(var(--chart-1))'). Verwenden Sie die Chart-Farben --chart-1 bis --chart-5.

  IFC-Dateiinhalt:
  {{{ifcFileContent}}}
  `,
});
