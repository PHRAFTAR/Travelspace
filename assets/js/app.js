document.addEventListener("DOMContentLoaded", () => {
  initTheme();
  initNav();
  initLightbox();
  initDeleteAuth();
  if (document.getElementById("hero-image-panel")) initHero();
  if (document.getElementById("about-photo")) initAboutPhoto();
  if (document.getElementById("contact-photo")) initContactPhoto();
  if (document.getElementById("album-grid")) renderGalleryPage();
  if (document.getElementById("contact-sheet")) renderAlbumPage();
});

/* ---------------- Theme toggle (dark / light) ---------------- */
function initTheme() {
  const KEY = "ts_theme";
  const root = document.documentElement;

  function updateIcons(theme) {
    document.querySelectorAll("#theme-toggle i").forEach(icon => {
      icon.className = theme === "light" ? "fas fa-moon" : "fas fa-sun";
    });
  }

  function applyTheme(theme) {
    if (theme === "light") root.setAttribute("data-theme", "light");
    else root.removeAttribute("data-theme");
    updateIcons(theme);
  }

  const saved = localStorage.getItem(KEY);
  applyTheme(saved === "light" ? "light" : "dark");

  document.addEventListener("click", (e) => {
    const btn = e.target.closest("#theme-toggle");
    if (!btn) return;
    const current = root.getAttribute("data-theme") === "light" ? "light" : "dark";
    const next = current === "light" ? "dark" : "light";
    applyTheme(next);
    localStorage.setItem(KEY, next);
  });
}

async function initAboutPhoto() {
  const img = document.getElementById("about-photo");
  try {
    const albums = await loadAlbums();
    if (albums.length && albums[0].cover) {
      img.src = encodeURI(albums[0].cover);
    }
  } catch (e) {
    console.warn("Could not load photo for about page:", e);
  }
}

async function initContactPhoto() {
  const img = document.getElementById("contact-photo");
  try {
    const albums = await loadAlbums();
    const pick = albums[1] || albums[0];
    if (pick && pick.cover) {
      img.src = encodeURI(pick.cover);
    }
  } catch (e) {
    console.warn("Could not load photo for contact page:", e);
  }
}

