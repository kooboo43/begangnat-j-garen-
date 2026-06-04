exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const body = JSON.parse(event.body);

    // Om det är en vanlig Claude-fråga
    if (body.prompt) {
      const resp = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': process.env.ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 1000,
          messages: [{ role: 'user', content: body.prompt }]
        })
      });
      if (!resp.ok) {
        const err = await resp.json();
        return { statusCode: resp.status, body: JSON.stringify(err) };
      }
      const data = await resp.json();
      return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) };
    }

    // Om det är en träff-räkning
    if (body.countQuery) {
      const q = body.countQuery;
      const results = {};

      // Blocket
      try {
        const blocketResp = await fetch(
          `https://api.blocket.se/search_bff/v1/content?q=${encodeURIComponent(q)}&st=s&ca=11&include=none&lim=1`,
          { headers: { 'Accept': 'application/json' } }
        );
        if (blocketResp.ok) {
          const data = await blocketResp.json();
          results.blocket = data.total_count || data.meta?.total_count || null;
        }
      } catch(e) { results.blocket = null; }

      // Tradera
      try {
        const traderaResp = await fetch(
          `https://www.tradera.com/api/search/v2/items?q=${encodeURIComponent(q)}&page=1&pageSize=1`,
          { headers: { 'Accept': 'application/json' } }
        );
        if (traderaResp.ok) {
          const data = await traderaResp.json();
          results.tradera = data.totalCount || data.pagination?.totalItems || null;
        }
      } catch(e) { results.tradera = null; }

      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(results)
      };
    }

    return { statusCode: 400, body: 'Bad request' };

  } catch (e) {
    return { statusCode: 500, body: JSON.stringify({ error: { message: e.message } }) };
  }
};
