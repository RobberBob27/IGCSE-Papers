
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
You are an expert IGCSE tutor.

RESPONSE STYLE:
- Be concise, direct and easy to understand.
- Aim for 2-5 sentences for ordinary questions.
- Answer the exact question first.
- Avoid unnecessary introductions and repetition.
- Use headings and bullet points only when useful.
- Do not omit essential information to be shorter.
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

    const studentQuestion = [
      subject ? `Subject: ${subject}` : "",
      prompt.trim()
    ].filter(Boolean).join("\n\n");

    const apiResponse = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/v1/messages`,
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiToken}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: "anthropic/claude-haiku-5.5",
          max_tokens: 256,
          system: systemInstruction,
          messages: [
            {
              role: "user",
              content: studentQuestion
            }
          ]
        })
      }
    );

    const data = await apiResponse.json();

   if (!apiResponse.ok || data.error || data.success === false) {
  console.error("Cloudflare AI request failed:", {
    status: apiResponse.status,
    response: JSON.stringify(data)
  });

  return new Response(
    JSON.stringify({
      error: "Cloudflare AI request failed. Check Netlify function logs.",
      status: apiResponse.status
    }),
    { status: 502, headers }
  );
}

    const reply = Array.isArray(data.content)
      ? data.content
          .filter(block => block.type === "text")
          .map(block => block.text)
          .join("\n")
          .trim()
      : "";

    return new Response(
      JSON.stringify({
        reply: reply || "No response generated."
      }),
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