function shuffleArray(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/* ---------------- Mobile nav ---------------- */
function initNav() {
  const menuIcon = document.querySelector(".menu-icon");
  const navList = document.querySelector(".nav-list");
  const headerTitle = document.querySelector("header h1");

  if (menuIcon && navList) {
    menuIcon.addEventListener("click", () => navList.classList.toggle("active"));
    navList.querySelectorAll("a").forEach(link => {
      link.addEventListener("click", () => navList.classList.remove("active"));
    });
    window.addEventListener("click", (e) => {
      if (!navList.contains(e.target) && !menuIcon.contains(e.target) && navList.classList.contains("active")) {
        navList.classList.remove("active");
      }
    });
  }

  if (headerTitle) {
    headerTitle.addEventListener("click", () => (window.location.href = "index.html"));
  }

  // highlight current page in nav
  const current = window.location.pathname.split("/").pop() || "index.html";
  document.querySelectorAll(".nav-list a").forEach(a => {
    if (a.getAttribute("href") === current) a.classList.add("active");
  });
}

/* ---------------- Lightbox (event-delegated, works for dynamically added images) ---------------- */
function initLightbox() {
  const modal = document.getElementById("myModal");
  if (!modal) return;
  const modalImg = document.getElementById("img01");
  const closeBtn = modal.querySelector(".close");

  document.addEventListener("click", (e) => {
    const trigger = e.target.closest(".modal-image");
    if (!trigger) return;
    if (trigger.tagName === "VIDEO") return; // let videos play inline instead
    modal.style.display = "flex";
    modalImg.src = trigger.dataset.full || trigger.src;
  });

  const close = () => (modal.style.display = "none");
  if (closeBtn) closeBtn.onclick = close;
  modal.addEventListener("click", (e) => {
    if (e.target === modal) close();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") close();
  });
}

/* ---------------- Homepage hero ---------------- */
async function initHero() {
  const panel = document.getElementById("hero-image-panel");

  // Slideshow background pulled from album covers (random order each visit) + a live featured strip
  try {
    const albums = await loadAlbums();
    const covers = shuffleArray(albums.map(a => a.cover).filter(Boolean));
    if (panel && covers.length) {
      let i = 0;
      panel.style.backgroundImage = `url('${encodeURI(covers[i])}')`;
      if (covers.length > 1) {
        setInterval(() => {
          i = (i + 1) % covers.length;
          panel.style.backgroundImage = `url('${encodeURI(covers[i])}')`;
        }, 4000);
      }
    }
    await renderFeaturedStrip(albums);
  } catch (e) {
    console.warn("Could not load albums for hero:", e);
  }
}

async function renderFeaturedStrip(albums) {
  const strip = document.getElementById("featured-strip");
  if (!strip || !albums.length) return;
  strip.innerHTML = '<p class="empty-state">Loading featured shots…</p>';

  try {
    const first = albums[0];
    const files = await ghListFolder(first.folder);
    const media = files.filter(f => f.type === "file" && isMediaFile(f.name)).slice(0, 3);
    if (!media.length) {
      strip.innerHTML = '<p class="empty-state">No photos yet — upload your first one.</p>';
      return;
    }
    strip.innerHTML = media.map((f, idx) => {
      const isVideo = isVideoFile(f.name);
      const tag = String(idx + 1).padStart(2, "0");
      return `
        <div class="featured-item">
          <span class="frame-tag">FRAME ${tag}</span>
          ${isVideo
            ? `<video controls preload="metadata"><source src="${f.download_url}" type="video/mp4"></video>`
            : `<img src="${f.download_url}" alt="${first.name} photo" loading="lazy">`}
        </div>`;
    }).join("");
  } catch (e) {
    strip.innerHTML = '<p class="empty-state">Could not load photos right now.</p>';
  }
}

/* ---------------- Gallery page: boarding-pass album cards ---------------- */
async function renderGalleryPage() {
  const grid = document.getElementById("album-grid");
  grid.innerHTML = '<p class="empty-state">Loading albums…</p>';

  let albums = [];
  try {
    albums = await loadAlbums();
  } catch (e) {
    grid.innerHTML = '<p class="empty-state">Could not load albums.json — check assets/js/config.js.</p>';
    return;
  }

  const cards = await Promise.all(albums.map(async (album, idx) => {
    let count = "—";
    try {
      const files = await ghListFolder(album.folder);
      count = files.filter(f => f.type === "file" && isMediaFile(f.name)).length;
    } catch (e) { /* leave as — */ }

    const code = album.code || album.id.slice(0, 3).toUpperCase();
    return `
      <a class="boarding-pass" href="album.html?id=${encodeURIComponent(album.id)}">
        <div class="bp-image" style="background-image:url('${encodeURI(album.cover)}')">
          <span class="bp-code">${code}-${String(idx + 1).padStart(2, "0")}</span>
        </div>
        <div class="bp-stub">
          <h3 class="bp-name">${album.name}</h3>
          <div class="bp-meta">
            <span class="bp-count"><i class="fas fa-map-marker-alt"></i> ${count} ITEMS</span>
            <span class="bp-arrow"><i class="fas fa-arrow-right"></i></span>
          </div>
        </div>
      </a>`;
  }));

  grid.innerHTML = cards.join("") + `
    <a class="boarding-pass new-album" href="upload.html">
      <i class="fas fa-plus"></i>
      <span>Start New Album</span>
    </a>`;
}

/* ---------------- Album detail page: contact-sheet grid ---------------- */
async function renderAlbumPage() {
  const sheet = document.getElementById("contact-sheet");
  const titleEl = document.getElementById("album-title");
  const metaEl = document.getElementById("album-meta");
  const params = new URLSearchParams(window.location.search);
  const id = params.get("id");

  if (!id) {
    sheet.innerHTML = '<p class="empty-state">No album specified.</p>';
    return;
  }

  const albums = await loadAlbums();
  const album = albums.find(a => a.id === id);

  if (!album) {
    if (titleEl) titleEl.textContent = "Album not found";
    sheet.innerHTML = '<p class="empty-state">This album doesn\'t exist in albums.json.</p>';
    return;
  }

  if (titleEl) titleEl.textContent = album.name;
  document.title = `${album.name} - TravelSpace`;

  sheet.innerHTML = '<p class="empty-state">Loading photos…</p>';

  try {
    const files = await ghListFolder(album.folder);
    const media = files.filter(f => f.type === "file" && isMediaFile(f.name));

    if (metaEl) metaEl.textContent = `${album.folder} · ${media.length} ITEMS`;

    if (!media.length) {
      sheet.innerHTML = `<p class="empty-state">No photos in this album yet. <a href="upload.html" style="color:var(--stamp)">Upload some →</a></p>`;
      return;
    }

    sheet.innerHTML = media.map((f, idx) => {
      const isVideo = isVideoFile(f.name);
      const tag = String(idx + 1).padStart(2, "0");
      return `
        <div class="frame" data-path="${f.path}">
          ${isVideo
            ? `<video class="modal-image" src="${f.download_url}" controls preload="metadata"></video>`
            : `<img class="modal-image" src="${f.download_url}" data-full="${f.download_url}" alt="${album.name} photo ${tag}" loading="lazy">`}
          <span class="frame-idx">${tag}</span>
          ${isVideo ? '<span class="play-badge"><i class="fas fa-play"></i></span>' : ''}
          <button class="frame-delete" type="button" data-path="${f.path}" data-name="${f.name}" title="Delete this photo">
            <i class="fas fa-trash"></i>
          </button>
        </div>`;
    }).join("");
  } catch (e) {
    sheet.innerHTML = '<p class="empty-state">Could not load photos from GitHub right now. Try refreshing.</p>';
  }
}

/* ---------------- Delete photos (passphrase-gated) ---------------- */
function initDeleteAuth() {
  const modal = document.getElementById("deleteAuthModal");
  if (!modal) return; // only present on album.html

  const input = document.getElementById("delete-pass-input");
  const confirmBtn = document.getElementById("delete-pass-confirm");
  const cancelBtn = document.getElementById("delete-pass-cancel");
  const errorEl = document.getElementById("delete-pass-error");

  let resolver = null;

  function openModal() {
    errorEl.textContent = "";
    input.value = "";
    modal.style.display = "flex";
    setTimeout(() => input.focus(), 50);
  }
  function closeModal(result) {
    modal.style.display = "none";
    if (resolver) resolver(result);
    resolver = null;
  }

  window.requestUnlock = function () {
    return new Promise((resolve) => {
      resolver = resolve;
      openModal();
    });
  };

  confirmBtn.addEventListener("click", async () => {
    const pass = input.value;
    if (!pass) {
      errorEl.textContent = "Enter your passphrase.";
      return;
    }
    errorEl.textContent = "Checking…";
    const ok = await unlockToken(pass);
    if (!ok) {
      errorEl.textContent = "Wrong passphrase.";
      return;
    }
    const result = await ghVerifyToken().catch(() => ({ ok: false, reason: "Could not reach GitHub" }));
    if (!result.ok) {
      errorEl.textContent = result.reason;
      return;
    }
    closeModal(true);
  });

  cancelBtn.addEventListener("click", () => closeModal(false));
  modal.addEventListener("click", (e) => { if (e.target === modal) closeModal(false); });

  // Delegated click for delete buttons (works for dynamically rendered frames)
  document.addEventListener("click", async (e) => {
    const btn = e.target.closest(".frame-delete");
    if (!btn) return;
    e.stopPropagation();

    const path = btn.dataset.path;
    const name = btn.dataset.name;

    if (!hasStoredToken()) {
      alert("Set up upload access first from the Upload page — you need that before you can delete anything.");
      return;
    }
    if (!getSessionToken()) {
      const unlocked = await window.requestUnlock();
      if (!unlocked) return;
    }
    if (!confirm(`Delete "${name}"? This can't be undone.`)) return;

    const frame = btn.closest(".frame");
    frame.style.opacity = "0.4";
    btn.disabled = true;

    try {
      const meta = await ghGetFile(path);
      if (!meta) throw new Error("File not found (already deleted?)");
      await ghDeleteFile(path, meta.sha, `Delete ${name} via site`);
      frame.remove();
    } catch (err) {
      frame.style.opacity = "1";
      btn.disabled = false;
      alert("Could not delete: " + err.message);
    }
  });
}
