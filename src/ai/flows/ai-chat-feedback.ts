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
import {z} from 'zod';

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
  const prompt = `Sie sind ein KI-Assistent, der Feedback zu IFC-Modellen gibt. Antworten Sie immer auf Deutsch. Nutzen Sie Ihr Wissen, um Fragen zum Modell zu beantworten und dabei Aspekte wie Nachhaltigkeit, Energieeffizienz und Barrierefreiheit einzubeziehen.

IFC-Modelldaten: ${input.ifcModelData}

Benutzerfrage: ${input.userQuestion}

Geben Sie detailliertes und hilfreiches Feedback basierend auf der Frage des Benutzers. Antworten Sie im folgenden JSON-Format:
{
  "feedback": "Ihr Feedback-Text hier"
}`;

  const completion = await ai.chat.completions.create({
    model: "azure.gpt-4.1-mini",
    messages: [
      {
        role: "system",
        content: "Sie sind ein KI-Assistent, der Feedback zu IFC-Modellen gibt. Antworten Sie immer auf Deutsch und im JSON-Format."
      },
      {
        role: "user",
        content: prompt
      }
    ],
    response_format: { type: "json_object" },
  });

  const content = completion.choices[0]?.message?.content;
  if (!content) {
    throw new Error("AI chat feedback failed to produce an output.");
  }

  const parsed = JSON.parse(content);
  const output = AIChatFeedbackOutputSchema.parse(parsed);
  return output;
}
