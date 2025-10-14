'use server';

import { aiChatFeedback, type AIChatFeedbackInput } from '@/ai/flows/ai-chat-feedback';
import { generateStartingPrompts } from '@/ai/flows/generate-starting-prompts';
import { ZodError } from 'zod';

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
  } catch (error) {
    console.error('Error in getAIChatFeedback:', error);
    if (error instanceof ZodError) {
      return { error: 'Invalid input for AI chat feedback.' };
    }
    return { error: 'Failed to get AI feedback.' };
  }
}
