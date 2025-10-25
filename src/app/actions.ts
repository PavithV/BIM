'use server';

import { aiChatFeedback, type AIChatFeedbackInput } from '@/ai/flows/ai-chat-feedback';
import { generateStartingPrompts } from '@/ai/flows/generate-starting-prompts';
import { generateAnalysisFromIfc } from '@/ai/flows/generate-analysis-from-ifc';
import { estimateCostsFromMaterials } from '@/ai/flows/estimate-costs-from-materials';
import type { AnalysisResult, CostEstimationResult, GenerateAnalysisFromIfcInput, MaterialCompositionInput } from '@/lib/types';
import { ZodError } from 'zod';

function getDetailedErrorMessage(error: any): string {
    const errorMessage = error.message || 'Ein unbekannter Fehler ist aufgetreten.';

    if (errorMessage.includes("API key not valid") || (errorMessage.includes("permission denied") && !errorMessage.includes("Billing account")) ) {
        return "Das KI-Feedback konnte nicht abgerufen werden. Ihr API-Schlüssel ist ungültig oder hat nicht die nötigen Berechtigungen. Bitte überprüfen Sie Ihren Schlüssel im .env File und in der Google AI Studio Konsole.";
    }
    if (errorMessage.includes("Billing account") || (errorMessage.includes("permission denied") && errorMessage.includes("project"))) {
        return "Das KI-Feedback konnte nicht abgerufen werden. Für Ihr Google Cloud Projekt ist kein Abrechnungskonto aktiviert. Bitte fügen Sie eines in der Google Cloud Console hinzu, um die KI-Dienste zu nutzen.";
    }
    if (errorMessage.includes("API not enabled")) {
        return "Das KI-Feedback konnte nicht abgerufen werden. Die 'Generative Language API' ist für Ihr Projekt nicht aktiviert. Bitte aktivieren Sie sie in der Google Cloud Console.";
    }
    if (errorMessage.includes("Content creation is blocked")) {
        return 'Ihre Anfrage wurde aufgrund unserer Sicherheitsrichtlinien blockiert. Bitte versuchen Sie es mit einer anderen Anfrage.';
    }
    if (errorMessage.includes("model is overloaded") || errorMessage.includes("resource has been exhausted")) {
        return "Der KI-Dienst ist derzeit überlastet oder Ihr Kontingent ist erschöpft. Bitte versuchen Sie es später erneut oder überprüfen Sie die Limits in Ihrem Google Cloud Projekt.";
    }
    
    return 'Bei der Interaktion mit der KI ist ein unerwarteter Fehler aufgetreten. Bitte versuchen Sie es später erneut.';
}

export async function getStartingPrompts() {
  try {
    const result = await generateStartingPrompts();
    return { prompts: result.prompts };
  } catch (error) {
    console.error('Error in getStartingPrompts:', error);
    return { error: getDetailedErrorMessage(error) };
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

export async function getIfcAnalysis(input: GenerateAnalysisFromIfcInput): Promise<{ analysis?: AnalysisResult; error?: string }> {
  try {
    const result = await generateAnalysisFromIfc(input);
    return { analysis: result };
  } catch (error: any) {
    console.error('Error in getIfcAnalysis:', error);
    if (error instanceof ZodError) {
      return { error: 'Invalid input for IFC analysis.' };
    }
    return { error: getDetailedErrorMessage(error) };
  }
}

export async function getCostEstimation(input: MaterialCompositionInput): Promise<{ costs?: CostEstimationResult; error?: string }> {
  try {
    const result = await estimateCostsFromMaterials(input);
    return { costs: result };
  } catch (error: any) {
    console.error('Error in getCostEstimation:', error);
    if (error instanceof ZodError) {
      return { error: 'Invalid input for cost estimation.' };
    }
    return { error: getDetailedErrorMessage(error) };
  }
}
