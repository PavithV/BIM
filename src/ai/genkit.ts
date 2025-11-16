import OpenAI from "openai";

export const ai = new OpenAI({
  apiKey: process.env.KIT_API_KEY,
  baseURL: "https://ki-toolbox.scc.kit.edu/api/v1",
});
