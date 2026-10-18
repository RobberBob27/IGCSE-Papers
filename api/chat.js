
export default {
  async fetch(request) {
    const headers = {
      "Content-Type": "application/json"
    };

    // Test whether Vercel can find this API route
    if (request.method === "GET") {
      return Response.json({
        status: "ok",
        message: "IGCSE AI API is running."
      });
    }

    if (request.method !== "POST") {
      return Response.json(
        { error: "Method not allowed." },
        { status: 405, headers }
      );
    }

    try {
      const body = await request.json();
      const { prompt, subject } = body;

      if (typeof prompt !== "string" || !prompt.trim()) {
        return Response.json(
          { error: "Please enter a question." },
          { status: 400, headers }
        );
      }

      const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
      const apiToken = process.env.CLOUDFLARE_AI_TOKEN;

      if (!accountId || !apiToken) {
        return Response.json(
          {
            error: "Missing Cloudflare environment variables."
          },
          { status: 500, headers }
        );
      }


const instructions = `
You are an IGCSE exam tutor. Give only the answer to the
student's latest question.

STRICT OUTPUT RULES:
- Give a simple, concise, accurate answer.
- For definition questions, give only the definition.
- Usually use one sentence.
- Use a short paragraph only if necessary.
- Do not repeat the question.
- Do not write "Answer:" before the response.
- Do not include introductions, background context or conclusions.
- Do not include examples unless requested.
- Do not display reasoning, thinking or solution steps.
- Never use headings, numbered steps or markdown headings.
- Never write "Step 1", "Step 2", "Let's break this down",
  or "The final answer is".
- Do not mention previous questions unless the latest question
  explicitly refers to them.
- Treat each new message as a separate question unless the
  student clearly asks a follow-up.
- If the student enters a single subject term, provide its
  concise IGCSE definition.
- Output only the answer itself.
IGCSE ACCURACY:
- Use correct scientific and mathematical terminology.
- Match the wording to IGCSE expectations.
- For calculations, include essential working only when needed.
- For explain questions, include the necessary cause and effect.
- Never sacrifice accuracy for brevity.
EXAMPLES:
Question: What is a scalar?
Response: A quantity with magnitude only.
Question: What is a vector?
Response: A quantity with both magnitude and direction.
Question: What is velocity?
Response: Speed in a specified direction.
Question: What is displacement?
Response: The distance and direction from an object's initial
position to its final position.
Question: What is the difference between speed and velocity?
Response: Speed is a scalar quantity, whereas velocity is a
vector quantity with both magnitude and direction.
Return only the response. No labels or additional text.
`;
      const studentQuestion = [
        subject ? `Subject: ${String(subject).slice(0, 100)}` : "",
        prompt.trim()
      ].filter(Boolean).join("\n\n");

      const aiResponse = await fetch(
        `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/@cf/meta/llama-3.1-8b-instruct`,
        {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${apiToken}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            prompt: `${instructions}\n\nStudent question:\n${studentQuestion}`,
            max_tokens: 100,
            temperature: 0.15
          })
        }
      );

      const data = await aiResponse.json();

      if (!aiResponse.ok || !data.success) {
        console.error("Cloudflare AI error:", {
          status: aiResponse.status,
          errors: data.errors
        });

        return Response.json(
          {
            error: "Cloudflare AI request failed.",
            details: data.errors
              ?.map(e => e.message)
              .join("; ") || `HTTP ${aiResponse.status}`
          },
          { status: 502, headers }
        );
      }

      const reply = data.result?.response?.trim();

      if (!reply) {
        return Response.json(
          { error: "The AI returned an empty response." },
          { status: 502, headers }
        );
      }

      return Response.json({ reply }, { status: 200, headers });

    } catch (error) {
      console.error("Vercel AI function error:", error);

      return Response.json(
        { error: "The server could not process your request." },
        { status: 500, headers }
      );
    }
  }
};
