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
      'The IFC model data as a string.'
    ),
  userQuestion: z.string().describe('The user question about the IFC model.'),
});
export type AIChatFeedbackInput = z.infer<typeof AIChatFeedbackInputSchema>;

const AIChatFeedbackOutputSchema = z.object({
  feedback: z.string().describe('The AI-powered feedback on the IFC model based on the user question.'),
});
export type AIChatFeedbackOutput = z.infer<typeof AIChatFeedbackOutputSchema>;

export async function aiChatFeedback(input: AIChatFeedbackInput): Promise<AIChatFeedbackOutput> {
  return aiChatFeedbackFlow(input);
}

const prompt = ai.definePrompt({
  name: 'aiChatFeedbackPrompt',
  input: {schema: AIChatFeedbackInputSchema},
  output: {schema: AIChatFeedbackOutputSchema},
  prompt: `You are an AI assistant providing feedback on IFC models. Use your knowledge to answer questions about the model, incorporating aspects like sustainability, energy efficiency, and accessibility.

IFC Model Data: {{{ifcModelData}}}

User Question: {{{userQuestion}}}

Provide detailed and helpful feedback based on the user's question.`, // added more context to the prompt
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
