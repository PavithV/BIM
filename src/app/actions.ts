'use server';

import { aiChatFeedback, type AIChatFeedbackInput } from '@/ai/flows/ai-chat-feedback';
import { generateStartingPrompts } from '@/ai/flows/generate-starting-prompts';
import { ZodError } from 'zod';
import { getAdminApp, getAdminAuth } from '@/firebase/admin';
import { getFirestore } from 'firebase/admin/firestore';
import { cookies } from 'next/headers';
import type { Message } from '@/components/dashboard';


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


async function getUserId() {
  try {
    const sessionCookie = cookies().get('__session')?.value;
    if (!sessionCookie) {
      return null;
    }
    const decodedToken = await getAdminAuth().verifySessionCookie(sessionCookie);
    return decodedToken.uid;
  } catch (error) {
    console.error('Error verifying session cookie:', error);
    return null;
  }
}

export async function getChatMessages(): Promise<{ messages?: Message[], error?: string }> {
    const userId = await getUserId();
    if (!userId) {
        return { error: 'User not authenticated' };
    }

    try {
        const db = getFirestore(getAdminApp());
        const messagesRef = db.collection('users').doc(userId).collection('messages').orderBy('createdAt', 'asc');
        const snapshot = await messagesRef.get();
        const messages = snapshot.docs.map(doc => {
            const data = doc.data();
            return {
                id: doc.id,
                role: data.role,
                content: data.content,
                createdAt: {
                  seconds: data.createdAt.seconds,
                  nanoseconds: data.createdAt.nanoseconds,
                }
            } as Message;
        });
        return { messages };
    } catch (error) {
        console.error('Error fetching chat messages:', error);
        return { error: 'Failed to fetch chat messages.' };
    }
}


export async function addChatMessage(message: Omit<Message, 'id'>): Promise<{ id?: string, error?: string }> {
    const userId = await getUserId();
    if (!userId) {
        return { error: 'User not authenticated' };
    }

    try {
        const db = getFirestore(getAdminApp());
        const messagesRef = db.collection('users').doc(userId).collection('messages');
        const docRef = await messagesRef.add(message);
        return { id: docRef.id };
    } catch (error) {
        console.error('Error adding chat message:', error);
        return { error: 'Failed to add chat message.' };
    }
}
