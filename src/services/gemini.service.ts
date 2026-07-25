import { GoogleGenAI } from "@google/genai";
import { getEnv } from "../lib/get-env";

export class GeminiService {
  private ai: GoogleGenAI;
  MOCK_MODE = true;

  constructor() {
    this.ai = new GoogleGenAI({
      apiKey: getEnv("GEMINI_API_KEY") as string,
    });
  }

  /**
   * Generate a streaming summary from text content
   */
  async generateSummaryStream(text: string, onChunk: (chunk: string) => void) {
    if (this.MOCK_MODE) {
      // Simulate streaming with mock data
      const mockSummary = "This is a mock summary generated without using the Gemini API. It contains key points from the provided text.";
      const words = mockSummary.split(" ");
      for (let i = 0; i < words.length; i++) {
        onChunk(words[i] + " ");
        await new Promise(resolve => setTimeout(resolve, 500)); // Simulate delay
      }
      return;
    }

    try {
      const prompt = `
        Please provide a concise summary of the following text in 2-3 sentences.
        Focus on the main topic and key takeaways. Keep it brief and actionable.
        
        Text:
        ${text}
        
        Summary:
      `;

      const stream = await this.ai.models.generateContentStream({
        model: "gemini-2.0-flash",
        contents: prompt,
      });

      for await (const chunk of stream) {
        if (chunk.text) {
          onChunk(chunk.text);
        }
      }
    } catch (error: any) {
      // Handle quota exceeded error specifically
      if (error.message?.includes("quota") || error.message?.includes("rate limit")) {
        throw new Error("Gemini API quota exceeded. Please try again later or upgrade your plan.");
      }
      const errorMessage = error instanceof Error ? error.message : "Failed to generate summary";
      throw new Error(errorMessage);
    }
  }

  /**
   * Generate a non-streaming summary (fallback)
   */
  async generateSummary(text: string): Promise<string> {
    try {
      const prompt = `
        Please provide a concise summary of the following text in 2-3 sentences.
        Focus on the main topic and key takeaways. Keep it brief and actionable.
        
        Text:
        ${text}
        
        Summary:
      `;

      const response = await this.ai.models.generateContent({
        model: "gemini-2.0-flash",
        contents: prompt,
      });

      return response.text ?? "";
    } catch (error: any) {
      if (error.message?.includes("quota") || error.message?.includes("rate limit")) {
        throw new Error("Gemini API quota exceeded. Please try again later or upgrade your plan.");
      }
      const errorMessage = error instanceof Error ? error.message : "Failed to generate summary";
      throw new Error(errorMessage);
    }
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
    const prompt = `
      You are Elevra, an AI-powered productivity assistant. 
      Be helpful, concise, and professional in your responses.

      ${context ? `Relevant context: ${context}\n\n` : ""}
      User: ${userMessage}
      Assistant:
    `;

    const response = await this.ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: prompt,
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
      Please rewrite the following text while preserving its core meaning.
      ${styleInstruction}
      Improve clarity, flow, and readability. Avoid adding new information.
      
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
  async generateStreamingResponse(userMessage: string, onChunk: (chunk: string) => void) {
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
      Use a professional tone and highlight achievements with quantifiable results where possible.

      Experience: ${experience}
      Skills: ${skills.join(", ")}

      Please provide:
      1. A professional summary (2-3 sentences)
      2. 5-6 bullet points of key achievements and responsibilities

      Respond with ONLY valid JSON, no markdown fences, in the shape:
      {"summary": string, "bulletPoints": string[]}
    `;

    const response = await this.ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: prompt,
    });

    const raw = (response.text ?? "").trim();
    const cleaned = raw.replace(/^```json\s*|```$/g, "").trim();

    try {
      return JSON.parse(cleaned);
    } catch {
      return { summary: raw, bulletPoints: [] };
    }
  }

  /**
   * Generate career advice (for Career Tools)
   */
  async generateCareerAdvice(query: string, context?: string) {
    const prompt = `
      You are an experienced career advisor with 10+ years of industry experience.
      Provide practical, actionable advice for the following question.
      Be specific and include concrete steps when possible.

      Question: ${query}

      ${context ? `Additional context: ${context}\n\n` : ""}
      Advice:
    `;

    const response = await this.ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: prompt,
    });

    return response.text ?? "";
  }
}
