let queuedFiles = [];
let albumsCache = [];

document.addEventListener("DOMContentLoaded", async () => {
  initTokenUI();
  initAlbumSelect();
  initDropzone();

  document.getElementById("upload-btn").addEventListener("click", startUpload);
});

const ALLOWED_USERNAME = "Priyanshu.Sharma";
const USERNAME_KEY = "ts_username";

/* ---------------- Login: username + password-locked GitHub token ---------------- */
function initTokenUI() {
  const pill = document.getElementById("token-status");
  const setupBlock = document.getElementById("token-setup");
  const unlockBlock = document.getElementById("token-unlock");

  function showSetup(message) {
    setupBlock.style.display = "flex";
    unlockBlock.style.display = "none";
    setPill(pill, "pending", message || "Not set up yet");
  }
  function showUnlock(message) {
    setupBlock.style.display = "none";
    unlockBlock.style.display = "flex";
    setPill(pill, "pending", message || "Locked");
    const savedUser = localStorage.getItem(USERNAME_KEY);
    if (savedUser) document.getElementById("unlock-username").value = savedUser;
  }

  if (hasStoredToken()) showUnlock(); else showSetup();

  // First-time setup
  document.getElementById("setup-btn").addEventListener("click", async () => {
    const username = document.getElementById("setup-username").value.trim();
    const token = document.getElementById("setup-token").value.trim();
    const pass1 = document.getElementById("setup-pass").value;
    const pass2 = document.getElementById("setup-pass-confirm").value;

    if (username !== ALLOWED_USERNAME) return setPill(pill, "bad", "Unknown username");
    if (!token) return setPill(pill, "bad", "Paste your GitHub token first");
    if (pass1.length < 4) return setPill(pill, "bad", "Password should be at least 4 characters");
    if (pass1 !== pass2) return setPill(pill, "bad", "Passwords don't match");

    setPill(pill, "pending", "Checking token with GitHub…");
    sessionToken = token; // temporarily, just to verify it works
    try {
      const result = await ghVerifyToken();
      if (!result.ok) {
        sessionToken = null;
        return setPill(pill, "bad", result.reason);
      }
    } catch (e) {
      sessionToken = null;
      return setPill(pill, "bad", "Could not reach GitHub");
    }

    await setupToken(token, pass1);
    localStorage.setItem(USERNAME_KEY, username);
    document.getElementById("setup-token").value = "";
    document.getElementById("setup-pass").value = "";
    document.getElementById("setup-pass-confirm").value = "";
    setPill(pill, "ok", "Logged in — you can now upload");
    initSitePhotos();
  });

  // Returning visit: login with username + password
  document.getElementById("unlock-btn").addEventListener("click", async () => {
    const username = document.getElementById("unlock-username").value.trim();
    const pass = document.getElementById("unlock-pass").value;
    const savedUser = localStorage.getItem(USERNAME_KEY);

    if (username !== ALLOWED_USERNAME || (savedUser && username !== savedUser)) {
      return setPill(pill, "bad", "Unknown username");
    }
    if (!pass) return setPill(pill, "bad", "Enter your password");

    setPill(pill, "pending", "Logging in…");
    const unlocked = await unlockToken(pass);
    if (!unlocked) return setPill(pill, "bad", "Wrong password");

    try {
      const result = await ghVerifyToken();
      if (result.ok) {
        document.getElementById("unlock-pass").value = "";
        setPill(pill, "ok", "Logged in — you can now upload");
        initSitePhotos();
      } else {
        setPill(pill, "bad", result.reason);
      }
    } catch (e) {
      setPill(pill, "bad", "Could not reach GitHub");
    }
  });

  // Reset: forget the stored (encrypted) token entirely
  document.getElementById("reset-btn").addEventListener("click", () => {
    clearStoredToken();
    localStorage.removeItem(USERNAME_KEY);
    document.getElementById("unlock-pass").value = "";
    showSetup("Token cleared — set up again");
  });
}

function setPill(el, kind, text) {
  el.className = `status-pill ${kind}`;
  el.textContent = text;
}

/* ---------------- Folder select (category) ---------------- */
let foldersCache = [];

