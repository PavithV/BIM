// src/ai/flows/ai-chat-feedback.ts
'use server';

/**
 * @fileOverview An AI chat feedback flow for analyzing IFC models.
 *
 * - aiChatFeedback - A function that handles the chat feedback process.
 * - AIChatFeedbackInput - The input type for the aiChatFeedback function.
 * - AIChatFeedbackOutput - The return type for the aiChatFeedback function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';

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
  const prompt = `Sie sind ein KI-Assistent, der Feedback zu IFC-Modellen gibt. Antworten Sie immer auf Deutsch und im JSON-Format. Nutzen Sie Ihr Wissen, um Fragen zum Modell zu beantworten und dabei Aspekte wie Nachhaltigkeit, Energieeffizienz und Barrierefreiheit einzubeziehen.

IFC-Modelldaten: ${input.ifcModelData}

Benutzerfrage: ${input.userQuestion}

Geben Sie detailliertes und hilfreiches Feedback basierend auf der Frage des Benutzers. Antworten Sie im folgenden JSON-Format:
{
  "feedback": "Ihr Feedback-Text hier"
}`;

  const completion = await ai.chat.completions.create({
    model: "azure.gpt-4.1-mini",
    messages: [
      { role: "system", content: "Sie sind ein KI-Assistent, der Feedback zu IFC-Modellen gibt. Antworten Sie immer auf Deutsch und im JSON-Format. Nutzen Sie Ihr Wissen, um Fragen zum Modell zu beantworten und dabei Aspekte wie Nachhaltigkeit, Energieeffizienz und Barrierefreiheit einzubeziehen." },
      { role: "user", content: prompt }
    ],
    response_format: { type: "json_object" },
  });

  const content = completion.choices[0].message.content;
  if (!content) {
    throw new Error("AI chat feedback failed to produce an output.");
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
        console.warn('Parsing failed, falling back to raw text as feedback');
        // Fallback: wenn der LLM zwar JSON-ähnliches liefert aber nicht korrekt geparst werden kann,
        // dann verwenden wir die gesamte Antwort als String im Feld `feedback`.
        parsed = { feedback: content };
      }
    } else {
      console.warn('No JSON found in response, returning raw content as feedback');
      parsed = { feedback: content };
    }
  }

  // Robustheit: falls das Feld `feedback` kein String ist (z.B. Objekt),
  // konvertieren wir es in einen String, damit das Schema passt.
  if (parsed && parsed.feedback && typeof parsed.feedback !== 'string') {
    try {
      parsed.feedback = JSON.stringify(parsed.feedback, null, 2);
    } catch (e) {
      parsed.feedback = String(parsed.feedback);
    }
  }

  const output = AIChatFeedbackOutputSchema.parse(parsed);
  return output;
}
