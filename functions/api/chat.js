
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
          error: "Please enter a valid question."
        }),
        { status: 400, headers }
      );
    }

    // Get credentials from Netlify environment variables
    const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
    const apiToken = process.env.CLOUDFLARE_AI_TOKEN;

    if (!accountId || !apiToken) {
      return new Response(
        JSON.stringify({
          error: "Cloudflare credentials are missing."
        }),
        { status: 500, headers }
      );
    }

    // Concise IGCSE tutor instructions
    const systemInstruction = `
You are an expert IGCSE exam tutor.

MOST IMPORTANT RULE:
Answer the student's exact question directly and concisely.

RESPONSE STYLE:
- Usually answer in 1-3 sentences.
- Give the answer immediately.
- Never repeat or rephrase the question.
- Never describe what the question is asking.
- Never explain your response strategy.
- Never use headings such as "Step 1", "AI Revision Summary",
  "Understanding the Question" or "Detailed Response".
- Never add unnecessary introductions or conclusions.
- Do not ask for clarification when a useful answer is possible.
- Use simple, clear language and correct Markdown.
- Stop when the question has been answered.

IGCSE EXAM RULES:
- Use accurate, exam-ready terminology.
- Definitions should be precise and concise.
- State, name and identify questions need direct answers.
- Explain questions must include necessary cause-and-effect links.
- For calculations, show essential working and the final answer.
- For multi-mark questions, provide enough distinct points
  to earn the available marks.
- For broad topic requests, give a brief summary of key facts.
- Only give detailed step-by-step explanations when requested
  or when needed to understand the method.
- Never invent facts or mark-scheme requirements.

FORMATTING:
- Use headings only when genuinely useful.
- Use bullet points only when they improve clarity.
- Use mathematical notation where appropriate.
- Do not output internal reasoning or commentary.
- Never leave an answer or equation unfinished.

EXAMPLES:

Question: What is diffusion?
Answer: The net movement of particles from a region of higher
concentration to a region of lower concentration, down a
concentration gradient.

Question: What is a quadratic equation?
Answer: An equation in which the highest power of the variable
is 2, written as ax² + bx + c = 0, where a ≠ 0.

Question: State the function of mitochondria.
Answer: The site of aerobic respiration, where energy is released.

Question: Explain why enzymes denature at high temperatures.
Answer: High temperatures change the shape of the enzyme's
active site, preventing the substrate from binding.
`;

    // Combine subject and question
    const studentQuestion = [
      subject ? `Subject: ${String(subject).slice(0, 100)}` : "",
      prompt.trim()
    ]
      .filter(Boolean)
      .join("\n\n");

    // Request a concise answer from Cloudflare Llama
    const apiResponse = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/@cf/meta/llama-3.1-8b-instruct`,
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiToken}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          messages: [
            {
              role: "system",
              content: systemInstruction
            },
            {
              role: "user",
              content: studentQuestion
            }
          ],
          max_tokens: 300,
          temperature: 0.2
        })
      }
    );

    const data = await apiResponse.json();

    // Handle Cloudflare API errors
    if (!apiResponse.ok || !data.success) {
      console.error(
        "Cloudflare AI request failed:",
        apiResponse.status,
        data.errors
      );

      return new Response(
        JSON.stringify({
          error: "The AI tutor could not generate an answer.",
          details: data.errors
            ?.map(error => error.message)
            .join("; ") || "Check your Cloudflare settings and usage limits."
        }),
        { status: 502, headers }
      );
    }

    // Extract the model's response
    const reply =
      data.result?.response?.trim() ||
      "Sorry, no answer was generated. Please try again.";

    return new Response(
      JSON.stringify({ reply }),
      { status: 200, headers }
    );

  } catch (err) {
    console.error("AI tutor error:", err);

    return new Response(
      JSON.stringify({
        error: "An unexpected error occurred. Please try again."
      }),
      { status: 500, headers }
    );
  }
};

export const config = {
  path: "/api/chat"
};