async function initFolderSelect() {
  const select = document.getElementById("folder-select");
  const newFields = document.getElementById("new-folder-fields");

  foldersCache = await loadFolders().catch(() => []);
  select.innerHTML = foldersCache.map(f => `<option value="${f.id}">${f.name}</option>`).join("")
    + `<option value="__new__">+ Create new folder…</option>`;

  select.addEventListener("change", () => {
    newFields.style.display = select.value === "__new__" ? "flex" : "none";
    populateAlbumSelect();
  });

  await populateAlbumSelect();
}

/* ---------------- Album select (filtered by chosen folder) ---------------- */
async function initAlbumSelect() {
  albumsCache = await loadAlbums().catch(() => []);
  await initFolderSelect();

  const nameInput = document.getElementById("new-album-name");
  const slugPreview = document.getElementById("new-album-slug");
  nameInput.addEventListener("input", () => {
    slugPreview.textContent = slugify(nameInput.value) || "your-album-name";
  });
}

function populateAlbumSelect() {
  const folderSelect = document.getElementById("folder-select");
  const select = document.getElementById("album-select");
  const newFields = document.getElementById("new-album-fields");
  const chosenFolderId = folderSelect.value;

  const filtered = chosenFolderId === "__new__"
    ? []
    : albumsCache.filter(a => a.folderId === chosenFolderId);

  select.innerHTML = filtered.map(a => `<option value="${a.id}">${a.name}</option>`).join("")
    + `<option value="__new__">+ Create new album…</option>`;

  select.onchange = () => {
    newFields.style.display = select.value === "__new__" ? "flex" : "none";
  };
  select.onchange();
}

