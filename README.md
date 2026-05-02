# F.R.I.D.A.Y
### Female Replacement Intelligent Digital Assistant Youth
> *"Good to see you, Boss."*

A personal AI voice assistant powered by Claude, built with Electron. Witty, sarcastic, and genuinely useful.

---

## 🚀 Quick Start

### 1. Install dependencies
```bash
npm install
```

### 2. Set your API keys

Create a `.env` file in the project root or set these as system environment variables:

```env
# Required
ANTHROPIC_API_KEY=sk-ant-xxxxxxxxxxxxx

# Optional — for integrations
SPOTIFY_ACCESS_TOKEN=your_spotify_token
GOOGLE_CALENDAR_TOKEN=your_google_token
```

> **How to get your Anthropic API key:**
> Go to https://console.anthropic.com → API Keys → Create Key

### 3. Launch FRIDAY
```bash
npm start
```

---

## 🎤 How to Use

| Action | How |
|--------|-----|
| Wake FRIDAY | Say **"Hey FRIDAY"** |
| Click to activate | Click the glowing circle |
| Type commands | Use the text input at the bottom |

### Example Commands

```
"Hey FRIDAY, what's the weather today?"
"Play some lo-fi music on Spotify"
"What do I have on my calendar this week?"
"Search the web for latest AI news"
"Open my Downloads folder"
"Set a meeting for tomorrow at 3pm called Project Review"
```

---

## 🔌 Integrations Setup

### Spotify
1. Go to https://developer.spotify.com/dashboard
2. Create an app
3. Get your access token via OAuth
4. Set `SPOTIFY_ACCESS_TOKEN` in your environment

### Google Calendar
1. Go to https://console.cloud.google.com
2. Enable Google Calendar API
3. Create OAuth 2.0 credentials
4. Get your access token
5. Set `GOOGLE_CALENDAR_TOKEN` in your environment

---

## 📁 Project Structure

```
FRIDAY/
├── src/
│   ├── main.js              # Electron main process
│   ├── preload.js           # Secure IPC bridge
│   ├── modules/
│   │   ├── claudeAPI.js     # Claude AI + FRIDAY personality
│   │   ├── webSearch.js     # DuckDuckGo search
│   │   ├── fileManager.js   # File operations
│   │   ├── spotify.js       # Spotify control
│   │   └── calendar.js      # Google Calendar
│   └── renderer/
│       ├── index.html       # FRIDAY UI (Iron Man HUD style)
│       └── renderer.js      # Voice + UI logic
├── assets/                  # Icons, sounds
├── package.json
└── README.md
```

---

## 🧠 Architecture

```
You speak → Wake word detected → Speech-to-Text
    → Claude AI (with tools) → Tool execution if needed
    → Response text → Text-to-Speech → FRIDAY speaks
```

**AI Brain:** Claude claude-opus-4-5 with tool use
**Voice In:** Web Speech API (browser-native, works offline)
**Voice Out:** Web Speech Synthesis API
**Wake Word:** Continuous speech recognition listening for "Hey FRIDAY"

---

## 🛣️ Roadmap

- [x] Phase 1: Core (voice I/O, Claude brain, wake word, UI)
- [x] Phase 1: Web search, Calendar, Spotify, File management
- [ ] Phase 2: Smart Home / IoT (Home Assistant integration)
- [ ] Phase 2: Persistent memory across sessions
- [ ] Phase 2: Custom wake word (Picovoice/Porcupine)
- [ ] Phase 3: Face recognition (camera)
- [ ] Phase 3: Proactive notifications

---

## ⚠️ Notes

- FRIDAY never stores passwords, API keys in conversation history
- All sensitive data stays in environment variables
- Conversation history is session-only (cleared on restart)
- File operations are sandboxed to your home directory

---

*"I prefer to think of myself as a highly sarcastic upgrade."* — FRIDAY
