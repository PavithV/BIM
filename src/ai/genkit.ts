import { OpenAI } from "openai";

export const ai = new OpenAI({
    apiKey: process.env.KIT_TOOLBOX_API_KEY || process.env.GEMINI_API_KEY || "", // Fallback for transition
    baseURL: "https://ki-toolbox.scc.kit.edu/api/v1",
});
