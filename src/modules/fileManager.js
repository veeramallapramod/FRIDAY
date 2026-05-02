// modules/fileManager.js
const fs = require('fs').promises;
const path = require('path');
const { shell } = require('electron');
const os = require('os');

const HOME = os.homedir();

// Safe path resolver — keeps operations within home directory
function safePath(inputPath) {
  if (!inputPath) return HOME;
  const resolved = path.resolve(HOME, inputPath.replace('~', HOME));
  return resolved;
}

async function fileOperation(operation, params = {}) {
  switch (operation) {
    case 'list': {
      const dir = safePath(params.path || '~');
      const entries = await fs.readdir(dir, { withFileTypes: true });
      return entries.map((e) => ({
        name: e.name,
        type: e.isDirectory() ? 'folder' : 'file',
        path: path.join(dir, e.name),
      })).slice(0, 20); // limit output
    }

    case 'open': {
      const filePath = safePath(params.path);
      await shell.openPath(filePath);
      return { opened: filePath };
    }

    case 'search': {
      const searchDir = safePath(params.path || '~');
      const query = (params.query || '').toLowerCase();
      const results = [];

      async function searchDir_(dir, depth = 0) {
        if (depth > 3) return; // max depth
        try {
          const entries = await fs.readdir(dir, { withFileTypes: true });
          for (const entry of entries) {
            if (entry.name.startsWith('.')) continue;
            if (entry.name.toLowerCase().includes(query)) {
              results.push({
                name: entry.name,
                type: entry.isDirectory() ? 'folder' : 'file',
                path: path.join(dir, entry.name),
              });
            }
            if (entry.isDirectory() && results.length < 10) {
              await searchDir_(path.join(dir, entry.name), depth + 1);
            }
          }
        } catch (_) {}
      }

      await searchDir_(searchDir);
      return results.slice(0, 10);
    }

    default:
      throw new Error(`Unknown file operation: ${operation}`);
  }
}

module.exports = { fileOperation };
