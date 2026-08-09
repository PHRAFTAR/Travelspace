# TravelSpace — Setup Guide (current)

## What this site is
A personal travel photo/video journal, hosted free on GitHub Pages. No backend —
everything (albums, folders, site photos) is stored as JSON files in this repo,
and photos are uploaded straight from the site into your GitHub repo via the
GitHub API.

Structure: **Gallery → Folders → Albums → Photos**

## File overview
- `index.html`, `gallery.html`, `folder.html`, `album.html`, `about.html`, `contact.html`, `upload.html` — pages
- `styles.css` — all styling
- `assets/js/config.js` — your GitHub username/repo + data file paths
- `assets/js/github-api.js` — talks to the GitHub API (list/upload/delete files)
- `assets/js/app.js` — renders every page, theme toggle, animations, cursor, etc.
- `assets/js/upload.js` — the upload/admin page logic (login, create folders/albums, site photos)
- `assets/data/folders.json` — your folder categories (e.g. "City & Heritage")
- `assets/data/albums.json` — your albums, each linked to a folder via `folderId`
- `assets/data/site-settings.json` — created automatically once you pick homepage/about/contact photos

## 1. One-time edit: `assets/js/config.js`
```js
const SITE_CONFIG = {
  githubOwner: "PHRAFTAR",   // <-- your GitHub username
  githubRepo: "Travelspace", // <-- your repo name
  branch: "main",
  ...
};
```
If this is wrong you'll see "Repo not reachable" on the upload page.

## 2. Logging in to upload/manage
Go to `upload.html` on your live site.

**First time:**
1. Create a GitHub token: GitHub → Settings → Developer settings → Personal access
   tokens → Fine-grained → select this repo only → Permissions → Contents →
   **Read and write**.
2. On `upload.html`, enter Username `Priyanshu.Sharma`, paste the token, and choose
   your own password.
3. Click **Save & Lock**.

**Every time after:** just enter the username + your password to log in. The real
token is encrypted (AES-256) in that browser's storage — it's never written into
any file that gets committed, and it's never compared in plain text anywhere in
the code (so no one can read it from "View Source").

Since the repo is public, don't screenshot or share your token/password anywhere.

## 3. Adding photos
On `upload.html`, once logged in:
1. **Choose Category Folder** — pick an existing one or create a new one (e.g. "Mountains").
2. **Choose Album** — pick an existing album in that folder, or create a new one
   (with location + date, shown on the folder page).
3. **Select Photos & Videos** — drag/drop or click to browse, then **Upload All**.

New folders/albums are written straight into `folders.json`/`albums.json`, and
the site picks them up automatically — no code editing needed.

## 4. Deleting a photo
Open any album, hover a photo (or just tap on mobile) → red trash icon → confirm.
You'll be asked to log in if you haven't already this session.

## 5. Choosing homepage / About / Contact photos
Still on `upload.html`, after logging in, scroll to **Site Photos** — pick any
number of photos for the homepage hero, and one each for About and Contact.
Click **Save Site Photos**.

## Notes
- Anonymous visitors can browse everything but can't upload/delete/manage —
  they have no token.
- GitHub API rate-limits anonymous browsing to 60 requests/hour; if a page fails
  to load photos, wait a bit and refresh.
- GitHub Pages rebuilds ~30–60 seconds after any commit — refresh after that.
