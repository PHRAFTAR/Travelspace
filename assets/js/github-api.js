// ============================================================
// GitHub API helper
// Talks directly to api.github.com from the browser.
// Your token is only ever stored in YOUR browser's localStorage
// and sent to api.github.com — it is never written into any file
// that gets committed to the repo.
// ============================================================

const GH_TOKEN_KEY = "ts_gh_token_enc";

// The real GitHub token is only ever kept in memory for the current tab,
// never in plaintext in localStorage. What's stored on disk is an
// AES-256-GCM ciphertext, unlockable only with the passphrase you chose.
let sessionToken = null;

function hasStoredToken() {
  return !!localStorage.getItem(GH_TOKEN_KEY);
}
function clearStoredToken() {
  localStorage.removeItem(GH_TOKEN_KEY);
  sessionToken = null;
}
function getSessionToken() {
  return sessionToken || "";
}

function bufToB64(buf) {
  return btoa(String.fromCharCode(...new Uint8Array(buf)));
}
function b64ToBuf(b64) {
  return Uint8Array.from(atob(b64), c => c.charCodeAt(0));
}

async function deriveKey(passphrase, salt) {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw", enc.encode(passphrase), "PBKDF2", false, ["deriveKey"]
  );
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt, iterations: 150000, hash: "SHA-256" },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

// Encrypts the GitHub token with a passphrase you choose, and stores the
// ciphertext locally. Call this once, the first time you connect.
async function setupToken(githubToken, passphrase) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(passphrase, salt);
  const enc = new TextEncoder();
  const cipherBuf = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, enc.encode(githubToken));
  const payload = { salt: bufToB64(salt), iv: bufToB64(iv), data: bufToB64(cipherBuf) };
  localStorage.setItem(GH_TOKEN_KEY, JSON.stringify(payload));
  sessionToken = githubToken;
}

// Unlocks the stored, encrypted token using your passphrase.
// Returns true if it worked, false if the passphrase was wrong.
async function unlockToken(passphrase) {
  const raw = localStorage.getItem(GH_TOKEN_KEY);
  if (!raw) return false;
  try {
    const payload = JSON.parse(raw);
    const salt = b64ToBuf(payload.salt);
    const iv = b64ToBuf(payload.iv);
    const data = b64ToBuf(payload.data);
    const key = await deriveKey(passphrase, salt);
    const plainBuf = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, data);
    sessionToken = new TextDecoder().decode(plainBuf);
    return true;
  } catch (e) {
    sessionToken = null;
    return false; // wrong passphrase, or corrupted data
  }
}

function apiBase() {
  return `https://api.github.com/repos/${SITE_CONFIG.githubOwner}/${SITE_CONFIG.githubRepo}`;
}

function encodePath(path) {
  return path.split("/").map(encodeURIComponent).join("/");
}

function authHeaders(extra = {}) {
  const token = getSessionToken();
  const headers = { ...extra };
  if (token) headers["Authorization"] = `token ${token}`;
  return headers;
}

// List files in a folder. Returns [] only if the folder genuinely doesn't
// exist (404). Throws on real failures so pages can show a clear error
// instead of silently claiming the album is empty.
async function ghListFolder(path) {
  let liveStatus = null;
  try {
    const res = await fetch(
      `${apiBase()}/contents/${encodePath(path)}?ref=${SITE_CONFIG.branch}`,
      { headers: authHeaders() }
    );
    liveStatus = res.status;
    if (res.status === 404) return [];
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data)) return data;
    }
  } catch (e) { /* network error, try local fallback below */ }

  try {
    const localRes = await fetch(`/api/local-folder?path=${encodeURIComponent(path)}`);
    if (localRes.ok) {
      const data = await localRes.json();
      if (Array.isArray(data)) return data;
    }
  } catch (e) { /* no local server available, that's expected on GitHub Pages */ }

  throw new Error(liveStatus ? `GitHub error ${liveStatus}` : "Could not reach GitHub");
}

// Get a single file's metadata + content (needed to obtain its "sha" for updates)
async function ghGetFile(path) {
  const res = await fetch(
    `${apiBase()}/contents/${encodePath(path)}?ref=${SITE_CONFIG.branch}`,
    { headers: authHeaders() }
  );
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`GitHub error ${res.status}: ${res.statusText}`);
  return res.json();
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(",")[1]);
    reader.onerror = () => reject(new Error("Could not read file"));
    reader.readAsDataURL(file);
  });
}

// Upload (create or overwrite) a binary file, e.g. a photo
async function ghUploadFile(path, file, message) {
  const token = getSessionToken();
  if (!token) throw new Error("NO_TOKEN");

  const content = await fileToBase64(file);
  const existing = await ghGetFile(path).catch(() => null);

  const body = {
    message,
    content,
    branch: SITE_CONFIG.branch
  };
  if (existing && existing.sha) body.sha = existing.sha;

  const res = await fetch(`${apiBase()}/contents/${encodePath(path)}`, {
    method: "PUT",
    headers: authHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(body)
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    if (res.status === 401) throw new Error("Token invalid or expired. Please re-enter it.");
    if (res.status === 403) throw new Error("Token doesn't have write access to this repo (check scope).");
    throw new Error(err.message || `Upload failed (${res.status})`);
  }
  return res.json();
}

// Update a text/JSON file (used for albums.json when a new album is created)
async function ghUpdateTextFile(path, newTextContent, message) {
  const token = getSessionToken();
  if (!token) throw new Error("NO_TOKEN");

  const existing = await ghGetFile(path).catch(() => null);
  const body = {
    message,
    content: btoa(unescape(encodeURIComponent(newTextContent))),
    branch: SITE_CONFIG.branch
  };
  if (existing && existing.sha) body.sha = existing.sha;

  const res = await fetch(`${apiBase()}/contents/${encodePath(path)}`, {
    method: "PUT",
    headers: authHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(body)
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || `Could not update ${path} (${res.status})`);
  }
  return res.json();
}

// Delete a file from the repo (used by the delete button on album pages)
async function ghDeleteFile(path, sha, message) {
  const res = await fetch(`${apiBase()}/contents/${encodePath(path)}`, {
    method: "DELETE",
    headers: authHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({ message, sha, branch: SITE_CONFIG.branch })
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    if (res.status === 401) throw new Error("Token invalid or expired. Please re-enter it.");
    if (res.status === 403) throw new Error("Token doesn't have write access to this repo.");
    throw new Error(err.message || `Delete failed (${res.status})`);
  }
  return res.json();
}

// Quick check that a token actually works and can write to this repo
async function ghVerifyToken() {
  const res = await fetch(apiBase(), { headers: authHeaders() });
  if (!res.ok) return { ok: false, reason: `Repo not reachable (${res.status})` };
  const data = await res.json();
  if (!data.permissions || !data.permissions.push) {
    return { ok: false, reason: "Token can read but not write to this repo." };
  }
  return { ok: true };
}
