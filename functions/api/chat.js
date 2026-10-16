export default async (req, context) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405 });
  }

  try {
    const { prompt, subject } = await req.json();

    if (!prompt) {
      return new Response(JSON.stringify({ error: "Prompt is required" }), { status: 400 });
    }

    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return new Response(JSON.stringify({ error: "GEMINI_API_KEY is missing in Netlify settings" }), { status: 500 });
    }

    const systemInstructionText = `You are an expert IGCSE tutor specializing in Cambridge and Edexcel syllabi. Focus on concise explanations, mark-scheme terms, key definitions, and step-by-step clarity. Subject context: ${subject || 'General IGCSE'}.`;

    // Updated to use the gemini-3.5-flash-lite endpoint
    const apiResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: systemInstructionText }] },
        contents: [{ parts: [{ text: prompt }] }]
      })
    });

    const data = await apiResponse.json();

    if (!apiResponse.ok) {
      throw new Error(data.error?.message || "Failed to generate response from Gemini");
    }

    const reply = data.candidates?.[0]?.content?.parts?.[0]?.text || "No response generated.";

    return new Response(JSON.stringify({ reply }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message || "Internal server error" }), { status: 500 });
  }
};

export const config = {
  path: "/api/chat"
};
