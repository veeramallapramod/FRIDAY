// modules/webSearch.js
// DuckDuckGo Instant Answer API — completely free, no API key needed
// Also supports fetching full page content for deeper answers

async function webSearch(query) {
  const encoded = encodeURIComponent(query);
  const url = `https://api.duckduckgo.com/?q=${encoded}&format=json&no_redirect=1&no_html=1&skip_disambig=1`;

  const response = await fetch(url);
  if (!response.ok) throw new Error(`Search failed: ${response.status}`);

  const data = await response.json();
  const results = [];

  if (data.Answer) {
    results.unshift({ type: 'direct_answer', title: 'Direct Answer', snippet: data.Answer, url: null });
  }
  if (data.AbstractText) {
    results.push({ type: 'abstract', title: data.Heading || query, snippet: data.AbstractText, url: data.AbstractURL, source: data.AbstractSource });
  }
  if (data.RelatedTopics?.length > 0) {
    for (const topic of data.RelatedTopics.slice(0, 4)) {
      if (topic.Text && topic.FirstURL) {
        results.push({ type: 'related', title: topic.Text.split(' - ')[0] || topic.Text, snippet: topic.Text, url: topic.FirstURL });
      }
    }
  }
  if (data.Definition) {
    results.push({ type: 'definition', title: `Definition: ${data.DefinitionSource}`, snippet: data.Definition, url: data.DefinitionURL });
  }

  return { query, results: results.slice(0, 6), answerType: data.Type };
}

async function fetchPage(url) {
  try {
    const response = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; FRIDAY-Assistant/1.0)' },
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) throw new Error(`Page fetch failed: ${response.status}`);
    const html = await response.text();
    const text = html
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 3000);
    return { url, content: text };
  } catch (err) {
    throw new Error(`Could not fetch page: ${err.message}`);
  }
}

module.exports = { webSearch, fetchPage };