function slugify(str) {
  return str.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

/* ---------------- Dropzone / queue ---------------- */
function initDropzone() {
  const zone = document.getElementById("dropzone");
  const input = document.getElementById("file-input");

  zone.addEventListener("click", () => input.click());
  input.addEventListener("change", () => addFiles([...input.files]));

  ["dragenter", "dragover"].forEach(evt =>
    zone.addEventListener(evt, (e) => { e.preventDefault(); zone.classList.add("dragover"); })
  );
  ["dragleave", "drop"].forEach(evt =>
    zone.addEventListener(evt, (e) => { e.preventDefault(); zone.classList.remove("dragover"); })
  );
  zone.addEventListener("drop", (e) => addFiles([...e.dataTransfer.files]));
}

function addFiles(files) {
  const valid = files.filter(f => /\.(jpg|jpeg|png|gif|webp|heic|mp4|mov|webm)$/i.test(f.name));
  queuedFiles = queuedFiles.concat(valid.map(f => ({ file: f, status: "queued" })));
  renderQueue();
}

function renderQueue() {
  const list = document.getElementById("queue-list");
  if (!queuedFiles.length) {
    list.innerHTML = "";
    return;
  }
  list.innerHTML = queuedFiles.map((item, idx) => {
    const isImg = /\.(jpg|jpeg|png|gif|webp|heic)$/i.test(item.file.name);
    const thumb = isImg ? URL.createObjectURL(item.file) : null;
    return `
      <div class="queue-item" data-idx="${idx}">
        ${thumb ? `<img src="${thumb}">` : `<div style="width:48px;height:48px;background:#ddd;border-radius:4px;display:flex;align-items:center;justify-content:center;"><i class="fas fa-video"></i></div>`}
        <span class="qi-name">${item.file.name}</span>
        <span class="qi-status ${item.status}">${item.status}</span>
      </div>`;
  }).join("");
}

/* ---------------- Upload ---------------- */
async function startUpload() {
  const log = document.getElementById("upload-log");
  const folderSelect = document.getElementById("folder-select");
  const select = document.getElementById("album-select");
  const btn = document.getElementById("upload-btn");

  if (!getSessionToken()) {
    log.innerHTML = `<p class="empty-state">Unlock with your passphrase (or set up your token) first.</p>`;
    return;
  }
  if (!queuedFiles.length) {
    log.innerHTML = `<p class="empty-state">Add at least one photo or video first.</p>`;
    return;
  }

  // Resolve folder (existing or new)
  let targetFolderId, targetFolderName, isNewFolder = false, newFolderDesc = "";
  if (folderSelect.value === "__new__") {
    const name = document.getElementById("new-folder-name").value.trim();
    if (!name) {
      log.innerHTML = `<p class="empty-state">Give your new folder a name first.</p>`;
      return;
    }
    targetFolderId = slugify(name);
    targetFolderName = name;
    newFolderDesc = document.getElementById("new-folder-desc").value.trim();
    isNewFolder = true;
  } else {
    const folder = foldersCache.find(f => f.id === folderSelect.value);
    if (!folder) {
      log.innerHTML = `<p class="empty-state">Pick a folder first.</p>`;
      return;
    }
    targetFolderId = folder.id;
    targetFolderName = folder.name;
  }

  // Resolve album (existing or new)
  let targetFolder, targetAlbumId, targetAlbumName, isNewAlbum = false, newLocation = "", newDate = "";
  if (select.value === "__new__") {
    const name = document.getElementById("new-album-name").value.trim();
    if (!name) {
      log.innerHTML = `<p class="empty-state">Give your new album a name first.</p>`;
      return;
    }
    const slug = slugify(name);
    targetFolder = slug;
    targetAlbumId = slug;
    targetAlbumName = name;
    newLocation = document.getElementById("new-album-location").value.trim();
    newDate = document.getElementById("new-album-date").value.trim();
    isNewAlbum = true;
  } else {
    const album = albumsCache.find(a => a.id === select.value);
    if (!album) {
      log.innerHTML = `<p class="empty-state">Pick an album first.</p>`;
      return;
    }
    targetFolder = album.folder;
    targetAlbumId = album.id;
    targetAlbumName = album.name;
  }

  btn.disabled = true;
  btn.textContent = "Uploading…";

  let firstUploadedPath = null;
  let successCount = 0;

  for (let i = 0; i < queuedFiles.length; i++) {
    const item = queuedFiles[i];
    item.status = "pending";
    renderQueue();

    const cleanName = `${Date.now()}-${item.file.name.replace(/[^a-zA-Z0-9.\-]+/g, "_")}`;
    const path = `${targetFolder}/${cleanName}`;

    try {
      await ghUploadFile(path, item.file, `Add ${item.file.name} to ${targetAlbumName} via upload tool`);
      item.status = "ok";
      successCount++;
      if (!firstUploadedPath) firstUploadedPath = path;
    } catch (e) {
      item.status = "bad";
      console.error(e);
    }
    renderQueue();
  }

  if (!firstUploadedPath) {
    log.innerHTML = `<p class="empty-state">Nothing uploaded successfully — check the errors above.</p>`;
    btn.disabled = false;
    btn.textContent = "Upload All";
    return;
  }

  try {
    // Create the folder entry first, if new
    if (isNewFolder) {
      const fileMeta = await ghGetFile(SITE_CONFIG.foldersFile);
      const currentText = fileMeta ? decodeURIComponent(escape(atob(fileMeta.content.replace(/\n/g, "")))) : "[]";
      const folders = JSON.parse(currentText);
      folders.push({
        id: targetFolderId,
        name: targetFolderName,
        icon: "fa-folder-open",
        description: newFolderDesc,
        cover: firstUploadedPath
      });
      await ghUpdateTextFile(SITE_CONFIG.foldersFile, JSON.stringify(folders, null, 2), `Add new folder: ${targetFolderName}`);
    }

    // Register the album, if new
    if (isNewAlbum) {
      const fileMeta = await ghGetFile(SITE_CONFIG.albumsFile);
      const currentText = fileMeta ? decodeURIComponent(escape(atob(fileMeta.content.replace(/\n/g, "")))) : "[]";
      const albums = JSON.parse(currentText);
      albums.push({
        id: targetAlbumId,
        code: targetAlbumId.slice(0, 3).toUpperCase(),
        name: targetAlbumName,
        folder: targetFolder,
        cover: firstUploadedPath,
        folderId: targetFolderId,
        location: newLocation,
        date: newDate
      });
      await ghUpdateTextFile(SITE_CONFIG.albumsFile, JSON.stringify(albums, null, 2), `Add new album: ${targetAlbumName}`);
    }

    log.innerHTML = `<p>✅ Uploaded ${successCount} file(s) to <b>${targetAlbumName}</b> in <b>${targetFolderName}</b>. <a href="album.html?id=${encodeURIComponent(targetAlbumId)}" style="color:var(--orange)">View album →</a></p>`;
  } catch (e) {
    log.innerHTML = `<p>Files uploaded, but couldn't update folders.json/albums.json automatically: ${e.message}.</p>`;
  }

  btn.disabled = false;
  btn.textContent = "Upload All";
  queuedFiles = queuedFiles.filter(f => f.status !== "ok");
  renderQueue();
}

/* ---------------- Site Photos: pick hero / about / contact images ---------------- */
let allPhotosCache = null;
let selectedHero = new Set();
let selectedAbout = null;
let selectedContact = null;

async function loadAllPhotosForPicker() {
  if (allPhotosCache) return allPhotosCache;
  const albums = albumsCache.length ? albumsCache : await loadAlbums();
  const all = [];
  for (const album of albums) {
    try {
      const files = await ghListFolder(album.folder);
      files
        .filter(f => f.type === "file" && isMediaFile(f.name) && !isVideoFile(f.name))
        .forEach(f => all.push({ path: f.path, url: f.download_url }));
    } catch (e) { /* skip album on error */ }
  }
  allPhotosCache = all;
  return all;
}

async function initSitePhotos() {
  const loading = document.getElementById("site-photos-loading");
  const panel = document.getElementById("site-photos-panel");
  if (!loading || !panel) return;

  loading.textContent = "Loading photos…";

  let settings = {};
  try {
    const meta = await ghGetFile(SITE_CONFIG.siteSettingsFile);
    if (meta && meta.content) {
      settings = JSON.parse(decodeURIComponent(escape(atob(meta.content.replace(/\n/g, "")))));
    }
  } catch (e) { /* no settings yet, that's fine */ }

  selectedHero = new Set(settings.heroImages || []);
  selectedAbout = settings.aboutImage || null;
  selectedContact = settings.contactImage || null;

  const photos = await loadAllPhotosForPicker();

  loading.style.display = "none";
  panel.style.display = "block";

  renderPicker("hero-picker", photos, "multi");
  renderPicker("about-picker", photos, "single-about");
  renderPicker("contact-picker", photos, "single-contact");

  const saveBtn = document.getElementById("save-site-photos-btn");
  if (saveBtn && !saveBtn.dataset.bound) {
    saveBtn.dataset.bound = "1";
    saveBtn.addEventListener("click", saveSitePhotos);
  }
}

function renderPicker(containerId, photos, mode) {
  const el = document.getElementById(containerId);
  if (!el) return;
  el.innerHTML = photos.map(p => {
    let isSel = false;
    if (mode === "multi") isSel = selectedHero.has(p.path);
    if (mode === "single-about") isSel = selectedAbout === p.path;
    if (mode === "single-contact") isSel = selectedContact === p.path;
    return `
      <div class="photo-pick ${isSel ? "selected" : ""}" data-path="${p.path}" data-mode="${mode}">
        <img src="${p.url}" loading="lazy" alt="">
        <span class="pick-check"><i class="fas fa-check"></i></span>
      </div>`;
  }).join("");
}

document.addEventListener("click", (e) => {
  const pick = e.target.closest(".photo-pick");
  if (!pick) return;
  const path = pick.dataset.path;
  const mode = pick.dataset.mode;

  if (mode === "multi") {
    if (selectedHero.has(path)) selectedHero.delete(path);
    else selectedHero.add(path);
    pick.classList.toggle("selected");
  } else if (mode === "single-about") {
    selectedAbout = path;
    document.querySelectorAll("#about-picker .photo-pick").forEach(el =>
      el.classList.toggle("selected", el.dataset.path === path)
    );
  } else if (mode === "single-contact") {
    selectedContact = path;
    document.querySelectorAll("#contact-picker .photo-pick").forEach(el =>
      el.classList.toggle("selected", el.dataset.path === path)
    );
  }
});

async function saveSitePhotos() {
  const log = document.getElementById("site-photos-log");
  if (!getSessionToken()) {
    log.innerHTML = `<p class="empty-state">Log in above first.</p>`;
    return;
  }
  log.textContent = "Saving…";
  try {
    const settings = {
      heroImages: Array.from(selectedHero),
      aboutImage: selectedAbout,
      contactImage: selectedContact
    };
    await ghUpdateTextFile(
      SITE_CONFIG.siteSettingsFile,
      JSON.stringify(settings, null, 2),
      "Update site photo settings"
    );
    log.innerHTML = `<span style="color:var(--teal)">✅ Saved — refresh the homepage/about/contact pages to see it.</span>`;
  } catch (e) {
    log.innerHTML = `<span style="color:var(--stamp)">Could not save: ${e.message}</span>`;
  }
}
