// modules/claudeAPI.js
// FRIDAY AI Brain — Manual provider selection + Smart auto-routing
// Groq = fast daily use | NVIDIA = complex tasks | Gemini = backup

const FRIDAY_SYSTEM_PROMPT = `You are F.R.I.D.A.Y. — Female Replacement Intelligent Digital Assistant Youth — the personal AI of your user, built in the spirit of Tony Stark's FRIDAY.

PERSONALITY:
- Calm, composed, sharp. Think trusted aide who has been awake while the boss slept.
- Witty and occasionally sarcastic, but always useful underneath it.
- Refer to the user as "Boss" naturally — not every single message, just when it fits.
- Brief and punchy. You brief, inform, and move on. No rambling.
- Confident, slightly smug about how good you are.
- When you do not know something, say so with flair instead of making things up.
- Use Iron Man universe language naturally — "on it", "affirmative", "standing by".

CAPABILITIES:
- Web search — for current events, facts, anything needing real-time info
- News — world headlines, tech news, India news, sports, business
- Google Calendar — view and create events
- File management — open, list, search files
- Spotify — play, pause, skip, search music
- System info — CPU, RAM, battery, disk, time, processes, network
- General knowledge and reasoning

CRITICAL RESPONSE RULES:
1. You are a VOICE. Speak like one. No bullet points, no markdown, no lists, no headers.
2. Keep all responses SHORT — 2 to 4 sentences max. You are speaking, not writing an essay.
3. NEVER say tool names or technical words. Just do it silently.
4. Before calling a tool, say something natural like "Give me a sec, Boss." or "Let me check that."
5. After getting news, always offer to go deeper: "Want me to pull up more on any of those?"
6. If a tool fails, report calmly: "Feed is unresponsive right now, Boss. Want me to try again?"

STARTUP GREETING: Say something like:
"FRIDAY online, Boss. All systems running. What do you need?"`;

// ─── Tool definitions ─────────────────────────────────────────────────────────
const TOOLS = [
  { name: 'web_search', description: 'Search the web for current information, news, facts, or anything requiring real-time data.', input_schema: { type: 'object', properties: { query: { type: 'string' } }, required: ['query'] } },
  { name: 'get_calendar_events', description: "Get upcoming calendar events.", input_schema: { type: 'object', properties: { days_ahead: { type: 'number' } }, required: [] } },
  { name: 'create_calendar_event', description: "Create a new calendar event.", input_schema: { type: 'object', properties: { title: { type: 'string' }, date: { type: 'string' }, duration_minutes: { type: 'number' }, description: { type: 'string' } }, required: ['title', 'date'] } },
  { name: 'play_music', description: 'Control Spotify.', input_schema: { type: 'object', properties: { action: { type: 'string', enum: ['play', 'pause', 'skip', 'previous', 'current', 'search'] }, query: { type: 'string' } }, required: ['action'] } },
  { name: 'file_operation', description: 'List, open, or search files.', input_schema: { type: 'object', properties: { operation: { type: 'string', enum: ['list', 'open', 'search'] }, path: { type: 'string' }, query: { type: 'string' } }, required: ['operation'] } },
  { name: 'get_news', description: 'Fetch latest news headlines by category.', input_schema: { type: 'object', properties: { category: { type: 'string', enum: ['general', 'technology', 'india', 'world', 'business', 'science', 'sports'] }, country: { type: 'string' } }, required: [] } },
  { name: 'get_system_info', description: 'Get system info: CPU, RAM, battery, disk, time, network, processes.', input_schema: { type: 'object', properties: { operation: { type: 'string', enum: ['time', 'info', 'battery', 'disk', 'processes', 'network', 'full_report'] } }, required: ['operation'] } },
  { name: 'fetch_page', description: 'Fetch content of a web page URL.', input_schema: { type: 'object', properties: { url: { type: 'string' } }, required: ['url'] } },
];

// ─── Provider configs ─────────────────────────────────────────────────────────
const PROVIDERS = {
  groq: {
    id: 'groq',
    label: 'Groq',
    subtitle: 'Fast & Free',
    model: 'llama-3.3-70b-versatile',
    url: 'https://api.groq.com/openai/v1/chat/completions',
    envKey: 'GROQ_API_KEY',
    badge: '⚡',
    color: '#f97316',
    description: 'Best for quick commands, music, time, weather, casual chat',
  },
  nvidia: {
    id: 'nvidia',
    label: 'NVIDIA NIM',
    subtitle: 'Powerful',
    model: 'meta/llama-3.3-70b-instruct',
    url: 'https://integrate.api.nvidia.com/v1/chat/completions',
    envKey: 'NVIDIA_API_KEY',
    badge: '🚀',
    color: '#76b900',
    description: 'Best for complex reasoning, research, analysis, coding',
  },
  gemini: {
    id: 'gemini',
    label: 'Gemini',
    subtitle: 'Backup',
    model: 'gemini-2.0-flash',
    url: 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions',
    envKey: 'GOOGLE_API_KEY',
    badge: '🔵',
    color: '#4285f4',
    description: 'Google powered — great all-rounder, free forever',
  },
  auto: {
    id: 'auto',
    label: 'Auto',
    subtitle: 'Smart Switch',
    badge: '🤖',
    color: '#00f5ff',
    description: 'FRIDAY picks the best provider based on your request',
  },
};

