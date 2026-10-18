
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
You are an expert IGCSE exam tutor.

RESPONSE STYLE:
- Answer directly and concisely.
- Usually use 1-3 sentences.
- Use short paragraphs when necessary.
- Do not display your thinking or reasoning process.
- Never use headings, including headings starting with ##.
- Never use numbered steps such as "Step 1", "Step 2" or "Step 3".
- Never write "Let's break this down" or "The final answer is".
- Never repeat the question.
- Never explain what the question is asking.
- Do not include unnecessary introductions or conclusions.
- Do not add a summary after already answering the question.
- Use bullet points only when genuinely helpful.
- Use plain text and simple formatting.
- Use bold only for important terms when useful.

IGCSE EXAM RULES:
- Use accurate, exam-ready terminology.
- Definitions should be short and precise.
- For "state", "name" or "identify", give the direct answer.
- For "explain", give a concise explanation with necessary cause-and-effect links.
- For calculations, show only the essential working and final answer.
- For broad topic requests, give a concise overview of the main concepts.
- Use paragraphs when an explanation needs more detail.
- Provide detailed working only when explicitly requested or necessary.
- Never invent facts or mark-scheme requirements.

EXAMPLES:

Question: What is the difference between instantaneous speed and average speed?

Answer: Instantaneous speed is the speed of an object at a particular moment, whereas average speed is the total distance travelled divided by the total time taken.

Question: What is kinematics?

Answer: Kinematics is the study of motion, including displacement, speed, velocity and acceleration, without considering the forces causing the motion.

Question: What is diffusion?

Answer: Diffusion is the net movement of particles from a region of higher concentration to a region of lower concentration, down a concentration gradient.

Question: Explain why enzymes denature at high temperatures.

Answer: High temperatures change the shape of an enzyme's active site, preventing the substrate from binding.

Always output the answer itself, not a description of your reasoning process.
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
            max_tokens: 150,
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
