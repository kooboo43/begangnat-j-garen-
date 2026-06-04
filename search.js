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
    const log = [`round0: stop_reason=${data.stop_reason} blocks=${data.content.map(b=>b.type).join(',')}`];

    while (data.stop_reason === 'tool_use' && rounds < 6) {
      rounds++;
      messages.push({ role: 'assistant', content: data.content });

      const toolUseBlocks = data.content.filter(b => b.type === 'tool_use');
      const toolResults = toolUseBlocks.map(b => ({
        type: 'tool_result',
        tool_use_id: b.id,
        content: b.content ? (typeof b.content === 'string' ? b.content : JSON.stringify(b.content)) : 'ok'
      }));

      messages.push({ role: 'user', content: toolResults });
      data = await makeRequest(messages);
      log.push(`round${rounds}: stop_reason=${data.stop_reason} blocks=${data.content.map(b=>b.type).join(',')}`);
    }

    // Returnera data + debug-logg
    data._debug = log;

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
