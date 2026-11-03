# Mundari Samaj — Website Guide (Beginner Friendly)

**Our Language. Our Identity. Our Heritage.**

This folder contains the complete Mundari Samaj website — a static site (plain
HTML, CSS and JavaScript; no database, no server code). It lives at
**https://mundarisamaj.pages.dev** and the same code is mirrored to the GitHub
repository **catversstudio/mundari-samaj**.

---

## 1. Folder map

| File / folder | What it is |
|---|---|
| `index.html` | Home page |
| `discover.html`, `language.html`, `culture.html`, `festivals.html`, `history.html`, `community.html`, `library.html`, `about.html`, `contribute.html`, `search.html`, `people.html`, `identity.html`, `movement.html`, `resources.html` | Main sections of the site |
| `script.html`, `dictionary.html`, `grammar.html`, `learn.html` | Mundari Bani script chart, the 128-word dictionary, grammar and learning pages |
| `articles.html`, `article.html`, `news.html`, `stories.html`, `gallery.html` | Articles, news, community stories and the photo gallery (content comes from the JSON files below) |
| `content/articles.json`, `content/news.json`, `content/stories.json`, `content/gallery.json` | The editable content database — one record per article / news item / story / gallery photo |
| `features.js`, `features.css` | The code that reads the JSON files and renders articles, news, stories, gallery, embeds and share buttons |
| `app.js`, `styles.css` | Home-page code and styles |
| `assets/img/` | Photographs used on the site (all free-licensed, credited — see §5) |
| `assets/mark.svg` | Site logo mark |
| `admin/index.html` | A private **draft helper** page: fill a form, download a JSON record (it cannot publish anything by itself) |
| `admin/README.html` | The publishing guide shown with the admin helper |
| `sitemap.xml`, `robots.txt`, `_headers`, `404.html` | Search-engine and hosting housekeeping files |

## 2. How to preview the site on your computer

The content pages load their JSON with `fetch()`, which browsers block on
`file://` pages — so do **not** just double-click the HTML files. Run a tiny
local server instead:

```bash
cd mundarisamaj        # this folder
python -m http.server 8000
```

Then open **http://localhost:8000** in your browser. Press `Ctrl+C` to stop.

## 3. How content works

- Articles, news, stories and gallery photos are **records** inside the four
  JSON files in `content/`.
- A record is shown on the site only when `"status": "published"`. Use
  `"status": "draft"` for work in progress.
- Articles carry a `"verified"` flag. Anything not yet checked by competent
  speakers/reviewers stays `"verified": false`, and the site automatically
  shows an **Editorial note** on it. Never set `verified: true` unless the
  review has actually happened.
- Every record can optionally have:
  - `"image"` — a featured photo: `{src, caption, credit, source, license}`
  - `"media"` — a list of extra items shown after the text:
    `{type, url, caption, credit?}` where type is one of
    `image | youtube | instagram | x | facebook | link`
  - `"related"` — a list of other record ids in the same file, shown as
    "Related reading" cards.
- Every article/news/story page automatically gets **share buttons**
  (WhatsApp, Facebook, X, Telegram).

## 4. Adding an article, news item or story

**Easy way — the admin helper**

1. Serve the site locally (see §2) and open
   **http://localhost:8000/admin/**
2. Fill in the form: collection, title, category, date, author, summary and
   the main text (blank line = new paragraph; `## Heading` = a heading in
   articles).
3. Add a featured image and media items if you have them (see §5–§6).
4. Watch the **live preview**, then click **Download record JSON**
   (or **Copy JSON**).
5. Send the downloaded file to Mira (see §7).

**Manual way**

Open the matching file in `content/`, copy an existing record, change its
fields, give it a unique `"id"`, and keep the JSON valid (commas and quotes
matter — a JSON validator helps). Keep `"status": "draft"` until reviewed.

## 5. Adding images — the legal way

- **Only** use photographs that are **public domain** or **Creative Commons**
  (CC0, CC BY, CC BY-SA). Best sources, in order: **Wikimedia Commons**,
  Openverse, Unsplash, Pexels.
- **Never** take images from blogs, news sites, Instagram, Pinterest or
  Google Images, and never hotlink (linking to a photo hosted elsewhere).
- Download the file, resize it to at most **1200 px wide** (JPEG quality
  ~80, aim for under ~400 KB), and save it in **`assets/img/`** with a clear
  name like `sarhul-dance-ranchi.jpg`. Never crop faces or stretch a photo.
- A photo may only be used where it **genuinely shows that subject** — a
  Sarhul photo with the Sarhul article, not as decoration for something else.
  If no honest photo exists, leave the topic without one.
- Always record `caption` (what it actually shows), `credit` (photographer),
  `source` (the photo's page URL) and `license`. Every photograph used
  anywhere on the site must also be listed in the **About page → "Photo &
  media credits"** section.

## 6. Adding YouTube / Instagram / X / Facebook items

Add a `"media"` item to the record (the admin helper has rows for this):

```json
{ "type": "youtube", "url": "https://www.youtube.com/watch?v=VIDEO_ID", "caption": "Video title — Channel name" }
```

- `youtube` → embedded with YouTube's official privacy-enhanced player,
  with a "Watch on YouTube ↗" fallback link.
- `instagram` → paste the post/Reel URL; the official Instagram embed is used.
- `x` → paste the post URL; the official X embed is used.
- `facebook` → paste the post/video URL; the official Facebook plugin is used.
- `image` → `url` is the path of a file in `assets/img/`; `link` → a plain
  link card with your caption as the link text.

Nothing is ever downloaded from social media — embeds and links only.

## 7. How publishing works

1. You prepare content (admin helper or manual JSON) and send the files or
   JSON to **Mira**.
2. Mira reviews it (facts, spelling, Bani script, credits), adds it to the
   site files, and deploys the updated site to **Cloudflare Pages** — that
   deploy is what makes it live at **mundarisamaj.pages.dev**.
3. The same code is then mirrored to the GitHub repository
   **catversstudio/mundari-samaj** as the backup/portfolio copy. (The site is
   *not* auto-deployed from GitHub.)

There are no passwords or tokens anywhere in this website, and the admin
helper cannot publish by itself — publishing is owner-only, via Mira.

## 8. Editorial rules (please keep these)

- **Never invent** cultural facts, history, traditions, words, dates or
  statistics. If something is not verified, mark it **"Research in
  progress"**.
- Every Mundari word must appear with its **Mundari Bani script** beside the
  Roman form. Do not substitute Santali or Ho forms for Mundari.
- Credits are **mandatory** for every photo, video and contributed item.
- Ask permission before publishing anyone's photo, story or recording, and
  honour correction and removal requests (see the About page).
