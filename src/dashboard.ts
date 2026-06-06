import http from "http";
import crypto from "crypto";
import { SSDiskDBClient } from "./index";

export interface DashboardServer {
  close(): Promise<void>;
}

// Function to generate the HTML for the dashboard
function getDashboardHtml(username: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>SSDiskDB Insights Dashboard</title>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">
  <style>
    :root {
      --bg-color: #0f172a;
      --card-bg: #1e293b;
      --border-color: #334155;
      --text-main: #f8fafc;
      --text-muted: #94a3b8;
      --accent-blue: #3b82f6;
      --accent-green: #10b981;
      --accent-red: #ef4444;
      --accent-yellow: #f59e0b;
      --font-family: 'Inter', -apple-system, sans-serif;
    }

    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    body {
      background-color: var(--bg-color);
      color: var(--text-main);
      font-family: var(--font-family);
      line-height: 1.5;
      padding: 2rem;
    }

    header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 2rem;
      border-bottom: 1px solid var(--border-color);
      padding-bottom: 1.5rem;
    }

    h1 {
      font-size: 1.8rem;
      font-weight: 700;
      background: linear-gradient(to right, #60a5fa, #34d399);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }

    .user-info {
      display: flex;
      align-items: center;
      gap: 1rem;
      font-size: 0.9rem;
      color: var(--text-muted);
    }

    .btn {
      padding: 0.5rem 1rem;
      border-radius: 0.375rem;
      font-weight: 500;
      font-size: 0.875rem;
      cursor: pointer;
      border: none;
      transition: all 0.2s ease;
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
    }

    .btn-primary {
      background-color: var(--accent-blue);
      color: white;
    }

    .btn-primary:hover {
      background-color: #2563eb;
    }

    .btn-success {
      background-color: var(--accent-green);
      color: white;
    }

    .btn-success:hover {
      background-color: #059669;
    }

    .btn-danger {
      background-color: var(--accent-red);
      color: white;
    }

    .btn-danger:hover {
      background-color: #dc2626;
    }

    .btn-secondary {
      background-color: transparent;
      border: 1px solid var(--border-color);
      color: var(--text-main);
    }

    .btn-secondary:hover {
      background-color: var(--card-bg);
    }

    .stats-container {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      gap: 1.5rem;
      margin-bottom: 2rem;
    }

    .stat-card {
      background-color: var(--card-bg);
      border: 1px solid var(--border-color);
      border-radius: 0.5rem;
      padding: 1.5rem;
      position: relative;
      overflow: hidden;
    }

    .stat-card::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      width: 4px;
      height: 100%;
      background: var(--accent-blue);
    }

    .stat-card.green::before {
      background: var(--accent-green);
    }

    .stat-card.red::before {
      background: var(--accent-red);
    }

    .stat-title {
      font-size: 0.875rem;
      color: var(--text-muted);
      text-transform: uppercase;
      letter-spacing: 0.05em;
      margin-bottom: 0.5rem;
    }

    .stat-value {
      font-size: 1.8rem;
      font-weight: 700;
    }

    .main-content {
      background-color: var(--card-bg);
      border: 1px solid var(--border-color);
      border-radius: 0.5rem;
      padding: 1.5rem;
    }

    .toolbar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 1.5rem;
      gap: 1rem;
      flex-wrap: wrap;
    }

    .search-input {
      padding: 0.5rem 1rem;
      border-radius: 0.375rem;
      border: 1px solid var(--border-color);
      background-color: var(--bg-color);
      color: var(--text-main);
      font-size: 0.875rem;
      width: 100%;
      max-width: 300px;
    }

    .search-input:focus {
      outline: none;
      border-color: var(--accent-blue);
    }

    .table-container {
      overflow-x: auto;
    }

    table {
      width: 100%;
      border-collapse: collapse;
      text-align: left;
      font-size: 0.9rem;
    }

    th {
      background-color: var(--bg-color);
      color: var(--text-muted);
      font-weight: 600;
      padding: 1rem;
      border-bottom: 1px solid var(--border-color);
    }

    td {
      padding: 1rem;
      border-bottom: 1px solid var(--border-color);
      vertical-align: middle;
    }

    tr:hover td {
      background-color: rgba(255, 255, 255, 0.02);
    }

    .badge {
      display: inline-block;
      padding: 0.25rem 0.5rem;
      font-size: 0.75rem;
      font-weight: 600;
      border-radius: 0.25rem;
      text-transform: uppercase;
    }

    .badge-string { background-color: rgba(59, 130, 246, 0.2); color: #60a5fa; }
    .badge-hash { background-color: rgba(16, 185, 129, 0.2); color: #34d399; }
    .badge-zset { background-color: rgba(245, 158, 11, 0.2); color: #fbbf24; }

    .key-name {
      font-family: monospace;
      font-weight: 600;
      word-break: break-all;
    }

    .key-value {
      font-family: monospace;
      color: var(--text-muted);
      max-width: 300px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .actions {
      display: flex;
      gap: 0.5rem;
    }

    /* Modal styles */
    .modal-backdrop {
      position: fixed;
      top: 0;
      left: 0;
      width: 100vw;
      height: 100vh;
      background-color: rgba(15, 23, 42, 0.8);
      display: none;
      justify-content: center;
      align-items: center;
      z-index: 1000;
      backdrop-filter: blur(4px);
    }

    .modal {
      background-color: var(--card-bg);
      border: 1px solid var(--border-color);
      border-radius: 0.5rem;
      width: 100%;
      max-width: 500px;
      padding: 1.5rem;
      box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5);
      animation: slideDown 0.2s ease-out;
    }

    @keyframes slideDown {
      from { transform: translateY(-20px); opacity: 0; }
      to { transform: translateY(0); opacity: 1; }
    }

    .modal-title {
      font-size: 1.25rem;
      font-weight: 600;
      margin-bottom: 1rem;
      border-bottom: 1px solid var(--border-color);
      padding-bottom: 0.5rem;
    }

    .form-group {
      margin-bottom: 1rem;
    }

    .form-group label {
      display: block;
      font-size: 0.875rem;
      color: var(--text-muted);
      margin-bottom: 0.5rem;
    }

    .form-control {
      width: 100%;
      padding: 0.5rem;
      border-radius: 0.375rem;
      border: 1px solid var(--border-color);
      background-color: var(--bg-color);
      color: var(--text-main);
      font-size: 0.875rem;
    }

    .form-control:focus {
      outline: none;
      border-color: var(--accent-blue);
    }

    .modal-actions {
      display: flex;
      justify-content: flex-end;
      gap: 0.5rem;
      margin-top: 1.5rem;
    }

    .toast {
      position: fixed;
      bottom: 2rem;
      right: 2rem;
      padding: 1rem 1.5rem;
      background-color: var(--card-bg);
      border-left: 4px solid var(--accent-green);
      border-radius: 0.25rem;
      box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.5);
      display: none;
      z-index: 2000;
      font-size: 0.875rem;
    }

    .toast.error {
      border-left-color: var(--accent-red);
    }
  </style>
</head>
<body>
  <header>
    <div>
      <h1>SSDiskDB Insights</h1>
      <p style="font-size: 0.875rem; color: var(--text-muted);">Local Embedded Cache Console</p>
    </div>
    <div class="user-info">
      <span>User: <strong>${username}</strong></span>
      <button class="btn btn-secondary" onclick="logout()">Logout</button>
    </div>
  </header>

  <div class="stats-container">
    <div class="stat-card">
      <div class="stat-title">Total Keys</div>
      <div class="stat-value" id="stat-total-keys">0</div>
    </div>
    <div class="stat-card green">
      <div class="stat-title">Database Mode</div>
      <div class="stat-value">LevelDB (Local)</div>
    </div>
    <div class="stat-card">
      <div class="stat-title">Server Status</div>
      <div class="stat-value" style="color: var(--accent-green)">Online</div>
    </div>
  </div>

  <div class="main-content">
    <div class="toolbar">
      <input type="text" class="search-input" id="search-bar" placeholder="Search keys..." oninput="filterKeys()">
      <div style="display: flex; gap: 0.5rem;">
        <button class="btn btn-secondary" onclick="loadKeys()">
          Refresh
        </button>
        <button class="btn btn-success" onclick="openAddModal()">
          Add Key
        </button>
        <button class="btn btn-danger" onclick="openFlushModal()">
          Flush Cache
        </button>
      </div>
    </div>

    <div class="table-container">
      <table>
        <thead>
          <tr>
            <th>Type</th>
            <th>Key Name</th>
            <th>Value / Details</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody id="keys-table-body">
          <!-- Dynamically filled -->
        </tbody>
      </table>
    </div>
  </div>

  <!-- Add Modal -->
  <div class="modal-backdrop" id="add-modal">
    <div class="modal">
      <div class="modal-title">Add / Edit Cache Entry</div>
      <div class="form-group">
        <label for="new-key-type">Entry Type</label>
        <select class="form-control" id="new-key-type" onchange="toggleFormInputs()">
          <option value="string">String (Key-Value)</option>
          <option value="hash">Hash (Map)</option>
          <option value="zset">Sorted Set (Zset)</option>
        </select>
      </div>
      <div class="form-group" id="group-hash-name" style="display: none;">
        <label for="new-hash-name">Hash Name</label>
        <input type="text" class="form-control" id="new-hash-name" placeholder="e.g. user:100">
      </div>
      <div class="form-group" id="group-zset-name" style="display: none;">
        <label for="new-zset-name">Set Name</label>
        <input type="text" class="form-control" id="new-zset-name" placeholder="e.g. user_scores">
      </div>
      <div class="form-group">
        <label for="new-key-name" id="label-key-name">Key / Member Name</label>
        <input type="text" class="form-control" id="new-key-name" placeholder="e.g. session_id">
      </div>
      <div class="form-group" id="group-key-val">
        <label for="new-key-value">Value (JSON/String)</label>
        <textarea class="form-control" id="new-key-value" rows="3" placeholder='e.g. "my-val" or {"active": true}'></textarea>
      </div>
      <div class="form-group" id="group-zset-score" style="display: none;">
        <label for="new-zset-score">Score (Number)</label>
        <input type="number" class="form-control" id="new-zset-score" placeholder="e.g. 100">
      </div>
      <div class="modal-actions">
        <button class="btn btn-secondary" onclick="closeAddModal()">Cancel</button>
        <button class="btn btn-success" onclick="saveKey()">Save Entry</button>
      </div>
    </div>
  </div>

  <!-- Detail Modal -->
  <div class="modal-backdrop" id="detail-modal">
    <div class="modal">
      <div class="modal-title">Cache Entry Details</div>
      <div class="form-group">
        <label>Full Prefixed Key</label>
        <input type="text" class="form-control" id="detail-full-key" readonly>
      </div>
      <div class="form-group">
        <label>Decrypted & Deserialized Value</label>
        <pre id="detail-value" style="background-color: var(--bg-color); padding: 1rem; border-radius: 0.375rem; overflow-x: auto; font-family: monospace; font-size: 0.85rem; border: 1px solid var(--border-color); max-height: 250px; overflow-y: auto;"></pre>
      </div>
      <div class="modal-actions">
        <button class="btn btn-secondary" onclick="closeDetailModal()">Close</button>
      </div>
    </div>
  </div>

  <!-- Flush Confirmation Modal -->
  <div class="modal-backdrop" id="flush-modal">
    <div class="modal">
      <div class="modal-title" style="color: var(--accent-red);">Flush Cache Database?</div>
      <p style="margin-bottom: 1.5rem; font-size: 0.9rem; color: var(--text-muted);">This action will permanently delete all keys in the database. Credentials and configuration will be preserved.</p>
      <div class="modal-actions">
        <button class="btn btn-secondary" onclick="closeFlushModal()">Cancel</button>
        <button class="btn btn-danger" onclick="flushDatabase()">Flush Everything</button>
      </div>
    </div>
  </div>

  <div class="toast" id="toast">Database updated successfully</div>

  <script>
    let allKeys = [];

    async function loadKeys() {
      try {
        const res = await fetch('/api/keys');
        if (res.status === 401) {
          window.location.reload();
          return;
        }
        allKeys = await res.json();
        renderKeysTable(allKeys);
      } catch (err) {
        showToast('Failed to load keys', true);
      }
    }

    function renderKeysTable(keys) {
      const tbody = document.getElementById('keys-table-body');
      tbody.innerHTML = '';

      document.getElementById('stat-total-keys').innerText = keys.length;

      if (keys.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" style="text-align: center; color: var(--text-muted); padding: 2rem;">No cache keys found.</td></tr>';
        return;
      }

      keys.forEach(item => {
        const tr = document.createElement('tr');
        
        let typeBadge = '';
        let displayKey = item.key;
        let displayVal = JSON.stringify(item.value);

        if (item.key.startsWith('s:')) {
          typeBadge = '<span class="badge badge-string">String</span>';
          displayKey = item.key.substring(2);
        } else if (item.key.startsWith('h:')) {
          typeBadge = '<span class="badge badge-hash">Hash</span>';
          displayKey = item.key.substring(2);
        } else if (item.key.startsWith('z:')) {
          typeBadge = '<span class="badge badge-zset">Sorted Set</span>';
          displayKey = item.key.substring(2);
        }

        tr.innerHTML = \`
          <td>\${typeBadge}</td>
          <td class="key-name">\${escapeHtml(displayKey)}</td>
          <td><div class="key-value">\${escapeHtml(displayVal)}</div></td>
          <td class="actions">
            <button class="btn btn-secondary" style="padding: 0.25rem 0.5rem;" onclick="viewDetail('\${item.key}')">View</button>
            <button class="btn btn-danger" style="padding: 0.25rem 0.5rem;" onclick="deleteKey('\${item.key}')">Delete</button>
          </td>
        \`;
        tbody.appendChild(tr);
      });
    }

    function escapeHtml(text) {
      if (text === null || text === undefined) return '';
      return String(text)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
    }

    function filterKeys() {
      const query = document.getElementById('search-bar').value.toLowerCase();
      const filtered = allKeys.filter(item => item.key.toLowerCase().includes(query));
      renderKeysTable(filtered);
    }

    function showToast(message, isError = false) {
      const toast = document.getElementById('toast');
      toast.innerText = message;
      toast.style.display = 'block';
      if (isError) {
        toast.classList.add('error');
      } else {
        toast.classList.remove('error');
      }
      setTimeout(() => {
        toast.style.display = 'none';
      }, 3000);
    }

    // Modal helpers
    function openAddModal() {
      document.getElementById('add-modal').style.display = 'flex';
      toggleFormInputs();
    }
    function closeAddModal() {
      document.getElementById('add-modal').style.display = 'none';
      document.getElementById('new-key-name').value = '';
      document.getElementById('new-key-value').value = '';
      document.getElementById('new-hash-name').value = '';
      document.getElementById('new-zset-name').value = '';
      document.getElementById('new-zset-score').value = '';
    }

    function toggleFormInputs() {
      const type = document.getElementById('new-key-type').value;
      const groupHash = document.getElementById('group-hash-name');
      const groupZset = document.getElementById('group-zset-name');
      const groupVal = document.getElementById('group-key-val');
      const groupScore = document.getElementById('group-zset-score');
      const labelKey = document.getElementById('label-key-name');

      if (type === 'string') {
        groupHash.style.display = 'none';
        groupZset.style.display = 'none';
        groupVal.style.display = 'block';
        groupScore.style.display = 'none';
        labelKey.innerText = 'Key Name';
      } else if (type === 'hash') {
        groupHash.style.display = 'block';
        groupZset.style.display = 'none';
        groupVal.style.display = 'block';
        groupScore.style.display = 'none';
        labelKey.innerText = 'Field Name';
      } else if (type === 'zset') {
        groupHash.style.display = 'none';
        groupZset.style.display = 'block';
        groupVal.style.display = 'none';
        groupScore.style.display = 'block';
        labelKey.innerText = 'Member Name';
      }
    }

    async function saveKey() {
      const type = document.getElementById('new-key-type').value;
      const keyName = document.getElementById('new-key-name').value.trim();
      const rawVal = document.getElementById('new-key-value').value.trim();
      const hashName = document.getElementById('new-hash-name').value.trim();
      const zsetName = document.getElementById('new-zset-name').value.trim();
      const score = document.getElementById('new-zset-score').value;

      if (!keyName) {
        showToast('Please enter a key or member name', true);
        return;
      }

      let payload = {};

      if (type === 'string') {
        let value = rawVal;
        try {
          value = JSON.parse(rawVal);
        } catch (e) {
          // If not valid JSON, treat as raw string
        }
        payload = { type, key: keyName, value };
      } else if (type === 'hash') {
        if (!hashName) {
          showToast('Please enter a hash name', true);
          return;
        }
        let value = rawVal;
        try {
          value = JSON.parse(rawVal);
        } catch (e) {
          // Treat as raw string
        }
        payload = { type, name: hashName, key: keyName, value };
      } else if (type === 'zset') {
        if (!zsetName) {
          showToast('Please enter a sorted set name', true);
          return;
        }
        if (score === '') {
          showToast('Please enter a score', true);
          return;
        }
        payload = { type, name: zsetName, key: keyName, score: parseFloat(score) };
      }

      try {
        const res = await fetch('/api/keys', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        if (res.ok) {
          showToast('Key saved successfully');
          closeAddModal();
          loadKeys();
        } else {
          const text = await res.text();
          showToast('Failed to save key: ' + text, true);
        }
      } catch (err) {
        showToast('Server error during save', true);
      }
    }

    async function deleteKey(prefixedKey) {
      if (!confirm('Are you sure you want to delete ' + prefixedKey + '?')) return;

      try {
        const res = await fetch('/api/keys', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ key: prefixedKey })
        });
        if (res.ok) {
          showToast('Key deleted');
          loadKeys();
        } else {
          showToast('Failed to delete key', true);
        }
      } catch (err) {
        showToast('Server error during delete', true);
      }
    }

    function viewDetail(prefixedKey) {
      const item = allKeys.find(k => k.key === prefixedKey);
      if (!item) return;

      document.getElementById('detail-full-key').value = item.key;
      document.getElementById('detail-value').innerText = JSON.stringify(item.value, null, 2);
      document.getElementById('detail-modal').style.display = 'flex';
    }

    function closeDetailModal() {
      document.getElementById('detail-modal').style.display = 'none';
    }

    function openFlushModal() {
      document.getElementById('flush-modal').style.display = 'flex';
    }
    function closeFlushModal() {
      document.getElementById('flush-modal').style.display = 'none';
    }

    async function flushDatabase() {
      try {
        const res = await fetch('/api/flush', { method: 'POST' });
        if (res.ok) {
          showToast('Database flushed successfully');
          closeFlushModal();
          loadKeys();
        } else {
          showToast('Failed to flush database', true);
        }
      } catch (err) {
        showToast('Server error during flush', true);
      }
    }

    function logout() {
      // Browsers do not have a built-in Basic Auth logout,
      // but making a request with invalid credentials triggers a reset.
      var xmlhttp = new XMLHttpRequest();
      xmlhttp.open("GET", "/api/keys", true, "logout", "logout");
      xmlhttp.send();
      xmlhttp.onreadystatechange = function() {
        if (xmlhttp.status == 401) {
          window.location.reload();
        }
      }
    }

    // Load keys on start
    window.onload = loadKeys;
  </script>
</body>
</html>`;
}

export function startDashboardServer(
  client: SSDiskDBClient,
  port: number,
  getCredentials: () => Promise<{ username: string; passwordHash: string }>
): Promise<DashboardServer> {
  return new Promise((resolve, reject) => {
    const server = http.createServer(async (req, res) => {
      // 1. Basic Auth check
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith("Basic ")) {
        res.writeHead(401, {
          "WWW-Authenticate": 'Basic realm="SSDiskDB Dashboard"',
          "Content-Type": "text/plain"
        });
        res.end("Unauthorized");
        return;
      }

      // Parse credentials
      const token = authHeader.substring(6);
      const decoded = Buffer.from(token, "base64").toString("utf8");
      const parts = decoded.split(":");
      const reqUsername = parts[0];
      const reqPassword = parts[1] || "";

      // Load stored credentials
      const creds = await getCredentials();
      const inputHash = crypto.createHash("sha256").update(reqPassword).digest("hex");

      if (reqUsername !== creds.username || inputHash !== creds.passwordHash) {
        res.writeHead(401, {
          "WWW-Authenticate": 'Basic realm="SSDiskDB Dashboard"',
          "Content-Type": "text/plain"
        });
        res.end("Unauthorized");
        return;
      }

      const url = req.url || "/";
      const method = req.method || "GET";

      // Serve UI
      if (url === "/" || url === "/index.html") {
        res.writeHead(200, { "Content-Type": "text/html" });
        res.end(getDashboardHtml(creds.username));
        return;
      }

      // API: Get all keys
      if (url === "/api/keys" && method === "GET") {
        try {
          if (typeof (client as any).getAllKeys === "function") {
            const list = await (client as any).getAllKeys();
            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(JSON.stringify(list));
          } else {
            // Fallback if client doesn't support list (e.g. remote SSDB without keys support in wrapper)
            res.writeHead(501, { "Content-Type": "text/plain" });
            res.end("Not implemented for this connection type");
          }
        } catch (e: any) {
          res.writeHead(500, { "Content-Type": "text/plain" });
          res.end("Error fetching keys: " + e.message);
        }
        return;
      }

      // API: Save key-value
      if (url === "/api/keys" && method === "POST") {
        let body = "";
        req.on("data", chunk => { body += chunk; });
        req.on("end", async () => {
          try {
            const payload = JSON.parse(body);
            if (payload.type === "string") {
              await client.set(payload.key, payload.value);
            } else if (payload.type === "hash") {
              await client.hset(payload.name, payload.key, payload.value);
            } else if (payload.type === "zset") {
              await client.zset(payload.name, payload.key, payload.score);
            } else {
              res.writeHead(400, { "Content-Type": "text/plain" });
              res.end("Invalid type");
              return;
            }
            res.writeHead(200, { "Content-Type": "text/plain" });
            res.end("OK");
          } catch (e: any) {
            res.writeHead(500, { "Content-Type": "text/plain" });
            res.end("Error saving key: " + e.message);
          }
        });
        return;
      }

      // API: Delete key
      if (url === "/api/keys" && method === "DELETE") {
        let body = "";
        req.on("data", chunk => { body += chunk; });
        req.on("end", async () => {
          try {
            const payload = JSON.parse(body);
            const prefixedKey = payload.key as string; // e.g. "s:mykey" or "h:myhash:field"
            if (prefixedKey.startsWith("s:")) {
              await client.del(prefixedKey.substring(2));
            } else if (prefixedKey.startsWith("h:")) {
              const parts = prefixedKey.substring(2).split(":");
              const name = parts[0];
              const key = parts.slice(1).join(":");
              await client.hdel(name, key);
            } else if (prefixedKey.startsWith("z:")) {
              const parts = prefixedKey.substring(2).split(":");
              const name = parts[0];
              const key = parts.slice(1).join(":");
              await client.zdel(name, key);
            } else {
              res.writeHead(400, { "Content-Type": "text/plain" });
              res.end("Invalid key prefix");
              return;
            }
            res.writeHead(200, { "Content-Type": "text/plain" });
            res.end("OK");
          } catch (e: any) {
            res.writeHead(500, { "Content-Type": "text/plain" });
            res.end("Error deleting key: " + e.message);
          }
        });
        return;
      }

      // API: Flush database
      if (url === "/api/flush" && method === "POST") {
        try {
          if (typeof (client as any).flush === "function") {
            await (client as any).flush();
            res.writeHead(200, { "Content-Type": "text/plain" });
            res.end("OK");
          } else {
            res.writeHead(501, { "Content-Type": "text/plain" });
            res.end("Not implemented for this connection type");
          }
        } catch (e: any) {
          res.writeHead(500, { "Content-Type": "text/plain" });
          res.end("Error flushing db: " + e.message);
        }
        return;
      }

      res.writeHead(404, { "Content-Type": "text/plain" });
      res.end("Not Found");
    });

    server.listen(port, () => {
      resolve({
        close: () => {
          return new Promise<void>((res, rej) => {
            server.close(err => {
              if (err) rej(err);
              else res();
            });
          });
        }
      });
    });

    server.on("error", reject);
  });
}
