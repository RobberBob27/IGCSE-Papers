
export default async (req, context) => {
  const headers = {
    "Content-Type": "application/json"
  };

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      { status: 405, headers }
    );
  }

  try {
    const { prompt, subject } = await req.json();

    if (
      typeof prompt !== "string" ||
      !prompt.trim() ||
      prompt.length > 10000
    ) {
      return new Response(
        JSON.stringify({
          error: "A valid prompt is required (maximum 10,000 characters)."
        }),
        { status: 400, headers }
      );
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;

    if (!apiKey) {
      return new Response(
        JSON.stringify({
          error: "ANTHROPIC_API_KEY is missing in Netlify settings."
        }),
        { status: 500, headers }
      );
    }

    const systemInstruction = `
You are an expert IGCSE tutor specializing in Cambridge
and Pearson Edexcel syllabuses.

Subject context: ${String(subject || "General IGCSE").slice(0, 100)}.

Provide clear, concise explanations using appropriate
IGCSE terminology, key definitions, and step-by-step
working where useful.

For exam questions, identify relevant marking points.
Do not claim generated answers are official mark schemes.
If information is uncertain, say so.
`;

    const apiResponse = await fetch(
      "https://api.anthropic.com/v1/messages",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01"
        },
        body: JSON.stringify({
          model: "claude-sonnet-5-5",
          max_tokens: 1200,
          system: systemInstruction,
          messages: [
            {
              role: "user",
              content: prompt.trim()
            }
          ]
        })
      }
    );

    const data = await apiResponse.json();

    if (!apiResponse.ok) {
      console.error("Anthropic API error:", apiResponse.status);

      return new Response(
        JSON.stringify({
          error: "The AI tutor could not generate a response."
        }),
        {
          status: apiResponse.status === 429 ? 429 : 502,
          headers
        }
      );
    }

    const reply = (data.content || [])
      .filter(item => item.type === "text")
      .map(item => item.text)
      .join("\n");

    return new Response(
      JSON.stringify({
        reply: reply || "No response generated."
      }),
      { status: 200, headers }
    );

  } catch (err) {
    console.error("Tutor function failed:", err.message);

    return new Response(
      JSON.stringify({ error: "Internal server error." }),
      { status: 500, headers }
    );
  }
};

export const config = {
  path: "/api/chat"
};
