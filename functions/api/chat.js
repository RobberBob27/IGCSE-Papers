export async function onRequestPost(context) {
  try {
    const { request, env } = context;
    const { prompt, subject } = await request.json();

    if (!prompt) {
      return new Response(JSON.stringify({ error: 'Prompt is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const systemInstruction = `You are an expert IGCSE tutor specializing in Cambridge and Edexcel syllabi. Focus on concise explanations, mark-scheme terms, key definitions, and step-by-step clarity. Subject context: ${subject || 'General IGCSE'}.`;

    // Run Cloudflare's hosted AI model via the environment binding
    const answer = await env.AI.run('@cf/meta/llama-3.1-8b-instruct', {
      messages: [
        { role: 'system', content: systemInstruction },
        { role: 'user', content: prompt }
      ]
    });

    return new Response(JSON.stringify({ reply: answer.response }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message || 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}