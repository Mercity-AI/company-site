import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const summarizeText = async (text: string): Promise<string> => {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: `Provide a sophisticated, concise executive summary of the following research article. Use an academic but accessible tone. \n\n Text: ${text}`,
      config: {
        thinkingConfig: { thinkingBudget: 0 }
      }
    });
    
    return response.text || "Could not generate summary.";
  } catch (error) {
    console.error("Gemini API Error:", error);
    throw error;
  }
};