// modules/news.js
// Uses NewsAPI (free tier: 100 requests/day) OR RSS feeds (completely free)
// Set NEWS_API_KEY in .env for NewsAPI, otherwise falls back to RSS (no key needed)

async function getNews(category = 'general', country = 'in') {
  const apiKey = process.env.NEWS_API_KEY;

  if (apiKey) {
    return await getNewsFromAPI(apiKey, category, country);
  } else {
    return await getNewsFromRSS(category);
  }
}

// ── NewsAPI (100 free requests/day) ──────────────────────────────────────────
async function getNewsFromAPI(apiKey, category, country) {
  const url = `https://newsapi.org/v2/top-headlines?country=${country}&category=${category}&pageSize=5&apiKey=${apiKey}`;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`NewsAPI error: ${response.status}`);

  const data = await response.json();
  return {
    source: 'NewsAPI',
    category,
    articles: data.articles.map((a) => ({
      title: a.title,
      description: a.description,
      source: a.source?.name,
      url: a.url,
      publishedAt: a.publishedAt,
    })),
  };
}

// ── RSS Fallback (completely free, no key needed) ────────────────────────────
const RSS_FEEDS = {
  general: 'https://feeds.bbci.co.uk/news/rss.xml',
  technology: 'https://feeds.feedburner.com/TechCrunch',
  india: 'https://feeds.feedburner.com/ndtvnews-top-stories',
  world: 'https://feeds.bbci.co.uk/news/world/rss.xml',
  business: 'https://feeds.bbci.co.uk/news/business/rss.xml',
  science: 'https://feeds.bbci.co.uk/news/science_and_environment/rss.xml',
  sports: 'https://feeds.bbci.co.uk/sport/rss.xml',
};

async function getNewsFromRSS(category = 'general') {
  const feedUrl = RSS_FEEDS[category] || RSS_FEEDS.general;
  const response = await fetch(feedUrl);
  if (!response.ok) throw new Error(`RSS fetch error: ${response.status}`);

  const text = await response.text();
  const articles = parseRSS(text).slice(0, 5);

  return {
    source: 'RSS',
    category,
    articles,
  };
}

function parseRSS(xml) {
  const items = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/g;
  let match;

  while ((match = itemRegex.exec(xml)) !== null) {
    const item = match[1];
    const title = extractTag(item, 'title');
    const description = extractTag(item, 'description');
    const link = extractTag(item, 'link');
    const pubDate = extractTag(item, 'pubDate');

    items.push({
      title: cleanText(title),
      description: cleanText(description),
      url: link,
      publishedAt: pubDate,
      source: 'RSS Feed',
    });
  }

  return items;
}

function extractTag(xml, tag) {
  const match = xml.match(new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${tag}>|<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`));
  return match ? (match[1] || match[2] || '').trim() : '';
}

function cleanText(text) {
  return text
    .replace(/<[^>]*>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();
}

module.exports = { getNews };
