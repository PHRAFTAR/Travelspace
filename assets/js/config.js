// ============================================================
// SITE CONFIG — edit these two lines to match your GitHub repo
// ============================================================
const SITE_CONFIG = {
  githubOwner: "PHRAFTAR",             // <-- change this if wrong
  githubRepo: "Travelspace",           // <-- change if your repo name is different
  branch: "main",                      // <-- change if your default branch is different (e.g. "master")
  albumsFile: "assets/data/albums.json",
  siteSettingsFile: "assets/data/site-settings.json"
};

// File extensions treated as viewable media in galleries
const MEDIA_EXTENSIONS = ["jpg", "jpeg", "png", "gif", "webp", "heic", "mp4", "mov", "webm"];
const VIDEO_EXTENSIONS = ["mp4", "mov", "webm"];

function isMediaFile(filename) {
  const ext = filename.split(".").pop().toLowerCase();
  return MEDIA_EXTENSIONS.includes(ext);
}

function isVideoFile(filename) {
  const ext = filename.split(".").pop().toLowerCase();
  return VIDEO_EXTENSIONS.includes(ext);
}

// Loads the album list (raw, unauthenticated — works even without a token)
async function loadAlbums() {
  const url = `https://raw.githubusercontent.com/${SITE_CONFIG.githubOwner}/${SITE_CONFIG.githubRepo}/${SITE_CONFIG.branch}/${SITE_CONFIG.albumsFile}?t=${Date.now()}`;
  const res = await fetch(url);
  if (!res.ok) return [];
  try {
    return await res.json();
  } catch (e) {
    return [];
  }
}

// Loads which photos the owner picked for homepage hero / about / contact.
// Returns null if not set up yet (pages fall back to album covers).
async function loadSiteSettings() {
  const url = `https://raw.githubusercontent.com/${SITE_CONFIG.githubOwner}/${SITE_CONFIG.githubRepo}/${SITE_CONFIG.branch}/${SITE_CONFIG.siteSettingsFile}?t=${Date.now()}`;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    return await res.json();
  } catch (e) {
    return null;
  }
}
