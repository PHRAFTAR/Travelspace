# TravelSpace Upgrade — Setup Guide

## 1. In-repo files ye badle/naye hain
Replace these in your GitHub repo with the versions in this zip:
- `index.html`
- `gallery.html`
- `about.html`
- `contact.html`
- `styles.css`

New files (add these):
- `album.html`
- `upload.html`
- `assets/js/config.js`
- `assets/js/github-api.js`
- `assets/js/app.js`
- `assets/js/upload.js`
- `assets/data/albums.json`

**Delete these — no longer needed** (replaced by `album.html` + live GitHub listing):
- `folder1.html`
- `folder2.html`
- `folder3.html`
- `mobile-nav.js`
- `banner.js`

Your image folders (`folder1 images/`, `folder 2 imges/`) stay exactly where they are — don't move or rename them.

## 2. Ek zaroori edit: `assets/js/config.js`
Open `assets/js/config.js` and set your actual GitHub username:
```js
const SITE_CONFIG = {
  githubOwner: "your-actual-github-username", // <-- edit this
  githubRepo: "Travelspace",                  // <-- edit if your repo name is different
  branch: "main",                              // <-- edit if your default branch is "master"
  ...
};
```
Without this, nothing will load — the site doesn't know which repo to talk to.

## 3. Upload feature ke liye GitHub token banao
1. GitHub → click your profile photo → **Settings**
2. Left sidebar bottom → **Developer settings**
3. **Personal access tokens → Fine-grained tokens → Generate new token**
4. **Repository access**: "Only select repositories" → choose your Travelspace repo
5. **Permissions → Repository permissions → Contents → Read and write**
6. Generate, copy the token (starts with `github_pat_...`)

Go to `upload.html` on your live site — **first time only**, paste the token in and choose your own
short passphrase (like a PIN), then click **Save & Lock**. From then on, you only need that
passphrase to unlock uploads — you won't need to paste the full token again on that browser.

Under the hood: the passphrase encrypts the token (AES-256) before it's saved in that browser's
local storage. The real token is never stored in plain text, and it's never written into any file
that gets committed to your repo. Because your repo is public, still don't paste the raw token or
your passphrase anywhere else (comments, screenshots, etc.) — anyone with the token could push to
your repo. If you ever want to switch to a different token, hit "Use a different GitHub token / reset"
on the upload page.

## 4. Kaise use karega
- **Gallery** page ab live hai — jo bhi photo GitHub folder mein hai wahi dikhegi, koi HTML edit nahi.
- **Upload page** (`upload.html`) se: existing album choose karo ya naya album banao, photos/videos
  drag-drop karo, "Upload All" dabao. Direct commit ho jayega tumhare repo mein.
- Naya album banane par `assets/data/albums.json` khud-ba-khud update ho jaata hai — gallery pe
  turant naya "boarding pass" card dikhega.
- GitHub Pages har commit ke baad khud rebuild karta hai (~30-60 sec), phir refresh karke dekh lena.

## Notes
- Unauthenticated visitors (jo bhi tumhari site dekhta hai) sirf gallery dekh sakte hain, upload nahi
  kar sakte — unke paas token nahi hai.
- Agar GitHub API rate limit hit ho (public/anonymous browsing pe 60 requests/hour), thoda wait karke refresh karna.
