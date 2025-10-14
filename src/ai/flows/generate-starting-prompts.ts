'use server';

/**
 * @fileOverview Generates a set of suggested prompts for new users to quickly start interacting with the AI assistant.
 *
 * - generateStartingPrompts - A function that returns a list of suggested prompts.
 * - StartingPromptsOutput - The return type for the generateStartingPrompts function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const StartingPromptsOutputSchema = z.object({
  prompts: z.array(z.string()).describe('Eine Liste von vorgeschlagenen Eingabeaufforderungen.'),
});
export type StartingPromptsOutput = z.infer<typeof StartingPromptsOutputSchema>;

export async function generateStartingPrompts(): Promise<StartingPromptsOutput> {
  return generateStartingPromptsFlow();
}

const prompt = ai.definePrompt({
  name: 'generateStartingPromptsPrompt',
  output: {schema: StartingPromptsOutputSchema},
  prompt: `Sie sind ein KI-Assistent, der Architekturstudenten bei der Analyse und Bewertung ihrer Gebäudeentwürfe (IFC-Modelle) unterstützt. Stellen Sie eine Liste von vorgeschlagenen Eingabeaufforderungen auf Deutsch bereit, die ein neuer Benutzer verwenden kann, um schnell mit der Plattform zu interagieren und ihre Funktionen zu erkunden. Die Eingabeaufforderungen sollten für Nachhaltigkeit, Energieeffizienz, Barrierefreiheit und technische Standards relevant sein. Geben Sie sie als JSON-Array von Zeichenfolgen zurück.

Beispiel-Prompts:
[
  "Was sind die Hauptprobleme der Nachhaltigkeit in meinem Gebäudeentwurf?",
  "Wie kann ich die Energieeffizienz meines Gebäudes verbessern?",
  "Ist mein Gebäudeentwurf für Menschen mit Behinderungen zugänglich?",
  "Erfüllt mein Gebäudeentwurf die relevanten technischen Standards?",
  "Erstelle einen Materialpass für dieses Projekt."
]

Geben Sie die Liste der vorgeschlagenen Eingabeaufforderungen in einem JSON-Array aus:
`,
});

const generateStartingPromptsFlow = ai.defineFlow(
  {
    name: 'generateStartingPromptsFlow',
    outputSchema: StartingPromptsOutputSchema,
  },
  async () => {
    const {output} = await prompt({});
    return output!;
  }
);
