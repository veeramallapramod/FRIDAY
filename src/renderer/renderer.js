// renderer.js — FRIDAY's brain in the renderer process
// Voice: MediaRecorder → Groq Whisper API (free, works in Electron)
// Wake word: Keyword detection via continuous recording chunks

// ─── State ────────────────────────────────────────────────────────────────────
const state = {
  listening: false,
  thinking: false,
  conversationHistory: [],
  vizInterval: null,
  mediaRecorder: null,
  audioChunks: [],
  wakeWordLoop: null,
  isWakeWordActive: false,
};

// ─── DOM ──────────────────────────────────────────────────────────────────────
const circle        = document.getElementById('friday-circle');
const circleText    = document.getElementById('circle-text');
const circleLabel   = document.getElementById('circle-label');
const messages      = document.getElementById('messages');
const textInput     = document.getElementById('text-input');
const sendBtn       = document.getElementById('send-btn');
const visualizer    = document.getElementById('visualizer');
const aiDot         = document.getElementById('ai-dot');
const aiStatus      = document.getElementById('ai-status');
const micDot        = document.getElementById('mic-dot');
const micStatus     = document.getElementById('mic-status');
const timeDisplay   = document.getElementById('time-display');
const wakeStatus    = document.getElementById('wake-status');
const wakeDot       = document.getElementById('wake-dot');

// ─── Clock ────────────────────────────────────────────────────────────────────
function updateTime() {
  const now = new Date();
  timeDisplay.textContent = now.toLocaleTimeString('en-IN', {
    hour: '2-digit', minute: '2-digit', hour12: true
  }).toUpperCase();
}
setInterval(updateTime, 1000);
updateTime();

// ─── Visualizer ───────────────────────────────────────────────────────────────
const BAR_COUNT = 30;
for (let i = 0; i < BAR_COUNT; i++) {
  const bar = document.createElement('div');
  bar.className = 'viz-bar';
  bar.style.height = '4px';
  visualizer.appendChild(bar);
}
const bars = document.querySelectorAll('.viz-bar');

function animateBars(active = false) {
  bars.forEach(bar => {
    const h = active ? Math.random() * 48 + 4 : Math.random() * 6 + 2;
    bar.style.height = h + 'px';
  });
}

function startVizAnimation(active = false) {
  stopVizAnimation();
  state.vizInterval = setInterval(() => animateBars(active), active ? 80 : 400);
}

function stopVizAnimation() {
  if (state.vizInterval) { clearInterval(state.vizInterval); state.vizInterval = null; }
  bars.forEach(bar => bar.style.height = '4px');
}

startVizAnimation(false);

// ─── Messages ─────────────────────────────────────────────────────────────────
function addMessage(role, text) {
  const typing = document.getElementById('typing-indicator');
  if (typing) typing.remove();

  const div = document.createElement('div');
  div.className = `msg ${role}`;

  if (role !== 'system') {
    const label = document.createElement('div');
    label.className = 'msg-label';
    label.textContent = role === 'user' ? 'YOU' : 'FRIDAY';
    div.appendChild(label);
  }

  const content = document.createElement('div');
  content.textContent = text;
  div.appendChild(content);
  messages.appendChild(div);
  messages.scrollTop = messages.scrollHeight;
}

function showTyping() {
  const div = document.createElement('div');
  div.className = 'msg friday';
  div.id = 'typing-indicator';
  const label = document.createElement('div');
  label.className = 'msg-label';
  label.textContent = 'FRIDAY';
  const dots = document.createElement('div');
  dots.className = 'typing-dots';
  dots.innerHTML = '<span></span><span></span><span></span>';
  div.appendChild(label);
  div.appendChild(dots);
  messages.appendChild(div);
  messages.scrollTop = messages.scrollHeight;
}

// ─── Circle States ────────────────────────────────────────────────────────────
function setCircleState(stateName) {
  circle.classList.remove('listening', 'thinking');
  switch (stateName) {
    case 'idle':
      circleText.textContent = 'F.R.I.D.A.Y';
      circleLabel.textContent = 'SAY "HEY FRIDAY" OR CLICK';
      micDot.className = 'status-dot offline';
      micStatus.textContent = 'MIC STANDBY';
      startVizAnimation(false);
      break;
    case 'listening':
      circle.classList.add('listening');
      circleText.textContent = 'LISTENING';
      circleLabel.textContent = 'SPEAK NOW, BOSS';
      micDot.className = 'status-dot';
      micStatus.textContent = 'MIC ACTIVE';
      startVizAnimation(true);
      break;
    case 'thinking':
      circle.classList.add('thinking');
      circleText.textContent = 'THINKING';
      circleLabel.textContent = 'PROCESSING...';
      startVizAnimation(false);
      break;
    case 'speaking':
      circleText.textContent = 'SPEAKING';
      circleLabel.textContent = 'FRIDAY ONLINE';
      startVizAnimation(true);
      break;
  }
}

