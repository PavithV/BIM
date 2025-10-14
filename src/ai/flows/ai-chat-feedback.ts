// src/ai/flows/ai-chat-feedback.ts
'use server';

/**
 * @fileOverview An AI chat feedback flow for analyzing IFC models.
 *
 * - aiChatFeedback - A function that handles the chat feedback process.
 * - AIChatFeedbackInput - The input type for the aiChatFeedback function.
 * - AIChatFeedbackOutput - The return type for the aiChatFeedback function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const AIChatFeedbackInputSchema = z.object({
  ifcModelData: z
    .string()
    .describe(
      'Die IFC-Modelldaten als Zeichenkette.'
    ),
  userQuestion: z.string().describe('Die Benutzerfrage zum IFC-Modell.'),
});
export type AIChatFeedbackInput = z.infer<typeof AIChatFeedbackInputSchema>;

const AIChatFeedbackOutputSchema = z.object({
  feedback: z.string().describe('Das KI-gestützte Feedback zum IFC-Modell basierend auf der Benutzerfrage.'),
});
export type AIChatFeedbackOutput = z.infer<typeof AIChatFeedbackOutputSchema>;

export async function aiChatFeedback(input: AIChatFeedbackInput): Promise<AIChatFeedbackOutput> {
  return aiChatFeedbackFlow(input);
}

const prompt = ai.definePrompt({
  name: 'aiChatFeedbackPrompt',
  input: {schema: AIChatFeedbackInputSchema},
  output: {schema: AIChatFeedbackOutputSchema},
  prompt: `Sie sind ein KI-Assistent, der Feedback zu IFC-Modellen gibt. Antworten Sie immer auf Deutsch. Nutzen Sie Ihr Wissen, um Fragen zum Modell zu beantworten und dabei Aspekte wie Nachhaltigkeit, Energieeffizienz und Barrierefreiheit einzubeziehen.

IFC-Modelldaten: {{{ifcModelData}}}

Benutzerfrage: {{{userQuestion}}}

Geben Sie detailliertes und hilfreiches Feedback basierend auf der Frage des Benutzers.`,
});

const aiChatFeedbackFlow = ai.defineFlow(
  {
    name: 'aiChatFeedbackFlow',
    inputSchema: AIChatFeedbackInputSchema,
    outputSchema: AIChatFeedbackOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
