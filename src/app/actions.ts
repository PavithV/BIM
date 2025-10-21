'use server';

import { aiChatFeedback, type AIChatFeedbackInput } from '@/ai/flows/ai-chat-feedback';
import { generateStartingPrompts } from '@/ai/flows/generate-starting-prompts';
import { ZodError } from 'zod';

function getDetailedErrorMessage(error: any): string {
    const errorMessage = error.message || 'Ein unbekannter Fehler ist aufgetreten.';

    if (errorMessage.includes("API key not valid") || errorMessage.includes("permission denied")) {
        return "Das KI-Feedback konnte nicht abgerufen werden. Ihr API-Schlüssel ist ungültig. Bitte überprüfen Sie Ihren Schlüssel im .env File und in der Google AI Studio Konsole.";
    }
    if (errorMessage.includes("Billing account")) {
        return "Das KI-Feedback konnte nicht abgerufen werden. Für Ihr Google Cloud Projekt ist kein Abrechnungskonto aktiviert. Bitte fügen Sie eines in der Google Cloud Console hinzu, um die KI-Dienste zu nutzen.";
    }
    if (errorMessage.includes("API not enabled")) {
        return "Das KI-Feedback konnte nicht abgerufen werden. Die 'Generative Language API' ist für Ihr Projekt nicht aktiviert. Bitte aktivieren Sie sie in der Google Cloud Console.";
    }
    if (errorMessage.includes("Content creation is blocked")) {
        return 'Ihre Anfrage wurde aufgrund unserer Sicherheitsrichtlinien blockiert. Bitte versuchen Sie es mit einer anderen Anfrage.';
    }
    if (errorMessage.includes("model is overloaded")) {
        return "Der KI-Dienst ist derzeit überlastet. Bitte versuchen Sie es später erneut.";
    }
    
    return 'Bei der Analyse der IFC-Daten ist ein unerwarteter Fehler aufgetreten. Bitte versuchen Sie es später erneut.';
}

export async function getStartingPrompts() {
  try {
    const result = await generateStartingPrompts();
    return { prompts: result.prompts };
  } catch (error) {
    console.error('Error in getStartingPrompts:', error);
    return { error: 'Failed to generate starting prompts.' };
  }
}

export async function getAIChatFeedback(input: AIChatFeedbackInput) {
  try {
    const result = await aiChatFeedback(input);
    return { feedback: result.feedback };
  } catch (error: any) {
    console.error('Error in getAIChatFeedback:', error);
    if (error instanceof ZodError) {
      return { error: 'Invalid input for AI chat feedback.' };
    }
    return { error: getDetailedErrorMessage(error) };
  }
}
