document.addEventListener("DOMContentLoaded", () => {
  initNav();
  initLightbox();
  if (document.querySelector(".banner")) initHero();
  if (document.getElementById("album-grid")) renderGalleryPage();
  if (document.getElementById("contact-sheet")) renderAlbumPage();
});

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
  const banner = document.querySelector(".banner");
  const bannerText = document.querySelector(".banner-text");

  // Typing effect
  if (bannerText) {
    const text = "Welcome to TravelSpace";
    let index = 0;
    let typing = true;
    (function tick() {
      if (typing) {
        if (index < text.length) {
          bannerText.innerHTML = text.slice(0, index + 1) + '<span class="cursor"></span>';
          index++;
          setTimeout(tick, 120);
        } else {
          typing = false;
          setTimeout(tick, 1400);
        }
      } else {
        if (index > 0) {
          bannerText.innerHTML = text.slice(0, index - 1) + '<span class="cursor"></span>';
          index--;
          setTimeout(tick, 70);
        } else {
          typing = true;
          setTimeout(tick, 500);
        }
      }
    })();
  }

  // Slideshow background pulled from album covers + a live featured strip
  try {
    const albums = await loadAlbums();
    const covers = albums.map(a => a.cover).filter(Boolean);
    if (covers.length) {
      let i = 0;
      banner.style.backgroundImage = `url('${encodeURI(covers[0])}')`;
      if (covers.length > 1) {
        setInterval(() => {
          i = (i + 1) % covers.length;
          banner.style.backgroundImage = `url('${encodeURI(covers[i])}')`;
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
          <div class="bp-meta"><span>${count} ITEMS</span><span>GATE ${String(idx + 1).padStart(2, "0")}</span></div>
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
        <div class="frame">
          ${isVideo
            ? `<video class="modal-image" src="${f.download_url}" controls preload="metadata"></video>`
            : `<img class="modal-image" src="${f.download_url}" data-full="${f.download_url}" alt="${album.name} photo ${tag}" loading="lazy">`}
          <span class="frame-idx">${tag}</span>
          ${isVideo ? '<span class="play-badge"><i class="fas fa-play"></i></span>' : ''}
        </div>`;
    }).join("");
  } catch (e) {
    sheet.innerHTML = '<p class="empty-state">Could not load photos from GitHub right now. Try refreshing.</p>';
  }
}
