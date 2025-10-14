'use server';

/**
 * @fileOverview Provides a summary of the sustainability analysis of a BIM model.
 *
 * - summarizeAnalysis - A function that summarizes the sustainability analysis.
 * - SummarizeAnalysisInput - The input type for the summarizeAnalysis function.
 * - SummarizeAnalysisOutput - The return type for the summarizeAnalysis function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

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
  return summarizeAnalysisFlow(input);
}

const prompt = ai.definePrompt({
  name: 'summarizeAnalysisPrompt',
  input: {schema: SummarizeAnalysisInputSchema},
  output: {schema: SummarizeAnalysisOutputSchema},
  prompt: `Sie sind ein erfahrener Nachhaltigkeitsberater, der die Analyse eines BIM-Modells überprüft. Antworten Sie immer auf Deutsch.

  Geben Sie eine prägnante Zusammenfassung der wichtigsten Ergebnisse aus den folgenden Nachhaltigkeitsanalysedaten. Konzentrieren Sie sich auf die kritischsten Verbesserungsbereiche. Die Analyse basiert auf EN 15978.

  Analysedaten: {{{analysisData}}}
  `,
});

const summarizeAnalysisFlow = ai.defineFlow(
  {
    name: 'summarizeAnalysisFlow',
    inputSchema: SummarizeAnalysisInputSchema,
    outputSchema: SummarizeAnalysisOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
