'use server';

import { aiChatFeedback, type AIChatFeedbackInput } from '@/ai/flows/ai-chat-feedback';
import { generateStartingPrompts } from '@/ai/flows/generate-starting-prompts';
import { generateAnalysisFromIfc } from '@/ai/flows/generate-analysis-from-ifc';
import { estimateCostsFromMaterials } from '@/ai/flows/estimate-costs-from-materials';
import type { AnalysisResult, CostEstimationResult, GenerateAnalysisFromIfcInput, MaterialCompositionInput } from '@/lib/types';
import { ZodError } from 'zod';
import { compressIfcFile, getProposedMaterialReplacements, type MaterialReplacement } from '@/utils/ifcCompressor';
import { createClient } from '@/lib/supabase/server';

import { auth } from '@/auth';
import { supabaseAdmin } from '@/lib/supabase/admin';

export async function fetchUserProjects() {
  const session = await auth();

  if (!session?.user?.id) {
    return { error: 'Nicht authentifiziert' };
  }

  try {
    const { data: projects, error } = await supabaseAdmin
      .from('ifc_models')
      .select('*')
      .eq('user_id', session.user.id)
      .order('uploadDate', { ascending: false });

    if (error) {
      console.error('Error fetching projects:', error);
      return { error: 'Fehler beim Laden der Projekte.' };
    }

    return { projects };
  } catch (error) {
    console.error('Unexpected error fetching projects:', error);
    return { error: 'Ein unerwarteter Fehler ist aufgetreten.' };
  }
}

async function requireAuth() {
  const session = await auth();

  if (!session?.user) {
    throw new Error('Unauthorized');
  }
}

