// ============================================================
// SITE CONFIG — edit these two lines to match your GitHub repo
// ============================================================
const SITE_CONFIG = {
  githubOwner: "YOUR_GITHUB_USERNAME", // <-- change this
  githubRepo: "Travelspace",           // <-- change if your repo name is different
  branch: "main",                      // <-- change if your default branch is different (e.g. "master")
  albumsFile: "assets/data/albums.json"
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
