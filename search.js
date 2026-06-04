exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const { prompt } = JSON.parse(event.body);

    const makeRequest = async (messages) => {
      const resp = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': process.env.ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 2000,
          tools: [{ type: 'web_search_20250305', name: 'web_search' }],
          messages
        })
      });
      if (!resp.ok) {
        const err = await resp.json();
        throw new Error(err.error?.message || 'API error ' + resp.status);
      }
      return await resp.json();
    };

    let messages = [{ role: 'user', content: prompt }];
    let data = await makeRequest(messages);
    let rounds = 0;

    while (data.stop_reason === 'tool_use' && rounds < 6) {
      rounds++;

      // Lägg till hela assistant-svaret (innehåller tool_use blocks)
      messages.push({ role: 'assistant', content: data.content });

      // Bygg tool_result för varje tool_use block
      const toolUseBlocks = data.content.filter(b => b.type === 'tool_use');
      const toolResults = toolUseBlocks.map(b => ({
        type: 'tool_result',
        tool_use_id: b.id,
        content: b.content ? (typeof b.content === 'string' ? b.content : JSON.stringify(b.content)) : 'Search completed'
      }));

      messages.push({ role: 'user', content: toolResults });
      data = await makeRequest(messages);
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    };

  } catch (e) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: { message: e.message } })
    };
  }
};
