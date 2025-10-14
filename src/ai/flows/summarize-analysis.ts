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
      'The sustainability analysis data in JSON format, including GWP, PEnr, and resource usage.'
    ),
});
export type SummarizeAnalysisInput = z.infer<typeof SummarizeAnalysisInputSchema>;

const SummarizeAnalysisOutputSchema = z.object({
  summary: z.string().describe('A concise summary of the sustainability analysis.'),
});
export type SummarizeAnalysisOutput = z.infer<typeof SummarizeAnalysisOutputSchema>;

export async function summarizeAnalysis(input: SummarizeAnalysisInput): Promise<SummarizeAnalysisOutput> {
  return summarizeAnalysisFlow(input);
}

const prompt = ai.definePrompt({
  name: 'summarizeAnalysisPrompt',
  input: {schema: SummarizeAnalysisInputSchema},
  output: {schema: SummarizeAnalysisOutputSchema},
  prompt: `You are an expert sustainability consultant reviewing the analysis of a BIM model.

  Provide a concise summary of the key findings from the following sustainability analysis data.  Focus on the most critical areas for improvement. The analysis is based on EN 15978.

  Analysis Data: {{{analysisData}}}
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
