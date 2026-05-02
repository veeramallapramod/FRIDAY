// modules/system.js
// Gets real system info using Node.js built-ins — no external API needed
// Works on Windows, Mac, and Linux

const os = require('os');
const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);

// ── Current Time & Date ───────────────────────────────────────────────────────
function getCurrentTime() {
  const now = new Date();
  return {
    time: now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true }),
    date: now.toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }),
    timestamp: now.toISOString(),
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  };
}

// ── System Info (CPU, RAM, OS) ────────────────────────────────────────────────
function getSystemInfo() {
  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  const usedMem = totalMem - freeMem;
  const memPercent = ((usedMem / totalMem) * 100).toFixed(1);

  const cpus = os.cpus();
  const cpuModel = cpus[0]?.model || 'Unknown CPU';
  const cpuCores = cpus.length;

  // CPU usage approximation
  const cpuLoad = os.loadavg()[0]; // 1-min load average

  const uptimeSeconds = os.uptime();
  const uptimeHours = Math.floor(uptimeSeconds / 3600);
  const uptimeMinutes = Math.floor((uptimeSeconds % 3600) / 60);

  return {
    os: {
      platform: os.platform(),
      type: os.type(),
      release: os.release(),
      arch: os.arch(),
      hostname: os.hostname(),
    },
    cpu: {
      model: cpuModel,
      cores: cpuCores,
      loadAvg: cpuLoad.toFixed(2),
    },
    memory: {
      total: formatBytes(totalMem),
      used: formatBytes(usedMem),
      free: formatBytes(freeMem),
      usedPercent: `${memPercent}%`,
    },
    uptime: `${uptimeHours}h ${uptimeMinutes}m`,
  };
}

// ── Battery Info (Windows/Mac/Linux) ─────────────────────────────────────────
async function getBatteryInfo() {
  const platform = os.platform();

  try {
    if (platform === 'win32') {
      const { stdout } = await execAsync(
        'wmic path Win32_Battery get BatteryStatus,EstimatedChargeRemaining,EstimatedRunTime /format:csv'
      );
      const lines = stdout.trim().split('\n').filter(l => l.trim() && !l.startsWith('Node'));
      if (lines.length > 0) {
        const parts = lines[0].split(',');
        return {
          percent: parts[2] ? `${parts[2].trim()}%` : 'Unknown',
          status: parts[1] === '2' ? 'Charging' : 'Discharging',
          estimatedRunTime: parts[3] ? `${parts[3].trim()} min` : 'Unknown',
        };
      }
    } else if (platform === 'darwin') {
      const { stdout } = await execAsync('pmset -g batt');
      const match = stdout.match(/(\d+)%.*?(charging|discharging|charged)/i);
      if (match) {
        return { percent: `${match[1]}%`, status: match[2] };
      }
    } else if (platform === 'linux') {
      const { stdout } = await execAsync('cat /sys/class/power_supply/BAT0/capacity 2>/dev/null && cat /sys/class/power_supply/BAT0/status 2>/dev/null');
      const lines = stdout.trim().split('\n');
      return { percent: `${lines[0]}%`, status: lines[1] || 'Unknown' };
    }
  } catch (_) {}

  return { percent: 'Unknown', status: 'No battery info available' };
}

// ── Disk Usage ────────────────────────────────────────────────────────────────
async function getDiskUsage() {
  const platform = os.platform();
  try {
    if (platform === 'win32') {
      const { stdout } = await execAsync('wmic logicaldisk get caption,freespace,size /format:csv');
      const lines = stdout.trim().split('\n').filter(l => l.trim() && !l.startsWith('Node'));
      return lines.map(line => {
        const parts = line.split(',');
        const total = parseInt(parts[3]) || 0;
        const free = parseInt(parts[2]) || 0;
        const used = total - free;
        return {
          drive: parts[1],
          total: formatBytes(total),
          used: formatBytes(used),
          free: formatBytes(free),
          usedPercent: total > 0 ? `${((used / total) * 100).toFixed(1)}%` : '0%',
        };
      }).filter(d => d.drive);
    } else {
      const { stdout } = await execAsync("df -h / | tail -1 | awk '{print $2,$3,$4,$5}'");
      const parts = stdout.trim().split(' ');
      return [{
        drive: '/',
        total: parts[0],
        used: parts[1],
        free: parts[2],
        usedPercent: parts[3],
      }];
    }
  } catch (_) {
    return [{ error: 'Could not fetch disk info' }];
  }
}

// ── Running Processes (Top 5 by memory) ──────────────────────────────────────
async function getTopProcesses() {
  const platform = os.platform();
  try {
    if (platform === 'win32') {
      const { stdout } = await execAsync(
        'wmic process get name,workingsetsize /format:csv | sort /R'
      );
      const lines = stdout.trim().split('\n')
        .filter(l => l.trim() && !l.startsWith('Node'))
        .slice(0, 5);
      return lines.map(line => {
        const parts = line.split(',');
        return { name: parts[1], memory: formatBytes(parseInt(parts[2]) || 0) };
      });
    } else {
      const { stdout } = await execAsync("ps aux --sort=-%mem | awk 'NR>1{print $11,$4}' | head -5");
      return stdout.trim().split('\n').map(line => {
        const parts = line.split(' ');
        return { name: parts[0].split('/').pop(), memPercent: parts[1] + '%' };
      });
    }
  } catch (_) {
    return [{ error: 'Could not fetch processes' }];
  }
}

// ── Network Info ──────────────────────────────────────────────────────────────
function getNetworkInfo() {
  const interfaces = os.networkInterfaces();
  const result = [];
  for (const [name, addrs] of Object.entries(interfaces)) {
    for (const addr of addrs) {
      if (!addr.internal) {
        result.push({ interface: name, ip: addr.address, family: addr.family, mac: addr.mac });
      }
    }
  }
  return result;
}

// ── Main dispatcher ───────────────────────────────────────────────────────────
async function systemOperation(operation, params = {}) {
  switch (operation) {
    case 'time':
      return getCurrentTime();
    case 'info':
      return getSystemInfo();
    case 'battery':
      return await getBatteryInfo();
    case 'disk':
      return await getDiskUsage();
    case 'processes':
      return await getTopProcesses();
    case 'network':
      return getNetworkInfo();
    case 'full_report': {
      const [info, battery, disk, network] = await Promise.all([
        getSystemInfo(),
        getBatteryInfo(),
        getDiskUsage(),
        Promise.resolve(getNetworkInfo()),
      ]);
      return { time: getCurrentTime(), system: info, battery, disk, network };
    }
    default:
      throw new Error(`Unknown system operation: ${operation}`);
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function formatBytes(bytes) {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

module.exports = { systemOperation, getCurrentTime, getSystemInfo };
