
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
        JSON.stringify({ error: "A valid prompt is required." }),
        { status: 400, headers }
      );
    }

    const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
    const apiToken = process.env.CLOUDFLARE_AI_TOKEN;

    if (!accountId || !apiToken) {
      return new Response(
        JSON.stringify({
          error: "Cloudflare credentials are missing in Netlify settings."
        }),
        { status: 500, headers }
      );
    }

    const systemInstruction = `
You are an expert IGCSE tutor specializing in Cambridge
and Pearson Edexcel syllabuses.

Subject: ${String(subject || "General IGCSE").slice(0, 100)}

Give concise explanations, accurate key definitions,
exam-style terminology and clear step-by-step working.
For exam questions, identify relevant marking points.
Do not claim generated answers are official mark schemes.
`;

    const apiResponse = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/@cf/meta/llama-3.1-8b-instruct`,
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiToken}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          prompt: `${systemInstruction}\n\nStudent question:\n${prompt.trim()}`,
          max_tokens: 800
        })
      }
    );

    const data = await apiResponse.json();

    if (!apiResponse.ok || !data.success) {
      console.error("Cloudflare AI request failed:", {
        status: apiResponse.status,
        errors: data.errors
      });

      return new Response(
        JSON.stringify({
          error: "Cloudflare AI request failed. Check your credentials, model and usage limits."
        }),
        { status: 502, headers }
      );
    }

    const reply =
      data.result?.response || "No response generated.";

    return new Response(
      JSON.stringify({ reply }),
      { status: 200, headers }
    );

  } catch (err) {
    console.error("AI tutor error:", err.message);

    return new Response(
      JSON.stringify({ error: "Internal server error." }),
      { status: 500, headers }
    );
  }
};

export const config = {
  path: "/api/chat"
};
