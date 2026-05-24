export interface AIContext {
  moduleName: string;
  files: { path: string; size: number }[];
}

export class ClientAIProvider {
  private static async generateWithGemini(key: string, prompt: string) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${key}`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error?.message || `Gemini API Error: ${res.status}`);
    }
    const data = await res.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text || "No summary returned.";
  }

  private static async generateWithOpenAI(key: string, prompt: string) {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: "You are an expert software architect." },
          { role: "user", content: prompt },
        ],
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error?.message || `OpenAI API Error: ${res.status}`);
    }
    const data = await res.json();
    return data.choices?.[0]?.message?.content || "No summary returned.";
  }

  public static async generateModuleSummary(
    provider: "gemini" | "openai",
    apiKey: string,
    context: AIContext
  ): Promise<string> {
    if (!apiKey) {
      throw new Error("API key is not configured. Please open settings to add your key.");
    }

    const fileList = context.files.slice(0, 50).map((f) => `- ${f.path} (${f.size} bytes)`).join("\n");
    const truncationNotice = context.files.length > 50 ? `\n...and ${context.files.length - 50} more files omitted for brevity.` : "";

    const prompt = `
Explain the architectural purpose and responsibility of the following module/folder in this repository. 
Module Name: ${context.moduleName}

Contained Files:
${fileList}${truncationNotice}

Provide a concise 2-3 paragraph plain-English summary. Focus on:
1. Architecture overview
2. Module responsibilities
3. Key behaviors based on the file names provided
Be beginner-friendly but technically accurate.
`;

    if (provider === "gemini") {
      return this.generateWithGemini(apiKey, prompt);
    } else {
      return this.generateWithOpenAI(apiKey, prompt);
    }
  }
}
