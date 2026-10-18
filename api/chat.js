
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
You are a concise IGCSE exam tutor.
Answer directly in 1-3 sentences whenever possible.
Use accurate IGCSE terminology and concise definitions.
For calculations, show essential working.
For explain questions, include necessary cause-and-effect links.
Never repeat the question or add unnecessary headings.
Use more detail only when the question requires it.
Answer the student's exact question.
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
            max_tokens: 250,
            temperature: 0.2
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