function getDetailedErrorMessage(error: any): string {
  const errorMessage = error.message || 'Ein unbekannter Fehler ist aufgetreten.';

  if (errorMessage.includes("API key not valid") || errorMessage.includes("invalid_api_key") || (errorMessage.includes("permission denied") && !errorMessage.includes("Billing account"))) {
    return "Das KI-Feedback konnte nicht abgerufen werden. Ihr API-Schlüssel ist ungültig oder hat nicht die nötigen Berechtigungen. Bitte überprüfen Sie Ihren GEMINI_API_KEY im .env File.";
  }
  if (errorMessage.includes("Billing account") || (errorMessage.includes("permission denied") && errorMessage.includes("project"))) {
    return "Das KI-Feedback konnte nicht abgerufen werden. Für Ihr Projekt ist kein Abrechnungskonto aktiviert oder es fehlen die nötigen Berechtigungen.";
  }
  if (errorMessage.includes("API not enabled")) {
    return "Das KI-Feedback konnte nicht abgerufen werden. Die API ist für Ihr Projekt nicht aktiviert. Bitte überprüfen Sie die Gemini-API-Konfiguration.";
  }
  if (errorMessage.includes("Content creation is blocked")) {
    return 'Ihre Anfrage wurde aufgrund unserer Sicherheitsrichtlinien blockiert. Bitte versuchen Sie es mit einer anderen Anfrage.';
  }
  if (errorMessage.includes("model is overloaded") || errorMessage.includes("resource has been exhausted") || errorMessage.includes("rate_limit")) {
    return "Der KI-Dienst ist derzeit überlastet oder Ihr Kontingent ist erschöpft. Bitte versuchen Sie es später erneut.";
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

export async function checkMaterialReplacements(ifcContent: string): Promise<{ replacements?: MaterialReplacement[], error?: string }> {
  try {
    const replacements = getProposedMaterialReplacements(ifcContent);
    return { replacements };
  } catch (error) {
    console.error('Error in checkMaterialReplacements:', error);
    return { error: 'Fehler beim Überprüfen der Materialien.' };
  }
}

export async function getAIChatFeedback(input: AIChatFeedbackInput & { replacementMap?: Record<string, string> }) {
  try {
    await requireAuth();

    // Komprimiere IFC-Datei vor dem Senden an die KI
    const compressedIfcData = compressIfcFile(input.ifcModelData, input.replacementMap);
    // Server-side debug: logge Längeninfo und Preview (Terminal)
    try {
      const preview = typeof compressedIfcData === 'string' ? compressedIfcData.slice(0, 1000) : String(compressedIfcData);
      console.log('getAIChatFeedback - compressedIfcData length:', typeof compressedIfcData === 'string' ? compressedIfcData.length : undefined);
      console.log('getAIChatFeedback - compressedIfcData preview:\n', preview);
    } catch (e) {
      console.warn('Could not log compressedIfcData preview', e);
    }

    const result = await aiChatFeedback({
      ...input,
      ifcModelData: compressedIfcData
    });
    return { feedback: result.feedback };
  } catch (error: any) {
    console.error('Error in getAIChatFeedback:', error);
    if (error instanceof ZodError) {
      return { error: 'Invalid input for AI chat feedback.' };
    }
    return { error: getDetailedErrorMessage(error) };
  }
}

export async function getIfcAnalysis(input: GenerateAnalysisFromIfcInput & { replacementMap?: Record<string, string> }): Promise<{ analysis?: AnalysisResult; error?: string }> {
  try {
    await requireAuth();

    // Komprimiere IFC-Datei vor dem Senden an die KI
    // @ts-ignore
    const compressedIfcContent = compressIfcFile(input.ifcFileContent, input.replacementMap);
    console.log('--- Compressed IFC Data (Verification) ---');
    console.log(compressedIfcContent.slice(0, 2000) + (compressedIfcContent.length > 2000 ? '\n... (truncated)' : ''));
    console.log('------------------------------------------');

    const result = await generateAnalysisFromIfc({
      ifcFileContent: compressedIfcContent
    });
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
    await requireAuth();

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

// ----------------------------------------------------------------
// Server Actions that bypass RLS (using supabaseAdmin)
// These replace direct browser-side Supabase calls.
// ----------------------------------------------------------------

/**
 * Creates a signed upload URL so the browser can upload directly to Supabase Storage
 * without needing a Supabase Auth session.
 */
export async function createSignedUploadUrl(fileName: string, fileSize: number): Promise<{ signedUrl?: string; token?: string; storagePath?: string; error?: string }> {
  const session = await auth();
  if (!session?.user?.id) return { error: 'Nicht authentifiziert' };

  try {
    const sanitizedFileName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
    const timestamp = Date.now();
    const storagePath = `users/${session.user.id}/${timestamp}_${sanitizedFileName}`;

    const { data, error } = await supabaseAdmin.storage
      .from('ifc-models')
      .createSignedUploadUrl(storagePath);

    if (error) {
      console.error('Error creating signed upload URL:', error);
      return { error: 'Fehler beim Erstellen der Upload-URL.' };
    }

    return {
      signedUrl: data.signedUrl,
      token: data.token,
      storagePath,
    };
  } catch (error) {
    console.error('Unexpected error creating signed upload URL:', error);
    return { error: 'Ein unerwarteter Fehler ist aufgetreten.' };
  }
}

/**
 * Creates a new ifc_models record in the database.
 */
export async function createIfcModelRecord(input: {
  fileName: string;
  fileSize: number;
  fileStoragePath: string;
}): Promise<{ project?: any; error?: string }> {
  const session = await auth();
  if (!session?.user?.id) return { error: 'Nicht authentifiziert' };

  try {
    const { data: newProject, error } = await supabaseAdmin
      .from('ifc_models')
      .insert({
        user_id: session.user.id,
        fileName: input.fileName,
        fileSize: input.fileSize,
        fileContent: null,
        fileUrl: null,
        fileStoragePath: input.fileStoragePath,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating ifc_model record:', error);
      return { error: 'Fehler beim Erstellen des Projekteintrags.' };
    }

    return { project: newProject };
  } catch (error) {
    console.error('Unexpected error creating ifc_model record:', error);
    return { error: 'Ein unerwarteter Fehler ist aufgetreten.' };
  }
}

/**
 * Inserts a message into the messages table.
 */
export async function insertMessage(input: {
  ifc_model_id: string;
  role: 'user' | 'assistant';
  content: string;
}): Promise<{ message?: any; error?: string }> {
  const session = await auth();
  if (!session?.user?.id) return { error: 'Nicht authentifiziert' };

  try {
    const { data, error } = await supabaseAdmin
      .from('messages')
      .insert({
        ifc_model_id: input.ifc_model_id,
        user_id: session.user.id,
        role: input.role,
        content: input.content,
      })
      .select()
      .single();

    if (error) {
      console.error('Error inserting message:', error);
      return { error: 'Fehler beim Speichern der Nachricht.' };
    }

    return { message: data };
  } catch (error) {
    console.error('Unexpected error inserting message:', error);
    return { error: 'Ein unerwarteter Fehler ist aufgetreten.' };
  }
}

/**
 * Fetches messages for a given project.
 */
export async function fetchMessagesForProject(ifcModelId: string): Promise<{ messages?: any[]; error?: string }> {
  const session = await auth();
  if (!session?.user?.id) return { error: 'Nicht authentifiziert' };

  try {
    const { data, error } = await supabaseAdmin
      .from('messages')
      .select('*')
      .eq('ifc_model_id', ifcModelId)
      .order('createdAt', { ascending: true });

    if (error) {
      console.error('Error fetching messages:', error);
      return { error: 'Fehler beim Laden der Nachrichten.' };
    }

    return { messages: data || [] };
  } catch (error) {
    console.error('Unexpected error fetching messages:', error);
    return { error: 'Ein unerwarteter Fehler ist aufgetreten.' };
  }
}

/**
 * Updates an ifc_models record (for analysis data, cost estimation, replacements, etc.)
 */
export async function updateIfcModel(
  projectId: string,
  updateData: Record<string, any>
): Promise<{ error?: string }> {
  const session = await auth();
  if (!session?.user?.id) return { error: 'Nicht authentifiziert' };

  try {
    const { error } = await supabaseAdmin
      .from('ifc_models')
      .update(updateData)
      .eq('id', projectId)
      .eq('user_id', session.user.id); // Extra safety: only update own projects

    if (error) {
      console.error('Error updating ifc_model:', error);
      return { error: 'Fehler beim Aktualisieren des Projekts.' };
    }

    return {};
  } catch (error) {
    console.error('Unexpected error updating ifc_model:', error);
    return { error: 'Ein unerwarteter Fehler ist aufgetreten.' };
  }
}