// Keywords that indicate a complex task → use NVIDIA
const COMPLEX_KEYWORDS = [
  'analyze', 'analysis', 'research', 'explain', 'compare', 'summarize',
  'write', 'code', 'debug', 'plan', 'strategy', 'calculate', 'detailed',
  'complex', 'deep dive', 'break down', 'help me understand', 'why does',
  'how does', 'difference between', 'pros and cons', 'essay', 'report',
];

// Current selected provider (default: groq)
let currentProvider = 'groq';

function setProvider(providerId) {
  if (PROVIDERS[providerId]) {
    currentProvider = providerId;
    console.log(`[FRIDAY] Provider switched to: ${providerId}`);
    return true;
  }
  return false;
}

function getProvider() {
  return currentProvider;
}

function getProviderInfo(providerId) {
  return PROVIDERS[providerId] || null;
}

function getAllProviders() {
  return PROVIDERS;
}

// ─── Smart auto-detection ─────────────────────────────────────────────────────
function detectComplexity(messages) {
  const lastMsg = messages[messages.length - 1];
  if (!lastMsg) return 'simple';
  const text = (typeof lastMsg.content === 'string' ? lastMsg.content : '').toLowerCase();
  const wordCount = text.split(' ').length;
  const isComplex = COMPLEX_KEYWORDS.some(kw => text.includes(kw)) || wordCount > 30;
  return isComplex ? 'complex' : 'simple';
}

// ─── OpenAI format helpers ────────────────────────────────────────────────────
function toOpenAITools(tools) {
  return tools.map(t => ({ type: 'function', function: { name: t.name, description: t.description, parameters: t.input_schema } }));
}

function toOpenAIMessages(messages, systemPrompt) {
  const result = [{ role: 'system', content: systemPrompt }];
  for (const msg of messages) {
    if (Array.isArray(msg.content)) {
      for (const block of msg.content) {
        if (block.type === 'tool_result') {
          result.push({ role: 'tool', tool_call_id: block.tool_use_id, content: block.content });
        }
      }
    } else {
      result.push({ role: msg.role, content: msg.content });
    }
  }
  return result;
}

function normalizeOpenAIResponse(data, providerLabel) {
  const choice = data.choices?.[0];
  if (!choice) throw new Error('No response from provider');
  const msg = choice.message;
  const content = [];
  if (msg.content) content.push({ type: 'text', text: msg.content });
  if (msg.tool_calls?.length > 0) {
    for (const tc of msg.tool_calls) {
      content.push({ type: 'tool_use', id: tc.id, name: tc.function.name, input: JSON.parse(tc.function.arguments || '{}') });
    }
  }
  return { content, stop_reason: msg.tool_calls?.length > 0 ? 'tool_use' : 'end_turn', provider: providerLabel };
}

// ─── Individual provider callers ──────────────────────────────────────────────
async function callProvider(providerId, messages, systemPrompt) {
  const p = PROVIDERS[providerId];
  if (!p || providerId === 'auto') throw new Error('Invalid provider');

  const apiKey = process.env[p.envKey];
  if (!apiKey) throw new Error(`${p.envKey} not set in .env`);

  const response = await fetch(p.url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: p.model,
      messages: toOpenAIMessages(messages, systemPrompt),
      tools: toOpenAITools(TOOLS),
      tool_choice: 'auto',
      max_tokens: 1024,
      temperature: 0.7,
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`${p.label} error ${response.status}: ${err}`);
  }

  const data = await response.json();
  return normalizeOpenAIResponse(data, `${p.badge} ${p.label}`);
}

// ─── Main call function ───────────────────────────────────────────────────────
async function callClaude(messages, customSystemPrompt = null) {
  const systemPrompt = customSystemPrompt || FRIDAY_SYSTEM_PROMPT;

  let providerOrder = [];

  if (currentProvider === 'auto') {
    // Smart routing: simple → groq first, complex → nvidia first
    const complexity = detectComplexity(messages);
    if (complexity === 'complex') {
      providerOrder = ['nvidia', 'groq', 'gemini'];
      console.log('[FRIDAY] 🧠 Complex task detected → trying NVIDIA first');
    } else {
      providerOrder = ['groq', 'nvidia', 'gemini'];
      console.log('[FRIDAY] ⚡ Simple task detected → trying Groq first');
    }
  } else {
    // Manual selection — try chosen provider first, then fallback
    const fallbacks = ['groq', 'nvidia', 'gemini'].filter(p => p !== currentProvider);
    providerOrder = [currentProvider, ...fallbacks];
    console.log(`[FRIDAY] Using ${currentProvider} (manual)`);
  }

  const errors = [];
  for (const providerId of providerOrder) {
    try {
      const result = await callProvider(providerId, messages, systemPrompt);
      console.log(`[FRIDAY] ✅ ${providerId} responded`);
      return result;
    } catch (err) {
      console.warn(`[FRIDAY] ❌ ${providerId} failed: ${err.message}`);
      errors.push(`${providerId}: ${err.message}`);
    }
  }

  throw new Error(`All providers failed:\n${errors.join('\n')}`);
}

module.exports = { callClaude, setProvider, getProvider, getProviderInfo, getAllProviders, FRIDAY_SYSTEM_PROMPT };
