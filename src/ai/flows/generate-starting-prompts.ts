'use server';

/**
 * @fileOverview Generates a set of suggested prompts for new users to quickly start interacting with the AI assistant.
 *
 * - generateStartingPrompts - A function that returns a list of suggested prompts.
 * - StartingPromptsOutput - The return type for the generateStartingPrompts function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import { DEFAULT_MODEL } from '@/ai/models';
import { aiLanguageLabel, type Language } from '@/lib/i18n';

const StartingPromptsOutputSchema = z.object({
  prompts: z.array(z.string()).describe('Eine Liste von vorgeschlagenen Eingabeaufforderungen.'),
});
export type StartingPromptsOutput = z.infer<typeof StartingPromptsOutputSchema>;

export async function generateStartingPrompts(options?: { model?: string; language?: Language }): Promise<StartingPromptsOutput> {
  const language: Language = options?.language ?? 'de';
  const languageName = aiLanguageLabel(language);
  const prompt = `You are an AI assistant for architecture students. Always answer in ${languageName} and JSON format.

You help architecture students analyze and evaluate IFC building designs. Provide a list of suggested prompts in ${languageName} that a new user can use to quickly explore the platform features. Prompts should be relevant to sustainability, energy efficiency, accessibility, and technical standards. Return a JSON array of strings.

Beispiel-Prompts:
[
  "Was sind die Hauptprobleme der Nachhaltigkeit in meinem Gebäudeentwurf?",
  "Wie kann ich die Energieeffizienz meines Gebäudes verbessern?",
  "Ist mein Gebäudeentwurf für Menschen mit Behinderungen zugänglich?",
  "Erfüllt mein Gebäudeentwurf die relevanten technischen Standards?",
  "Erstelle einen Materialpass für dieses Projekt."
]

Return the list in this JSON format:
{
  "prompts": ["...", "...", "..."]
}`;

  const completion = await ai.chat.completions.create({
    model: options?.model ?? DEFAULT_MODEL,
    messages: [
      { role: "system", content: `You are an AI assistant for architecture students. Always respond in ${languageName} and JSON format.` },
      { role: "user", content: prompt }
    ],
    response_format: { type: "json_object" },
  });

  const content = completion.choices[0].message.content;
  if (!content) {
    throw new Error("Generate starting prompts failed to produce an output.");
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

  const output = StartingPromptsOutputSchema.parse(parsed);
  return output;
}
