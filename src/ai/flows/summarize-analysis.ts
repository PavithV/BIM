'use server';

/**
 * @fileOverview Provides a summary of the sustainability analysis of a BIM model.
 *
 * - summarizeAnalysis - A function that summarizes the sustainability analysis.
 * - SummarizeAnalysisInput - The input type for the summarizeAnalysis function.
 * - SummarizeAnalysisOutput - The return type for the summarizeAnalysis function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';

const SummarizeAnalysisInputSchema = z.object({
  analysisData: z
    .string()
    .describe(
      'Die Nachhaltigkeitsanalysedaten im JSON-Format, einschließlich GWP, PEnr und Ressourcenverbrauch.'
    ),
});
export type SummarizeAnalysisInput = z.infer<typeof SummarizeAnalysisInputSchema>;

const SummarizeAnalysisOutputSchema = z.object({
  summary: z.string().describe('Eine prägnante Zusammenfassung der Nachhaltigkeitsanalyse.'),
});
export type SummarizeAnalysisOutput = z.infer<typeof SummarizeAnalysisOutputSchema>;

export async function summarizeAnalysis(input: SummarizeAnalysisInput): Promise<SummarizeAnalysisOutput> {
  const prompt = `Sie sind ein erfahrener Nachhaltigkeitsberater. Antworten Sie immer auf Deutsch und im JSON-Format.

  Geben Sie eine prägnante Zusammenfassung der wichtigsten Ergebnisse aus den folgenden Nachhaltigkeitsanalysedaten. Konzentrieren Sie sich auf die kritischsten Verbesserungsbereiche. Die Analyse basiert auf EN 15978.

  Analysedaten: ${input.analysisData}

  Geben Sie die Antwort im folgenden JSON-Format zurück:
  {
    "summary": "Ihre Zusammenfassung hier"
  }`;

  const completion = await ai.chat.completions.create({
    model: "azure.gpt-4.1-mini",
    messages: [
      { role: "system", content: "Sie sind ein erfahrener Nachhaltigkeitsberater. Antworten Sie immer auf Deutsch und im JSON-Format." },
      { role: "user", content: prompt }
    ],
    response_format: { type: "json_object" },
  });

  const content = completion.choices[0].message.content;
  if (!content) {
    throw new Error("Summarize analysis failed to produce an output.");
  }

  // Versuche JSON aus der Antwort zu extrahieren (kann in Markdown-Code-Blöcken sein)
  let parsed: any;
  try {
    // Versuche direkt zu parsen
    parsed = JSON.parse(content);
  } catch (e) {
    // Wenn das fehlschlägt, versuche JSON aus Markdown-Code-Blöcken zu extrahieren
    const jsonMatch = content.match(/```(?:json)?\s*(\{[\s\S]*\})\s*```/) || content.match(/(\{[\s\S]*\})/);
    if (jsonMatch) {
      try {
        parsed = JSON.parse(jsonMatch[1]);
      } catch (parseError) {
        console.error('Failed to parse JSON from response:', content);
        throw new Error(`Ungültiges JSON-Format in der KI-Antwort: ${parseError instanceof Error ? parseError.message : 'Unbekannter Fehler'}`);
      }
    } else {
      console.error('No JSON found in response:', content);
      throw new Error('Kein JSON in der KI-Antwort gefunden');
    }
  }

  const output = SummarizeAnalysisOutputSchema.parse(parsed);
  return output;
}
