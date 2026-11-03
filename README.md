# Mundari Samaj — Website (v12)

**Our Language. Our Identity. Our Heritage.**
Live site: https://mundarisamaj.pages.dev
GitHub Pages mirror: https://catversstudio.github.io/mundarisamaj/

Mundari Samaj is a digital knowledge platform for the Mundari language,
history, culture and community. Tagline greeting: **Johar! Jay Mundari!**

## How the site is organised

The visitor-facing structure has six sections, shown in the top navigation:

| Section | Hub page | What lives there |
|---|---|---|
| Our Language | `language.html` | `script.html` (Mundari Bani), `grammar.html`, `learn.html`, `dictionary.html` |
| Our Heritage | `history.html` | `movement.html`, `people.html`, `identity.html`, `culture.html`, `festivals.html`, `discover.html` |
| Knowledge Library | `library.html` | `articles.html` + `article.html`, `books.html`, `stories.html`, `resources.html` |
| News & Updates | `news.html` | News listing and news reader (same file, `?id=`) |
| Media Gallery | `gallery.html` | Photographs and video/media items |
| About Us | `about.html` | Mission, editorial policy, contact, `contribute.html`, `community.html` |

Pages stay at the site root on purpose: the URLs (for example
`history.html`) are already shared in the community and indexed, so they
must not change. Organisation is expressed through the navigation,
breadcrumbs, footer and this map — not by moving files into folders.

## File map

```
index.html            Homepage (hero, category cards, Today's Mundari Bulletin, ...)
*.html                One file per page, at the root (URLs must stay stable)
content/
  articles.json       Articles        (reader: article.html?id=...)
  news.json           News & updates  (reader: news.html?id=...)
  stories.json        Community stories (reader: stories.html?id=...)
  gallery.json        Gallery items   (page: gallery.html)
  books.json          Books & publications (page: books.html)
assets/
  mark.svg            Official logo (terracotta 8-petal star on cream)
  preview-banner.png  Social sharing image (Open Graph)
  img/                Photographs (openly licensed, credited on-page)
styles.css            Main design system (+ v12 hero/cards/bulletin block)
features.css          Cards/news/gallery styles for content pages
app.js                Homepage menu, topic search, contribution form
features.js           Loads content/*.json into home, listing and reader pages
admin/                Optional local draft helper (no login, stores nothing online)
sitemap.xml, robots.txt, _headers, 404.html
```

## Updating content (manual workflow — there is no admin login)

All updates are made manually by editing the JSON files in `content/`
and re-deploying. Only records with `"status": "published"` appear on
the site; use `"status": "draft"` to prepare something privately.

- **News:** add a record to `content/news.json` with
  `id, title, category, date (YYYY-MM-DD), excerpt, body, related, status`.
  It appears in News & Updates and in Today's Mundari Bulletin.
- **Article:** add to `content/articles.json` with
  `id, title, category, date, author, excerpt, body, readTime, image, media, related, verified, status`.
  Keep `verified: false` until the content has been checked against sources.
- **Story:** add to `content/stories.json` with
  `id, title, contributor, place, excerpt, body, related, status`.
- **Gallery item:** add to `content/gallery.json` with
  `title, caption, credit, tone, status` (plus `image` when a photo is used).
- **Book:** add to `content/books.json` with
  `id, title, author, language, year, publisher, description, link, image, status`.
  Add a `link` only where the book is legally available to read or download.

Rules that must never be broken: do not invent Mundari history, dates,
vocabulary or traditions; mark unverified material "Research in progress";
show Mundari Bani script beside every Mundari word; use only public-domain
or openly licensed (CC BY / CC BY-SA / CC0) photographs, credited on the
page and in About.

## Deploying to Cloudflare Pages

The project `mundarisamaj` uses **Direct Upload** (it is not connected to
GitHub):

1. Zip the whole site folder (this README's folder) — files and folders
   must keep their structure inside the zip.
2. Cloudflare dashboard → Workers & Pages → `mundarisamaj` →
   Create deployment → upload the zip → Deploy.
3. Check https://mundarisamaj.pages.dev (hard-refresh once if the old
   version is cached).

## Publishing to GitHub

Two repositories mirror this site:

- `catversstudio/mundari-samaj` — main mirror of the Cloudflare site.
- `catversstudio/mundarisamaj` — GitHub Pages copy
  (https://catversstudio.github.io/mundarisamaj/).

Text files can be pushed with the GitHub connector's snapshot sync;
binary files (photographs, the preview banner) must be uploaded through
the GitHub web UI ("Add file → Upload files"), because the connector
accepts text only. After every live Cloudflare deploy, push the same
code to GitHub.

## Credits

Photographs are from Wikimedia Commons under the licences credited on
each page and in About ("Photo & media credits"). Videos are embedded
with YouTube's official player; social posts are linked or embedded by
official methods only — never downloaded or re-uploaded.


## v13 additions (2026-11-03)
- Full sourced biographies of Birsa Munda and Rohidas Singh Nag are records in
  `content/articles.json` (category "People & Personalities"). A record may carry a
  `sources` array of {label, url} — rendered as a "Sources & further reading" block
  at the end of the article.
- The Gallery accepts social-preview records in `content/gallery.json`:
  {type: "social", platform: "instagram"|"facebook", url, title, caption, credit,
  status: "published"}. The post is embedded by link only — media is never copied.
- Music & Videos page (`videos.html`) reads `content/videos.json`:
  {id, title, channel, category, youtube: "<video id>", note, status: "published"}.
  Videos play through YouTube's official embedded player (youtube-nocookie).
  To add a video: append a record with its YouTube video ID and redeploy.


## v14 (2026-11-03) — faster videos, one player, restricted queue
- The Videos page no longer loads 12 YouTube iframes. Cards show lightweight
  YouTube thumbnails; clicking one opens a single watch player at the top of
  the page (player, then description, then the other videos below). Only one
  video can play at a time.
- The watch player is restricted to this site's own list: it is loaded with
  `playlist=<all curated video ids>` and `rel=0`, so Up Next / end-screen
  suggestions stay inside `content/videos.json` instead of drifting to
  unrelated videos.
- The homepage "Watch & learn" embeds use the same click-to-play thumbnails
  (class `fx-facade`, attribute `data-yt`); a small handler in features.js
  keeps at most one live player on any page.
