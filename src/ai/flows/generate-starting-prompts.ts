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
  prompts: z.array(z.string()).describe('A list of suggested prompts.'),
});
export type StartingPromptsOutput = z.infer<typeof StartingPromptsOutputSchema>;

export async function generateStartingPrompts(): Promise<StartingPromptsOutput> {
  return generateStartingPromptsFlow();
}

const prompt = ai.definePrompt({
  name: 'generateStartingPromptsPrompt',
  output: {schema: StartingPromptsOutputSchema},
  prompt: `You are an AI assistant designed to help architecture students analyze and evaluate their building designs (IFC models). Provide a list of suggested prompts that a new user can use to quickly start interacting with the platform and exploring its capabilities. The prompts should be relevant to sustainability, energy efficiency, accessibility, and technical standards. Return them as a JSON array of strings.

Example Prompts:
[
  "What are the main sustainability issues in my building design?",
  "How can I improve the energy efficiency of my building?",
  "Is my building design accessible to people with disabilities?",
  "Does my building design meet the relevant technical standards?",
  "Generate a material passport for this project."
]

Output the list of suggested prompts in a JSON array:
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