// ─── Groq Whisper STT ─────────────────────────────────────────────────────────
// Records audio for `durationMs` ms, sends to Groq Whisper, returns transcript
async function transcribeAudio(durationMs = 5000) {
  return new Promise(async (resolve, reject) => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      const chunks = [];

      recorder.ondataavailable = e => { if (e.data.size > 0) chunks.push(e.data); };

      recorder.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        const blob = new Blob(chunks, { type: 'audio/webm' });

        try {
          const transcript = await sendToWhisper(blob);
          resolve(transcript);
        } catch (err) {
          reject(err);
        }
      };

      recorder.start();
      setTimeout(() => {
        if (recorder.state === 'recording') recorder.stop();
      }, durationMs);

    } catch (err) {
      reject(new Error('Microphone access denied: ' + err.message));
    }
  });
}

// Send audio blob to Groq Whisper API via main process (keeps API key secure)
async function sendToWhisper(audioBlob) {
  // Convert blob to base64 and send via IPC to main process
  const arrayBuffer = await audioBlob.arrayBuffer();
  const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));
  const result = await window.friday.transcribeAudio(base64);
  if (!result.success) throw new Error(result.error);
  return result.transcript || '';
}

// ─── Wake Word Detection (short recording chunks) ────────────────────────────
async function startWakeWordDetection() {
  if (state.isWakeWordActive) return;
  state.isWakeWordActive = true;
  wakeDot.className = 'status-dot';
  wakeStatus.textContent = 'LISTENING FOR WAKE WORD';
  console.log('[FRIDAY] Wake word detection started');

  async function listenChunk() {
    if (!state.isWakeWordActive || state.listening || state.thinking) {
      setTimeout(listenChunk, 1000);
      return;
    }

    try {
      // Listen for 3 seconds to check for wake word
      const transcript = await transcribeAudio(3000);
      console.log('[Wake chunk]:', transcript);

      if (transcript && (
        transcript.toLowerCase().includes('hey friday') ||
        transcript.toLowerCase().includes('friday') ||
        transcript.toLowerCase().includes('hi friday')
      )) {
        onWakeWordDetected();
        return; // stop loop, will restart after command
      }
    } catch (err) {
      console.warn('[Wake] chunk error:', err.message);
    }

    // Continue listening
    if (state.isWakeWordActive) setTimeout(listenChunk, 500);
  }

  listenChunk();
}

function stopWakeWordDetection() {
  state.isWakeWordActive = false;
  wakeDot.className = 'status-dot offline';
  wakeStatus.textContent = 'WAKE WORD OFF';
}

function onWakeWordDetected() {
  state.isWakeWordActive = false;
  addMessage('system', '[ WAKE WORD DETECTED ]');
  startListening();
}

// ─── Main Listening (after wake word) ────────────────────────────────────────
async function startListening() {
  if (state.listening) return;
  state.listening = true;
  setCircleState('listening');

  try {
    addMessage('system', '[ LISTENING... SPEAK NOW ]');
    const transcript = await transcribeAudio(6000); // 6 seconds to speak

    if (transcript && transcript.length > 1) {
      state.listening = false;
      onUserSpoke(transcript);
    } else {
      addMessage('system', '[ NO SPEECH DETECTED ]');
      state.listening = false;
      setCircleState('idle');
      setTimeout(startWakeWordDetection, 500);
    }
  } catch (err) {
    console.error('[Listen error]:', err);
    addMessage('system', `[ MIC ERROR: ${err.message} ]`);
    state.listening = false;
    setCircleState('idle');
    setTimeout(startWakeWordDetection, 1000);
  }
}

function onUserSpoke(transcript) {
  addMessage('user', transcript);
  processCommand(transcript);
  setTimeout(startWakeWordDetection, 2000);
}

// ─── TTS ──────────────────────────────────────────────────────────────────────
function speak(text) {
  return new Promise((resolve) => {
    if (!window.speechSynthesis) { resolve(); return; }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    const voices = window.speechSynthesis.getVoices();
    const preferred = voices.find(v =>
      v.name.toLowerCase().includes('zira') ||
      v.name.toLowerCase().includes('samantha') ||
      v.name.toLowerCase().includes('victoria') ||
      v.name.includes('Google UK English Female') ||
      v.name.toLowerCase().includes('female')
    ) || voices.find(v => v.lang.startsWith('en')) || voices[0];
    if (preferred) utterance.voice = preferred;
    utterance.rate = 1.05;
    utterance.pitch = 1.1;
    utterance.volume = 1;
    setCircleState('speaking');
    utterance.onend = () => { setCircleState('idle'); resolve(); };
    utterance.onerror = () => { setCircleState('idle'); resolve(); };
    window.speechSynthesis.speak(utterance);
  });
}
window.speechSynthesis?.addEventListener('voiceschanged', () => {});

