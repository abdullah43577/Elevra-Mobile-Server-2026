import { GoogleGenAI } from "@google/genai";
import { getEnv } from "../lib/get-env";

export class GeminiService {
  private ai: GoogleGenAI;

  constructor() {
    this.ai = new GoogleGenAI({
      apiKey: getEnv("GEMINI_API_KEY") as string,
    });
  }

  /**
   * Generate a summary from text content (for Smart Notes AI Summary)
   */
  async generateSummary(text: string) {
    const prompt = `
      Please provide a concise summary of the following text.
      Keep it brief and highlight the key points.
      
      Text:
      ${text}
      
      Summary:
    `;

    const response = await this.ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: prompt,
    });

    return response.text ?? "";
  }

  /**
   * Transcribe audio to text (for Voice Notes)
   */
  async transcribeAudio(audioData: Buffer | string) {
    // Note: Gemini's API doesn't natively support audio transcription yet
    // You may need Google Cloud Speech-to-Text for this
    // This is a placeholder for future implementation
    throw new Error("Audio transcription not implemented yet");
  }

  /**
   * Generate a chat response (for AI Chat feature)
   */
  async generateChatResponse(userMessage: string, context?: string) {
    const fullPrompt = context ? `Context: ${context}\n\nUser: ${userMessage}\n\nAssistant:` : `User: ${userMessage}\n\nAssistant:`;

    const response = await this.ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: fullPrompt,
    });

    return response.text ?? "";
  }

  /**
   * Rewrite text with a specific style (for AI Rewriter feature)
   */
  async rewriteText(text: string, style?: "professional" | "casual" | "concise" | "detailed") {
    const styleMap = {
      professional: "Make it more professional and formal.",
      casual: "Make it more casual and conversational.",
      concise: "Make it more concise and to the point.",
      detailed: "Expand on the details and make it more comprehensive.",
    };

    const styleInstruction = style ? styleMap[style] : "Improve the clarity and flow.";

    const prompt = `
      Please rewrite the following text.
      ${styleInstruction}
      Keep the same meaning but improve the wording.
      
      Original text:
      ${text}
      
      Rewritten text:
    `;

    const response = await this.ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: prompt,
    });

    return response.text ?? "";
  }

  /**
   * Generate a streaming response (for real-time AI Chat)
   */
  async generateStreamingResponse(userMessage: string, onChunk: (chunk: string) => void): Promise<void> {
    const stream = await this.ai.models.generateContentStream({
      model: "gemini-2.0-flash",
      contents: userMessage,
    });

    for await (const chunk of stream) {
      if (chunk.text) {
        onChunk(chunk.text);
      }
    }
  }

  /**
   * Generate content for resume (for Resume Studio)
   */
  async generateResumeContent(jobTitle: string, experience: string, skills: string[]): Promise<{ summary: string; bulletPoints: string[] }> {
    const prompt = `
      Generate a professional resume summary and bullet points for a ${jobTitle} position.
      
      Experience: ${experience}
      Skills: ${skills.join(", ")}
      
      Please provide:
      1. A professional summary (2-3 sentences)
      2. 5-6 bullet points of key achievements and responsibilities
      
      Respond with ONLY valid JSON, no markdown fences, in the shape:
      {"summary": string, "bulletPoints": string[]}
    `;

    const response = await this.ai.models.generateContent({
      model: "gemini-2.0-pro",
      contents: prompt,
    });

    const raw = (response.text ?? "").trim();
    const cleaned = raw.replace(/^```json\s*|```$/g, "").trim();

    try {
      return JSON.parse(cleaned);
    } catch {
      // Fall back to returning the raw text as the summary if parsing fails
      return { summary: raw, bulletPoints: [] };
    }
  }

  /**
   * Generate career advice (for Career Tools)
   */
  async generateCareerAdvice(query: string, context?: string) {
    const fullPrompt = `
      You are a career advisor. Please provide helpful, practical advice for the following question:
      
      Question: ${query}
      
      ${context ? `Additional context: ${context}` : ""}
      
      Provide actionable advice with specific steps when possible.
    `;

    const response = await this.ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: fullPrompt,
    });

    return response.text ?? "";
  }
}
