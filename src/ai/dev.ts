import { config } from 'dotenv';
config();

import '@/ai/flows/generate-starting-prompts.ts';
import '@/ai/flows/ai-chat-feedback.ts';
import '@/ai/flows/summarize-analysis.ts';