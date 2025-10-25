'use server';

/**
 * @fileOverview Provides a cost estimation based on material composition.
 *
 * - estimateCostsFromMaterials - A function that performs the cost estimation.
 * - MaterialCompositionInput - The input type for the function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { CostEstimationResultSchema } from '@/lib/types';

export const MaterialCompositionInputSchema = z.object({
  materials: z.array(z.object({
    name: z.string(),
    value: z.number().describe('Der prozentuale Anteil des Materials.'),
  })),
  totalBuildingArea: z.number().describe('Die Bruttogeschossfläche (BGF) des Gebäudes in Quadratmetern.')
});

export type MaterialCompositionInput = z.infer<typeof MaterialCompositionInputSchema>;

export async function estimateCostsFromMaterials(input: MaterialCompositionInput): Promise<z.infer<typeof CostEstimationResultSchema>> {
  const { output } = await costEstimationPrompt(input);
  if (!output) {
    throw new Error("Cost estimation failed to produce an output.");
  }
  return output;
}

const costEstimationPrompt = ai.definePrompt({
  name: 'estimateCostsFromMaterialsPrompt',
  input: { schema: MaterialCompositionInputSchema },
  output: { schema: CostEstimationResultSchema },
  prompt: `Sie sind ein Experte für Baukostenkalkulation in Deutschland. Antworten Sie immer auf Deutsch.
  Ihre Aufgabe ist es, eine grobe Kostenschätzung basierend auf der prozentualen Materialzusammensetzung und der Bruttogeschossfläche (BGF) eines Gebäudes zu erstellen. Verwenden Sie durchschnittliche, aktuelle Kostensätze für Deutschland.

  **Eingabedaten:**
  - Materialien: {{{json materials}}}
  - Bruttogeschossfläche (BGF): {{{totalBuildingArea}}} m²

  **Ihre Aufgabe:**
  1.  **Gesamtkosten schätzen:** Berechnen Sie eine grobe Schätzung der Gesamtbaukosten in Euro. Gehen Sie von einem realistischen, durchschnittlichen Preis pro Quadratmeter für ein Standardgebäude in Deutschland aus und passen Sie diesen basierend auf der Materialzusammensetzung an (z.B. ein hoher Stahlanteil könnte die Kosten erhöhen). Runden Sie das Ergebnis auf eine sinnvolle Summe.
  2.  **Kosten pro Material aufschlüsseln:**
      *   Weisen Sie jedem Material in der Eingabeliste seinen geschätzten Kostenanteil an den Gesamtkosten zu.
      *   Geben Sie die geschätzten Kosten für jedes Material als formatierten String an (z.B. "€1.200.000").
      *   Geben Sie für jedes Material eine sehr kurze Erklärung (max. 1 Satz), wie Sie zu der Schätzung gekommen sind (z.B. "Basierend auf einem Anteil von 45% an den Rohbaukosten.").
  3.  **Output-Struktur einhalten:** Geben Sie das Ergebnis exakt im folgenden JSON-Format zurück:
      - \`totalEstimatedCost\`: Die geschätzten Gesamtkosten als String (z.B. "€3.500.000").
      - \`materials\`: Ein Array von Objekten, jedes mit:
          - \`name\`: Name des Materials.
          - \`percentage\`: Der ursprüngliche prozentuale Anteil.
          - \`estimatedCost\`: Die geschätzten Kosten für dieses Material als String.
          - \`explanation\`: Ihre kurze Begründung.

  **Wichtige Hinweise:**
  - Machen Sie deutlich, dass dies eine grobe Schätzung ist.
  - Verwenden Sie realistische, aber allgemeine Zahlen. Es geht um eine erste Orientierung, nicht um eine exakte Kalkulation.
  - Ignorieren Sie Materialien mit dem Namen "Andere", wenn sie in der Liste vorkommen.

  Führen Sie jetzt die Kalkulation durch.
  `,
});