// ─── AI Processing ────────────────────────────────────────────────────────────
async function processCommand(input) {
  state.thinking = true;
  setCircleState('thinking');
  showTyping();

  state.conversationHistory.push({ role: 'user', content: input });

  if (!window.friday || !window.friday.callClaude) {
    const msg = "AI bridge unavailable. Please run via Electron with npm start.";
    addMessage('friday', msg);
    state.thinking = false;
    setCircleState('idle');
    return;
  }

  try {
    const result = await window.friday.callClaude(state.conversationHistory);

    if (!result.success) throw new Error(result.error);

    const response = result.response;
    let finalText = '';

    if (response.stop_reason === 'tool_use') {
      finalText = await handleToolUse(response);
    } else {
      finalText = response.content
        .filter(b => b.type === 'text')
        .map(b => b.text)
        .join(' ');
    }

    if (finalText) {
      state.conversationHistory.push({ role: 'assistant', content: finalText });
      addMessage('friday', finalText);
      state.thinking = false;
      await speak(finalText);
    }

  } catch (err) {
    const errMsg = `Something went sideways: ${err.message}`;
    addMessage('friday', errMsg);
    state.thinking = false;
    await speak("Something went wrong, Boss. Check the terminal for details.");
  }

  setCircleState('idle');
}

async function handleToolUse(response) {
  const toolCalls = response.content.filter(b => b.type === 'tool_use');
  const toolResults = [];

  for (const tool of toolCalls) {
    let result;
    try { result = await executeTool(tool.name, tool.input); }
    catch (e) { result = { error: e.message }; }
    toolResults.push({ type: 'tool_result', tool_use_id: tool.id, content: JSON.stringify(result) });
  }

  const toolMessages = [
    ...state.conversationHistory.slice(0, -1),
    { role: 'user', content: state.conversationHistory[state.conversationHistory.length - 1].content },
    { role: 'assistant', content: response.content },
    { role: 'user', content: toolResults },
  ];

  const followUp = await window.friday.callClaude(toolMessages);
  if (!followUp.success) throw new Error(followUp.error);

  return followUp.response.content.filter(b => b.type === 'text').map(b => b.text).join(' ');
}

async function executeTool(toolName, input) {
  switch (toolName) {
    case 'web_search':         return await window.friday.webSearch(input.query);
    case 'get_calendar_events':return await window.friday.calendarOperation('list', { days_ahead: input.days_ahead });
    case 'create_calendar_event': return await window.friday.calendarOperation('create', input);
    case 'play_music':         return await window.friday.spotifyControl(input.action, { query: input.query });
    case 'file_operation':     return await window.friday.fileOperation(input.operation, input);
    case 'get_news':           return await window.friday.getNews(input.category || 'general', input.country || 'in');
    case 'get_system_info':    return await window.friday.systemOperation(input.operation);
    case 'fetch_page':         return await window.friday.fetchPage(input.url);
    default:                   return { error: `Unknown tool: ${toolName}` };
  }
}

// ─── Provider Toggle ──────────────────────────────────────────────────────────
async function initProviderToggle() {
  const btns = document.querySelectorAll('.provider-btn');
  const saved = await window.friday.storeGet('selectedProvider') || 'groq';
  await window.friday.setProvider(saved);
  setActiveBtn(saved);

  btns.forEach(btn => {
    btn.addEventListener('click', async () => {
      const providerId = btn.dataset.provider;
      await window.friday.setProvider(providerId);
      await window.friday.storeSet('selectedProvider', providerId);
      setActiveBtn(providerId);
      const labels = { groq: '⚡ Groq — fast mode', nvidia: '🚀 NVIDIA — power mode', gemini: '🔵 Gemini — backup mode', auto: '🤖 Auto — smart routing' };
      addMessage('system', `[ AI PROVIDER: ${labels[providerId] || providerId} ]`);
    });
  });
}

function setActiveBtn(providerId) {
  document.querySelectorAll('.provider-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.provider === providerId);
  });
}

// ─── UI Events ────────────────────────────────────────────────────────────────
document.getElementById('btn-min').addEventListener('click', () => window.friday?.minimize());
document.getElementById('btn-close').addEventListener('click', () => window.friday?.close());

circle.addEventListener('click', () => {
  if (!state.listening && !state.thinking) {
    addMessage('system', '[ MANUAL TRIGGER ]');
    startListening();
  }
});

sendBtn.addEventListener('click', sendText);
textInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') sendText(); });

function sendText() {
  const text = textInput.value.trim();
  if (!text || state.thinking) return;
  textInput.value = '';
  addMessage('user', text);
  processCommand(text);
}

window.friday?.onWakeWordDetected(() => onWakeWordDetected());

// ─── Startup ──────────────────────────────────────────────────────────────────
async function init() {
  if (window.friday) {
    await initProviderToggle();
  }

  setTimeout(() => {
    startWakeWordDetection();
  }, 1500);

  setTimeout(() => {
    const greetings = [
      "FRIDAY online, Boss. All systems running. What do you need?",
      "Good to see you, Boss. FRIDAY is online and ready.",
      "Systems online. Everything's perfect. You're welcome.",
    ];
    const msg = greetings[Math.floor(Math.random() * greetings.length)];
    addMessage('friday', msg);
    speak(msg);
  }, 800);
}

init();
