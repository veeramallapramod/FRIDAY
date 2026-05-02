require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const Store = require('electron-store');

// ── API Keys (fallback if .env not loading) ──────────────────────────────────
if (!process.env.GROQ_API_KEY) {
  process.env.GROQ_API_KEY = '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';
}
if (!process.env.NVIDIA_API_KEY) {
  process.env.NVIDIA_API_KEY = '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';
}
if (!process.env.GOOGLE_API_KEY) {
  process.env.GOOGLE_API_KEY = 'AIzaSyAb-NQgfwVLcxykE_HrNnvowDEbrhQVcZU';
}

const store = new Store();
let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 420,
    height: 700,
    minWidth: 380,
    minHeight: 600,
    frame: false,
    transparent: true,
    resizable: true,
    alwaysOnTop: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    backgroundColor: '#00000000',
  });

  // Load via localhost so Web Speech API works
  const { createServer } = require('http');
  const { readFileSync, existsSync } = require('fs');
  const rendererPath = path.join(__dirname, 'renderer');

  // Only create server once
  if (!global.fridayServer) {
    global.fridayServer = createServer((req, res) => {
      let filePath = req.url === '/' ? '/index.html' : req.url.split('?')[0];
      filePath = path.join(rendererPath, filePath);
      if (!existsSync(filePath)) { res.writeHead(404); res.end('Not found'); return; }
      const ext = path.extname(filePath);
      const mime = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css' }[ext] || 'text/plain';
      res.writeHead(200, { 'Content-Type': mime });
      res.end(readFileSync(filePath));
    });

    global.fridayServer.listen(3131, '127.0.0.1', () => {
      console.log('[FRIDAY] ✅ Server running on http://localhost:3131');
    });
  }

  mainWindow.loadURL('http://localhost:3131');
  mainWindow.setMenuBarVisibility(false);

  // ── Microphone permission (fixes voice commands) ──────────────────────────
  mainWindow.webContents.session.setPermissionRequestHandler((webContents, permission, callback) => {
    if (permission === 'media' || permission === 'microphone') {
      callback(true);
    } else {
      callback(false);
    }
  });

  mainWindow.webContents.session.setPermissionCheckHandler((webContents, permission) => {
    if (permission === 'media' || permission === 'microphone') {
      return true;
    }
    return false;
  });

  mainWindow.on('closed', () => { mainWindow = null; });
}

// Fix Web Speech API — loads on localhost instead of file://
app.commandLine.appendSwitch('enable-speech-dispatcher');
app.commandLine.appendSwitch('unsafely-treat-insecure-origin-as-secure', 'http://localhost:3131');

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// ─── IPC Handlers ─────────────────────────────────────────────────────────────

// Window controls
ipcMain.on('window-minimize', () => mainWindow?.minimize());
ipcMain.on('window-close', () => app.quit());

// Store
ipcMain.handle('store-get', (_, key) => store.get(key));
ipcMain.handle('store-set', (_, key, value) => store.set(key, value));

// Claude AI
ipcMain.handle('call-claude', async (_, messages, systemPrompt) => {
  try {
    const { callClaude } = require('./modules/claudeAPI');
    const response = await callClaude(messages, systemPrompt);
    return { success: true, response };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// Provider switching
ipcMain.handle('set-provider', (_, providerId) => {
  const { setProvider } = require('./modules/claudeAPI');
  return { success: setProvider(providerId) };
});

ipcMain.handle('get-provider', () => {
  const { getProvider, getAllProviders } = require('./modules/claudeAPI');
  return { current: getProvider(), providers: getAllProviders() };
});

// Web search
ipcMain.handle('web-search', async (_, query) => {
  try {
    const { webSearch } = require('./modules/webSearch');
    const results = await webSearch(query);
    return { success: true, results };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// Fetch page
ipcMain.handle('fetch-page', async (_, url) => {
  try {
    const { fetchPage } = require('./modules/webSearch');
    const result = await fetchPage(url);
    return { success: true, result };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// File management
ipcMain.handle('file-operation', async (_, operation, params) => {
  try {
    const { fileOperation } = require('./modules/fileManager');
    const result = await fileOperation(operation, params);
    return { success: true, result };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// Spotify
ipcMain.handle('spotify-control', async (_, action, params) => {
  try {
    const { spotifyControl } = require('./modules/spotify');
    const result = await spotifyControl(action, params);
    return { success: true, result };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// Calendar
ipcMain.handle('calendar-operation', async (_, operation, params) => {
  try {
    const { calendarOperation } = require('./modules/calendar');
    const result = await calendarOperation(operation, params);
    return { success: true, result };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// News
ipcMain.handle('get-news', async (_, category, country) => {
  try {
    const { getNews } = require('./modules/news');
    const result = await getNews(category, country);
    return { success: true, result };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// System info
ipcMain.handle('system-operation', async (_, operation, params) => {
  try {
    const { systemOperation } = require('./modules/system');
    const result = await systemOperation(operation, params);
    return { success: true, result };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// Groq Whisper transcription (keeps API key secure in main process)
ipcMain.handle('transcribe-audio', async (_, base64Audio) => {
  try {
    const groqKey = process.env.GROQ_API_KEY;
    if (!groqKey) throw new Error('GROQ_API_KEY not set in .env');

    // Convert base64 back to buffer
    const buffer = Buffer.from(base64Audio, 'base64');
    const FormData = require('form-data');
    const form = new FormData();
    form.append('file', buffer, { filename: 'audio.webm', contentType: 'audio/webm' });
    form.append('model', 'whisper-large-v3-turbo');
    form.append('language', 'en');
    form.append('response_format', 'json');

    const https = require('https');
    const response = await new Promise((resolve, reject) => {
      const req = https.request({
        hostname: 'api.groq.com',
        path: '/openai/v1/audio/transcriptions',
        method: 'POST',
        headers: {
          ...form.getHeaders(),
          'Authorization': `Bearer ${groqKey}`,
        },
      }, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => resolve({ status: res.statusCode, body: data }));
      });
      req.on('error', reject);
      form.pipe(req);
    });

    if (response.status !== 200) throw new Error(`Whisper error: ${response.status} — ${response.body}`);
    const result = JSON.parse(response.body);
    return { success: true, transcript: result.text?.trim() || '' };
  } catch (err) {
    console.error('[Whisper error]:', err.message);
    return { success: false, error: err.message };
  }
});

module.exports = {};
