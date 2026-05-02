const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('friday', {
  // Window controls
  minimize: () => ipcRenderer.send('window-minimize'),
  close: () => ipcRenderer.send('window-close'),

  // Store
  storeGet: (key) => ipcRenderer.invoke('store-get', key),
  storeSet: (key, value) => ipcRenderer.invoke('store-set', key, value),

  // AI
  callClaude: (messages, systemPrompt) =>
    ipcRenderer.invoke('call-claude', messages, systemPrompt),

  // Integrations
  webSearch: (query) => ipcRenderer.invoke('web-search', query),
  fileOperation: (operation, params) =>
    ipcRenderer.invoke('file-operation', operation, params),
  spotifyControl: (action, params) =>
    ipcRenderer.invoke('spotify-control', action, params),
  calendarOperation: (operation, params) =>
    ipcRenderer.invoke('calendar-operation', operation, params),

  // Whisper transcription (secure — API key stays in main process)
  transcribeAudio: (base64Audio) => ipcRenderer.invoke('transcribe-audio', base64Audio),

  // Provider switching
  setProvider: (providerId) => ipcRenderer.invoke('set-provider', providerId),
  getProvider: () => ipcRenderer.invoke('get-provider'),

  // News
  getNews: (category, country) =>
    ipcRenderer.invoke('get-news', category, country),

  // System
  systemOperation: (operation, params) =>
    ipcRenderer.invoke('system-operation', operation, params),

  // Fetch page
  fetchPage: (url) =>
    ipcRenderer.invoke('fetch-page', url),

  // Events from main
  onWakeWordDetected: (callback) =>
    ipcRenderer.on('wake-word-detected', callback),
  onFridayResponse: (callback) =>
    ipcRenderer.on('friday-response', callback),
});
