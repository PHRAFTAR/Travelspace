let queuedFiles = [];
let albumsCache = [];

document.addEventListener("DOMContentLoaded", async () => {
  initTokenUI();
  initAlbumSelect();
  initDropzone();

  document.getElementById("upload-btn").addEventListener("click", startUpload);
});

/* ---------------- Token: passphrase-locked setup / unlock ---------------- */
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
  }

  if (hasStoredToken()) showUnlock(); else showSetup();

  // First-time setup
  document.getElementById("setup-btn").addEventListener("click", async () => {
    const token = document.getElementById("setup-token").value.trim();
    const pass1 = document.getElementById("setup-pass").value;
    const pass2 = document.getElementById("setup-pass-confirm").value;

    if (!token) return setPill(pill, "bad", "Paste your GitHub token first");
    if (pass1.length < 4) return setPill(pill, "bad", "Passphrase should be at least 4 characters");
    if (pass1 !== pass2) return setPill(pill, "bad", "Passphrases don't match");

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
    document.getElementById("setup-token").value = "";
    document.getElementById("setup-pass").value = "";
    document.getElementById("setup-pass-confirm").value = "";
    setPill(pill, "ok", "Connected · locked with your passphrase");
  });

  // Returning visit: unlock with passphrase
  document.getElementById("unlock-btn").addEventListener("click", async () => {
    const pass = document.getElementById("unlock-pass").value;
    if (!pass) return setPill(pill, "bad", "Enter your passphrase");

    setPill(pill, "pending", "Unlocking…");
    const unlocked = await unlockToken(pass);
    if (!unlocked) return setPill(pill, "bad", "Wrong passphrase");

    try {
      const result = await ghVerifyToken();
      if (result.ok) {
        document.getElementById("unlock-pass").value = "";
        setPill(pill, "ok", "Unlocked · can upload");
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
    document.getElementById("unlock-pass").value = "";
    showSetup("Token cleared — set up again");
  });
}

function setPill(el, kind, text) {
  el.className = `status-pill ${kind}`;
  el.textContent = text;
}

/* ---------------- Album select ---------------- */
async function initAlbumSelect() {
  const select = document.getElementById("album-select");
  const newFields = document.getElementById("new-album-fields");
  const nameInput = document.getElementById("new-album-name");
  const slugPreview = document.getElementById("new-album-slug");

  albumsCache = await loadAlbums().catch(() => []);
  select.innerHTML = albumsCache.map(a => `<option value="${a.id}">${a.name}</option>`).join("")
    + `<option value="__new__">+ Create new album…</option>`;

  select.addEventListener("change", () => {
    newFields.style.display = select.value === "__new__" ? "flex" : "none";
  });

  nameInput.addEventListener("input", () => {
    slugPreview.textContent = slugify(nameInput.value) || "your-album-name";
  });
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

  let targetFolder, targetAlbumId, targetAlbumName, isNewAlbum = false;

  if (select.value === "__new__") {
    const nameInput = document.getElementById("new-album-name");
    const name = nameInput.value.trim();
    if (!name) {
      log.innerHTML = `<p class="empty-state">Give your new album a name first.</p>`;
      return;
    }
    const slug = slugify(name);
    targetFolder = slug;
    targetAlbumId = slug;
    targetAlbumName = name;
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

  // If this was a new album, register it in albums.json after first successful file
  if (isNewAlbum && firstUploadedPath) {
    try {
      const fileMeta = await ghGetFile(SITE_CONFIG.albumsFile);
      const currentText = fileMeta ? decodeURIComponent(escape(atob(fileMeta.content.replace(/\n/g, "")))) : "[]";
      const albums = JSON.parse(currentText);
      albums.push({
        id: targetAlbumId,
        code: targetAlbumId.slice(0, 3).toUpperCase(),
        name: targetAlbumName,
        folder: targetFolder,
        cover: firstUploadedPath
      });
      await ghUpdateTextFile(SITE_CONFIG.albumsFile, JSON.stringify(albums, null, 2), `Add new album: ${targetAlbumName}`);
      log.innerHTML = `<p>✅ New album <b>${targetAlbumName}</b> created with ${successCount} file(s). <a href="album.html?id=${encodeURIComponent(targetAlbumId)}" style="color:var(--stamp)">View it →</a></p>`;
    } catch (e) {
      log.innerHTML = `<p>Files uploaded, but couldn't update albums.json automatically: ${e.message}. You may need to add it manually.</p>`;
    }
  } else {
    log.innerHTML = `<p>✅ Uploaded ${successCount} of ${queuedFiles.length} file(s) to <b>${targetAlbumName}</b>. <a href="album.html?id=${encodeURIComponent(targetAlbumId)}" style="color:var(--stamp)">View album →</a></p>`;
  }

  btn.disabled = false;
  btn.textContent = "Upload All";
  queuedFiles = queuedFiles.filter(f => f.status !== "ok");
  renderQueue();
}
