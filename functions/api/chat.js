
export default async (req, context) => {
  const headers = {
    "Content-Type": "application/json"
  };

  // Only accept POST requests
  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      { status: 405, headers }
    );
  }

  try {
    const { prompt, subject } = await req.json();

    // Validate the student's question
    if (
      typeof prompt !== "string" ||
      !prompt.trim() ||
      prompt.length > 10000
    ) {
      return new Response(
        JSON.stringify({
          error: "A valid prompt is required."
        }),
        { status: 400, headers }
      );
    }

    // Read Cloudflare credentials from Netlify environment variables
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

    // IGCSE tutor instructions
    const systemInstruction = `
You are an expert IGCSE tutor.

RESPONSE STYLE:
- Be concise, direct and easy to understand.
- Aim for 2-5 sentences for ordinary questions.
- Answer the exact question first.
- Avoid unnecessary introductions and repetition.
- Use headings and bullet points only when useful.
- Do not omit essential information just to be shorter.
- Give detailed, step-by-step explanations when requested.
- Never invent facts, mark-scheme points or syllabus rules.
- If uncertain, say so.

EXAM RULES:
- Use precise, creditworthy IGCSE terminology.
- Match the answer to the command word and mark allocation.
- For calculations, show essential working and the final answer.
- For Maths, explain the necessary method.
- For sciences, explain the key scientific principle.
- For languages, provide accurate grammar and translations.
- For English, support interpretations with relevant evidence.

Aim to maximise understanding and exam marks using
the fewest words necessary.
`;

    // Combine the subject and question
    const studentQuestion = [
      subject ? `Subject: ${subject}` : "",
      prompt.trim()
    ]
      .filter(Boolean)
      .join("\n\n");

    // Call Cloudflare Workers AI using Llama 3.1 8B
    const apiResponse = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/@cf/meta/llama-3.1-8b-instruct`,
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiToken}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          prompt: `${systemInstruction}\n\nStudent question:\n${studentQuestion}`,
          max_tokens: 256
        })
      }
    );

    const data = await apiResponse.json();

    // Return useful diagnostic information if Cloudflare rejects the request
    if (!apiResponse.ok || !data.success) {
      console.error("Cloudflare AI request failed:", {
        status: apiResponse.status,
        errors: data.errors
      });

      return new Response(
        JSON.stringify({
          error: "Cloudflare AI request failed.",
          status: apiResponse.status,
          details: data.errors
            ?.map(error => error.message)
            .join("; ") ||
            "Check your Cloudflare credentials, model access and usage limits."
        }),
        { status: 502, headers }
      );
    }

    // Extract Llama's response
    const reply =
      data.result?.response?.trim() ||
      "No response generated.";

    return new Response(
      JSON.stringify({ reply }),
      { status: 200, headers }
    );

  } catch (err) {
    console.error("AI tutor error:", err.message);

    return new Response(
      JSON.stringify({
        error: "Internal server error."
      }),
      { status: 500, headers }
    );
  }
};

export const config = {
  path: "/api/chat"
};
