/* Mundari Samaj v5 — feature loader (Articles / News / Stories / Gallery).
   Extends the v4 loader with the v5 media schema: optional featured image
   ("image"), ordered "media" items (image / youtube / instagram / x /
   facebook / link, official embed methods only, lazy, with fallback
   links), "related" records rendered as Related reading cards, and share
   buttons on detail views. Gallery tiles show real photos when a record
   has one and keep the tone-tile fallback otherwise. Only
   status==="published" records render; unverified articles keep the
   Editorial note. */
const paths={articles:"content/articles.json",news:"content/news.json",stories:"content/stories.json",gallery:"content/gallery.json",videos:"content/videos.json",books:"content/books.json"};
const $=s=>document.querySelector(s);
const esc=s=>String(s||"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const apiType={articles:"article",news:"news",stories:"story",gallery:"gallery",videos:"video",books:"book"};
async function load(k){if(apiType[k]){try{let r=await fetch("/api/content?type="+apiType[k]+"&per=200");if(r.ok){let j=await r.json();if(j&&j.ok&&Array.isArray(j.items))return j.items}}catch(e){}}try{let r=await fetch(paths[k]);return r.ok?await r.json():[]}catch(e){return[]}}
const published=x=>x.status==="published";
function art(t){return `<div class="fx-card-art" data-tone="${esc(t||"sage")}"></div>`}
function thumb(x){return x.image&&x.image.src?`<img class="fx-card-img" src="${esc(x.image.src)}" alt="${esc(x.image.caption||x.title)}" loading="lazy" decoding="async">`:art(x.tone)}
function card(x){return `<article class="fx-content-card">${thumb(x)}<div class="fx-card-body"><span class="fx-tag">${esc(x.category)} · ${esc(x.readTime)}</span><h3>${esc(x.title)}</h3><p>${esc(x.excerpt)}</p><div class="fx-card-foot"><span>${esc(x.date)}</span><a href="article.html?id=${encodeURIComponent(x.id)}">Read article ↗</a></div></div></article>`}
function photoSlug(x){return x._slug||x.id||String(x.title||"").toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-+|-+$/g,"");}
function photoFrame(x){
  const src=x.image&&x.image.src;if(!src)return "";
  return `<a class="fx-photo-frame" href="photo.html?id=${encodeURIComponent(photoSlug(x))}"><span class="fx-photo-img"><img src="${esc(src)}" alt="${esc(x.image.caption||x.title)}" loading="lazy" decoding="async"></span><span class="fx-photo-title">${esc(x.title)}</span></a>`;
}
function galleryTile(x){
  if(x.type==="social"&&x.url){let emb="";
    if(x.platform==="instagram"){let g=igCode(x);if(g.code)emb=`<div class="fx-embed fx-embed-tall"><iframe src="https://www.instagram.com/${g.kind}/${g.code}/embed" title="${esc(x.title||"Instagram post")}" loading="lazy" allowfullscreen></iframe></div>`}
    else if(x.platform==="facebook"){emb=`<div class="fx-embed"><iframe src="https://www.facebook.com/plugins/post.php?href=${encodeURIComponent(x.url)}&show_text=true" title="${esc(x.title||"Facebook post")}" loading="lazy" allowfullscreen></iframe></div>`}
    if(emb)return `<figure class="fx-gallery-tile has-embed">${emb}<figcaption class="fx-gallery-cap"><b>${esc(x.title)}</b><span>${esc(x.caption||"")}</span><span class="fx-gallery-credit">${esc(x.credit||"")}</span><a href="${esc(x.url)}" target="_blank" rel="noopener">View on Instagram ↗</a></figcaption></figure>`}
  if(x.image&&x.image.src)return `<figure class="fx-gallery-tile has-img"><img src="${esc(x.image.src)}" alt="${esc(x.image.caption||x.title)}" loading="lazy" decoding="async"><figcaption class="fx-gallery-cap"><b>${esc(x.title)}</b><span>${esc(x.caption)}</span><span class="fx-gallery-credit">${esc(x.credit||"")}</span></figcaption></figure>`;
  return `<div class="fx-gallery-tile"><b>${esc(x.title)}</b></div>`;
}
function ytId(m){
  if(m.id)return String(m.id);
  let u=String(m.url||"");let r=u.match(/(?:youtube(?:-nocookie)?\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{6,})/);
  return r?r[1]:(/^[\w-]{6,}$/.test(u)?u:"");
}
function igCode(m){
  let u=String(m.url||m.id||"");let r=u.match(/instagram\.com\/(p|reel|reels)\/([\w-]+)/);
  if(r)return{kind:r[1]==="p"?"p":"reel",code:r[2]};
  return{kind:"p",code:u};
}
function xId(m){
  let u=String(m.url||m.id||"");let r=u.match(/status\/(\d+)/);
  return r?r[1]:(/^\d+$/.test(u)?u:"");
}
function mediaItem(m){
  if(!m||!m.type)return"";
  let cap=m.caption?`<figcaption>${esc(m.caption)}${m.credit?` <span class="fx-credit">${esc(m.credit)}</span>`:""}</figcaption>`:"";
  if(m.type==="image"&&m.url)return `<figure class="fx-figure"><img src="${esc(m.url)}" alt="${esc(m.caption||"")}" loading="lazy" decoding="async">${cap}</figure>`;
  if(m.type==="youtube"){let id=ytId(m);if(!id)return"";
    return `<figure class="fx-figure"><div class="fx-embed"><iframe src="https://www.youtube-nocookie.com/embed/${esc(id)}" title="${esc(m.caption||"YouTube video")}" loading="lazy" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe></div>${cap}<p class="fx-fallback"><a href="https://www.youtube.com/watch?v=${esc(id)}" target="_blank" rel="noopener">Watch on YouTube ↗</a></p></figure>`}
  if(m.type==="instagram"){let g=igCode(m);if(!g.code)return"";let eu=`https://www.instagram.com/${g.kind}/${g.code}/embed`;let ou=String(m.url||`https://www.instagram.com/${g.kind}/${g.code}/`);
    return `<figure class="fx-figure"><div class="fx-embed fx-embed-tall"><iframe src="${esc(eu)}" title="${esc(m.caption||"Instagram post")}" loading="lazy" allowfullscreen></iframe></div>${cap}<p class="fx-fallback"><a href="${esc(ou)}" target="_blank" rel="noopener">View on Instagram ↗</a></p></figure>`}
  if(m.type==="x"){let id=xId(m);if(!id)return"";let ou=String(m.url||`https://twitter.com/i/web/status/${id}`);
    return `<figure class="fx-figure"><div class="fx-embed fx-embed-tall"><iframe src="https://platform.twitter.com/embed/Tweet.html?id=${esc(id)}" title="${esc(m.caption||"Post on X")}" loading="lazy"></iframe></div>${cap}<p class="fx-fallback"><a href="${esc(ou)}" target="_blank" rel="noopener">View post on X ↗</a></p></figure>`}
  if(m.type==="facebook"){let u=String(m.url||"");if(!u)return"";let plug=/video|watch/.test(u)?"video.php":"post.php";let eu=`https://www.facebook.com/plugins/${plug}?href=${encodeURIComponent(u)}&show_text=true`;
    return `<figure class="fx-figure"><div class="fx-embed"><iframe src="${esc(eu)}" title="${esc(m.caption||"Facebook post")}" loading="lazy" allowfullscreen></iframe></div>${cap}<p class="fx-fallback"><a href="${esc(u)}" target="_blank" rel="noopener">View on Facebook ↗</a></p></figure>`}
  if(m.type==="link"&&m.url)return `<p class="fx-media-link"><a href="${esc(m.url)}" target="_blank" rel="noopener">${esc(m.caption||m.url)} ↗</a></p>`;
  return"";
}
function shareBlock(x,k){
  let page=k==="articles"?"article.html":k+".html";
  let url=`https://mundarisamaj.pages.dev/${page}?id=${encodeURIComponent(x.id)}`;
  let t=encodeURIComponent(x.title),u=encodeURIComponent(url);
  return `<div class="fx-share" aria-label="Share this"><span>Share:</span>`+
   `<a href="https://wa.me/?text=${t}%20${u}" target="_blank" rel="noopener">WhatsApp</a>`+
   `<a href="https://www.facebook.com/sharer/sharer.php?u=${u}" target="_blank" rel="noopener">Facebook</a>`+
   `<a href="https://twitter.com/intent/tweet?text=${t}&url=${u}" target="_blank" rel="noopener">X</a>`+
   `<a href="https://t.me/share/url?url=${u}&text=${t}" target="_blank" rel="noopener">Telegram</a></div>`;
}
const LANGS=[["en","English"],["unr","Mundari"],["or","Odia"],["hi","Hindi"],["bn","Bengali"]];
const LANGNAME={en:"English",unr:"Mundari",or:"Odia",hi:"Hindi",bn:"Bengali"};
function srcLabel(s){
  if(!s) return "";
  if(s.label) return s.label;
  let meta=[s.author,s.publisher,s.year].filter(Boolean).join(", ");
  return (s.title||"")+(meta?" — "+meta:"");
}
function wireLang(x,el){
  const sel=el.querySelector("#fx-lang"); if(!sel) return;
  const note=el.querySelector("#fx-lang-note"), cur=el.querySelector("#fx-lang-cur");
  const titleEl=el.querySelector(".fx-title"), leadEl=el.querySelector(".fx-lead"),
        bodyEl=el.querySelector(".fx-body-copy"), creditEl=el.querySelector("#fx-trans-credit");
  const orig={t:titleEl.textContent, l:leadEl.textContent, b:bodyEl.innerHTML};
  let now="en";
  const avail=c=>c==="en"||(x.translations||[]).includes(c);
  sel.addEventListener("change", async ()=>{
    const c=sel.value;
    if(c===now) return;
    if(!avail(c)){
      note.textContent="This article is not yet available in "+LANGNAME[c]+". Translations are added only after they have been supplied and reviewed by a competent speaker.";
      note.hidden=false; sel.value=now; return;
    }
    if(c==="en"){
      titleEl.textContent=orig.t; leadEl.textContent=orig.l; bodyEl.innerHTML=orig.b;
      if(creditEl) creditEl.textContent=""; note.hidden=true; now="en"; cur.textContent="Currently: English"; return;
    }
    try{
      const r=await fetch("content/i18n/"+encodeURIComponent(x.id)+"."+c+".json");
      if(!r.ok) throw new Error("missing");
      const tr=await r.json();
      titleEl.textContent=tr.translatedTitle||orig.t;
      leadEl.textContent=tr.translatedSummary||orig.l;
      bodyEl.innerHTML=(Array.isArray(tr.content)?tr.content:[]).map(v=>v.type==="h2"?`<h2>${esc(v.text)}</h2>`:`<p>${esc(v.text)}</p>`).join("");
      if(creditEl) creditEl.textContent="Translation"+(tr.translationStatus?": "+tr.translationStatus:"")+(tr.reviewer?" · Reviewed by "+tr.reviewer:"")+(tr.reviewedAt?" · "+tr.reviewedAt:"")+(tr.region?" · Variety/region: "+tr.region:"");
      note.hidden=true; now=c; cur.textContent="Currently: "+LANGNAME[c];
    }catch(e){
      note.textContent="This article is not yet available in "+LANGNAME[c]+".";
      note.hidden=false; sel.value=now;
    }
  });
}
function detail(x,k,el,all){
  const isArt = k==="articles";
  let h2n=0;
  let b=Array.isArray(x.body)?x.body.map(v=>{
    if(v.type==="h2"){ h2n++; return isArt?`<h2 id="sec-${h2n}">${esc(v.text)}</h2>`:`<h2>${esc(v.text)}</h2>` }
    return `<p>${esc(v.text)}</p>`}).join(""):`<p>${esc(x.body)}</p>`;
  let toc="";
  if(isArt && h2n>=3 && Array.isArray(x.body)){
    let i=0;
    toc=`<nav class="fx-toc" aria-label="Table of contents"><h2>Contents</h2><ol>${x.body.filter(v=>v.type==="h2").map(v=>`<li><a href="#sec-${++i}">${esc(v.text)}</a></li>`).join("")}</ol></nav>`;
  }
  let feat=x.image&&x.image.src?`<figure class="fx-figure fx-featured"><img src="${esc(x.image.src)}" alt="${esc(x.image.caption||x.title)}" loading="lazy" decoding="async"><figcaption>${esc(x.image.caption||"")}${x.image.credit?` <span class="fx-credit">${esc(x.image.credit)}</span>`:""}</figcaption></figure>`:"";
  let media=Array.isArray(x.media)?x.media.map(mediaItem).join(""):"";
  let rel="";
  if(Array.isArray(x.related)&&all){let cards=x.related.map(id=>(all||[]).find(y=>y.id===id)).filter(y=>y&&published(y)).map(y=>{
     if(k==="articles")return card(y);
     if(k==="stories")return `<article class="fx-content-card"><div class="fx-card-body"><span class="fx-tag">${esc(y.place)}</span><h3>${esc(y.title)}</h3><p>${esc(y.excerpt)}</p><a href="stories.html?id=${encodeURIComponent(y.id)}">Read story →</a></div></article>`;
     return `<article class="fx-content-card"><div class="fx-card-body"><span class="fx-tag">${esc(y.category)} · ${esc(y.date)}</span><h3>${esc(y.title)}</h3><p>${esc(y.excerpt)}</p><a href="news.html?id=${encodeURIComponent(y.id)}">Read update →</a></div></article>`}).join("");
   if(cards)rel=`<h2 class="fx-related-h">Related reading</h2><div class="fx-card-grid">${cards}</div>`}
  let srcs=Array.isArray(x.sources)&&x.sources.length?`<div class="fx-sources"><h2>Sources &amp; further reading</h2><ul>${x.sources.map(s=>`<li>${s.type?`<span class="fx-src-type">${esc(s.type)}</span> `:""}${s.url?`<a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(srcLabel(s))}</a>`:esc(srcLabel(s))}</li>`).join("")}</ul><p class="fx-sources-note">Facts in this profile were compiled from the sources above. Corrections from the community are welcome — see the Contribute page.</p></div>`:"";
  let metaBits=[`By ${esc(x.author||x.contributor||"Mundari Samaj")}`];
  if(x.readTime)metaBits.push(esc(x.readTime));
  if(isArt&&x.region)metaBits.push("Region: "+esc(x.region));
  if(isArt&&x.updatedAt)metaBits.push("Updated "+esc(x.updatedAt));
  if(isArt&&x.reviewStatus)metaBits.push("Status: "+esc(x.reviewStatus));
  let langbar="";
  if(isArt){
    const avail=c=>c==="en"||(x.translations||[]).includes(c);
    langbar=`<div class="fx-langbar"><label for="fx-lang">Read in:</label><select id="fx-lang" aria-label="Choose reading language">${LANGS.map(([c,n])=>`<option value="${c}"${c==="en"?" selected":""}>${n}${avail(c)?"":" — not yet available"}</option>`).join("")}</select><span class="fx-lang-cur" id="fx-lang-cur">Currently: English</span></div><div class="fx-lang-note" id="fx-lang-note" hidden></div><p class="fx-meta" id="fx-trans-credit"></p>`;
  }
  el.innerHTML=`<article class="fx-article-layout"><a href="${k}.html">← Back</a><p class="section-kicker">${esc(x.category)} · ${esc(x.date)}</p><h1 class="fx-title">${esc(x.title)}</h1><p class="fx-lead">${esc(x.excerpt)}</p><p class="fx-meta">${metaBits.join(" · ")}</p>${langbar}${x.verified===false?'<div class="fx-notice"><b>Editorial note:</b> Introductory material. Check community-specific claims with reliable sources and relevant knowledge holders.</div>':""}${feat}${toc}<div class="fx-body-copy">${b}</div>${media}${srcs}${shareBlock(x,k)}${rel}</article>`;
  if(isArt) wireLang(x,el);
}
async function home(){
  const grid=$("#article-grid");if(!grid)return;
  let [a,n,s,g]=await Promise.all(["articles","news","stories","gallery"].map(load));
  let f="all";
  function show(){let list=a.filter(x=>published(x)&&(f==="all"||x.category===f));grid.innerHTML=list.slice(0,3).map(card).join("");const c=$("#article-count");if(c)c.textContent=list.length+" articles"}
  show();
  const flt=$("#article-filters");
  if(flt)flt.onclick=e=>{let b=e.target.closest("[data-filter]");if(!b)return;f=b.dataset.filter;document.querySelectorAll(".fx-chip").forEach(x=>x.classList.toggle("active",x===b));show()};
  const nl=$("#news-list");
  if(nl)nl.innerHTML=n.filter(published).map(x=>`<article class="fx-news-item"><div class="fx-news-date">${esc(x.date)}<br>${esc(x.category)}</div><div><h3>${esc(x.title)}</h3><p>${esc(x.excerpt)}</p></div><a href="news.html?id=${x.id}">↗</a></article>`).join("");
  const sg=$("#story-grid");
  if(sg)sg.innerHTML=s.filter(published).slice(0,2).map(x=>`<article class="fx-story-card">${x.image&&x.image.src?`<img class="fx-card-img" src="${esc(x.image.src)}" alt="${esc(x.image.caption||x.title)}" loading="lazy" decoding="async">`:""}<span class="fx-tag">${esc(x.place)}</span><h3>${esc(x.title)}</h3><p>${esc(x.excerpt)}</p></article>`).join("");
  const gg=$("#gallery-grid");
  if(gg)gg.innerHTML=g.filter(x=>published(x)&&x.image&&x.image.src).slice(0,8).map(photoFrame).join("");
  const gs=$("#global-search"),sb=$("#search-button"),sr=$("#search-results");
  if(gs&&sb&&sr){
    let run=()=>{let q=gs.value.toLowerCase().trim();let all=[...a.map(x=>({...x,t:"Article",u:"article.html"})),...n.map(x=>({...x,t:"News",u:"news.html"})),...s.map(x=>({...x,t:"Story",u:"stories.html"}))].filter(x=>published(x)&&q&&(x.title+" "+x.excerpt+" "+x.category).toLowerCase().includes(q));sr.innerHTML=all.map(x=>`<a href="${x.u}?id=${x.id}"><b>${esc(x.title)}</b> — ${x.t}</a>`).join("")||(q?"<p>No results found.</p>":"")};
    sb.onclick=run;gs.onkeydown=e=>{if(e.key==="Enter")run()};
  }
}
function galleryFeed(el,d){
  el.innerHTML=`<div class="fx-gallery-feed" id="gallery-feed"></div><div class="fx-feed-note" id="gallery-more">Keep scrolling — more photos keep coming.</div>`;
  const feed=el.querySelector("#gallery-feed"),more=el.querySelector("#gallery-more");
  let pos=0,cycle=0,busy=false;const BATCH=4;
  function tile(x){
    if(x.type==="social"&&x.url){
      if(x.thumb)return `<figure class="fx-feed-item fx-feed-ig"><img src="${esc(x.thumb)}" alt="${esc(x.title||"Instagram post")}" loading="lazy" decoding="async" onerror="this.closest('figure').classList.add('no-thumb');this.remove()"><figcaption><span class="fx-feed-kicker">Instagram · @mundarisamaj</span><b>${esc(x.title||"")}</b><span>${esc(x.caption||"")}</span><a class="fx-feed-ig-link" href="${esc(x.url)}" target="_blank" rel="noopener">View on Instagram ↗</a></figcaption></figure>`;
      return galleryTile(x);
    }
    if(x.image&&x.image.src)return `<figure class="fx-feed-item"><img src="${esc(x.image.src)}" alt="${esc(x.image.caption||x.title)}" loading="lazy" decoding="async"><figcaption><b>${esc(x.title)}</b><span>${esc(x.caption||"")}</span><span class="fx-gallery-credit">${esc(x.credit||"")}</span></figcaption></figure>`;
    return `<div class="fx-feed-note-card"><b>${esc(x.title||"")}</b><span>${esc(x.caption||"")}</span></div>`;
  }
  function batch(){
    if(busy||!d.length)return;busy=true;
    let html="";
    for(let i=0;i<BATCH;i++){html+=tile(d[pos]);pos++;if(pos>=d.length){pos=0;cycle++}}
    let w=document.createElement("div");w.innerHTML=html;
    while(w.firstChild)feed.appendChild(w.firstChild);
    setTimeout(()=>{busy=false},250);
  }
  batch();batch();
  if("IntersectionObserver" in window){new IntersectionObserver(es=>{if(es.some(e=>e.isIntersecting))batch()},{rootMargin:"700px"}).observe(more)}
  else{more.textContent=""}
}

function feedCard(x,href,tag){
 const img=(x.image&&x.image.src)||x.featured_image||null;
 const media=img?`<a class="fx-feed-media" href="${esc(href)}"><img src="${esc(img)}" alt="${esc(x.title||"")}" loading="lazy" decoding="async"></a>`:"";
 return `<article class="fx-feed-card">${media}<div class="fx-feed-body"><span class="fx-tag">${esc(tag||x.category||"")}${x.date?" · "+esc(x.date):""}</span><h3><a href="${esc(href)}">${esc(x.title)}</a></h3><p>${esc(x.excerpt||x.summary||"")}</p><a class="fx-feed-more" href="${esc(href)}">Read in full →</a></div></article>`;
}
async function listing(k){
  const el=$("#page-list");if(!el)return;
  let d=await load(k),id=new URLSearchParams(location.search).get("id");
  if(id){let x=d.find(y=>y.id===id);if(x)detail(x,k,el,d);else el.innerHTML='<div class="fx-empty-state">Content not found.</div>';return}
  d=d.filter(published);
  if(k==="news"){el.innerHTML='<div class="fx-feed-list">'+d.map(x=>`<article class="fx-feed-card"><div class="fx-feed-body"><span class="fx-tag">${esc(x.date||"")} · ${esc(x.category||"Update")}</span><h3>${esc(x.title)}</h3><p>${esc(x.excerpt||"")}</p><a class="fx-feed-more" href="news.html?id=${x.id}">Read the full update →</a></div></article>`).join("")+"</div>"}
  else if(k==="gallery"){galleryFeed(el,d)}
  else if(k==="stories"){el.innerHTML='<div class="fx-feed-list">'+d.map(x=>feedCard(x,"stories.html?id="+x.id,x.place)).join("")+"</div>"}
  else el.innerHTML='<div class="fx-feed-list">'+d.map(x=>feedCard(x,k+".html?id="+x.id,x.category)).join("")+"</div>";
}
async function videosPage(){
  const el=$("#page-list");if(!el)return;
  let d=(await load("videos")).filter(published);
  let cats=["All",...new Set(d.map(v=>v.category))];let f="All";let q="";let current=null;
  el.innerHTML=
  `<div class="fx-watchbox" id="watch-box" hidden>
    <div class="fx-watch-layout">
      <div class="fx-watch-main">
        <div class="fx-embed" id="watch-player"></div>
        <h2 class="fx-w-title" id="w-title"></h2>
        <div class="fx-w-row">
          <div class="fx-w-channel"><span class="fx-avatar" id="w-avatar">M</span><span class="fx-w-chmeta"><b id="w-channel"></b><small id="w-cat"></small></span></div>
          <div class="fx-w-actions">
            <span class="fx-like-pill"><a id="w-like" href="#" target="_blank" rel="noopener" title="Like on YouTube">\u{1F44D} Like</a><span class="fx-like-sep"></span><a id="w-dislike" href="#" target="_blank" rel="noopener" title="Dislike on YouTube">\u{1F44E}</a></span>
            <button class="fx-w-btn" id="w-share" type="button">\u{2197} Share</button>
            <button class="fx-w-btn" id="watch-close" type="button">\u{2715} Band</button>
          </div>
        </div>
        <p class="fx-w-hint">Video YouTube ke asli player mein chal raha hai. Asli likes, views aur comments ke liye video ko YouTube par kholein.</p>
        <div class="fx-about-box"><b id="w-about-head"></b><p id="w-note"></p><p><a id="w-ytlink" href="#" target="_blank" rel="noopener">Watch on YouTube \u{2197}</a></p></div>
        <div class="fx-comments-box"><h3>Comments</h3><div class="fx-comment-row"><span class="fx-avatar fx-avatar-user">\u{270E}</span><p>Is video par apni baat YouTube ke comments mein likhein \u{2014} wahan channel aur poori community padhti aur jawab deti hai.<br><a class="fx-comments-link" id="w-comments" href="#" target="_blank" rel="noopener">YouTube par comments padhein / likhein \u{2197}</a></p></div></div>
      </div>
      <aside class="fx-upnext"><h3>Up next</h3><div id="upnext-list"></div></aside>
    </div>
  </div>`+
  `<div class="fx-vsearch"><span>\u{2315}</span><input type="search" id="v-q" placeholder="Search our videos \u{2014} title, channel, topic\u{2026}" aria-label="Search our videos"><span class="fx-vcount" id="v-count"></span></div>`+
  `<div class="fx-chips" id="video-filters">${cats.map(c=>`<button class="fx-chip" data-vf="${esc(c)}">${esc(c)}</button>`).join("")}</div>`+
  `<div class="fx-card-grid" id="video-grid"></div>`+
  `<p class="fx-video-note">Ek samay par ek hi video chalta hai \u{2014} dusra chalane par pehla ruk jata hai, taaki page tez rahe. Saare videos YouTube ke asli player mein chalte hain; kuch bhi download, copy ya re-upload nahi hota \u{2014} views aur credit channel ko hi milte hain. Koi Mundari video yahan hona chahiye? Contribute page se uska YouTube link bhejiye.</p>`;
  const grid=$("#video-grid"),box=$("#watch-box"),player=$("#watch-player");
  function matches(v){return (f==="All"||v.category===f)&&(!q||(v.title+" "+v.channel+" "+v.category+" "+(v.note||"")).toLowerCase().includes(q));}
  function cardHtml(v){
    return `<article class="fx-content-card fx-video-card${current===v.id?" is-active":""}"><div class="fx-embed"><button class="fx-facade" data-vid="${esc(v.id)}" aria-label="Play: ${esc(v.title)}"><img src="https://i.ytimg.com/vi/${esc(v.youtube)}/hqdefault.jpg" alt="${esc(v.title)}" loading="lazy" decoding="async"><span class="fx-play-badge" aria-hidden="true">\u{25B6}</span></button></div><div class="fx-card-body"><span class="fx-tag">${esc(v.category)}${current===v.id?" \u{B7} Now playing":""}</span><h3>${esc(v.title)}</h3><p>${esc(v.note||"")}</p><div class="fx-card-foot"><span>${esc(v.channel)}</span><a href="https://www.youtube.com/watch?v=${esc(v.youtube)}" target="_blank" rel="noopener">Watch on YouTube \u{2197}</a></div></div></article>`;
  }
  function renderGrid(){
    const list=d.filter(matches);
    grid.innerHTML=list.length?list.map(cardHtml).join(""):`<p class="fx-noresult">Hamari library mein is naam ka video nahi mila. Kuch aur likh kar dekhein \u{2014} ya <a href="https://www.youtube.com/results?search_query=${encodeURIComponent(q||"mundari")}" target="_blank" rel="noopener">poora YouTube yahan se khojein \u{2197}</a></p>`;
    $("#v-count").textContent=list.length+" video"+(list.length===1?"":"s");
    document.querySelectorAll("#video-filters .fx-chip").forEach(c=>c.classList.toggle("active",c.dataset.vf===f));
  }
  function renderUpnext(v){
    const others=d.filter(x=>x.id!==v.id).slice().sort((a,b)=>((b.category===v.category)?1:0)-((a.category===v.category)?1:0));
    $("#upnext-list").innerHTML=others.map(x=>`<button class="fx-upnext-item" data-up="${esc(x.id)}"><span class="fx-upnext-thumb"><img src="https://i.ytimg.com/vi/${esc(x.youtube)}/hqdefault.jpg" alt="" loading="lazy" decoding="async"></span><span class="fx-upnext-meta"><b>${esc(x.title)}</b><small>${esc(x.channel)} \u{B7} ${esc(x.category)}</small></span></button>`).join("");
  }
  function play(v,scroll=true){
    current=v.id;
    const yt="https://www.youtube.com/watch?v="+v.youtube;
    player.innerHTML=`<iframe src="https://www.youtube-nocookie.com/embed/${v.youtube}?autoplay=1&rel=0&playsinline=1" title="${esc(v.title)}" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe>`;
    box.hidden=false;
    $("#w-title").textContent=v.title;
    $("#w-channel").textContent=v.channel;
    $("#w-cat").textContent=v.category;
    $("#w-avatar").textContent=(v.channel||"M").trim().charAt(0).toUpperCase();
    $("#w-note").textContent=v.note||"";
    $("#w-about-head").textContent=v.category+" \u{B7} "+v.channel;
    ["w-like","w-dislike","w-ytlink","w-comments"].forEach(id=>{const a=document.getElementById(id);if(a)a.href=yt;});
    renderUpnext(v);
    renderGrid();
    if(scroll)box.scrollIntoView({behavior:"smooth",block:"start"});
  }
  $("#video-filters").onclick=e=>{let b=e.target.closest("[data-vf]");if(!b)return;f=b.dataset.vf;renderGrid()};
  $("#v-q").addEventListener("input",e=>{q=e.target.value.trim().toLowerCase();renderGrid()});
  grid.onclick=e=>{let b=e.target.closest("[data-vid]");if(!b)return;let v=d.find(x=>x.id===b.dataset.vid);if(v)play(v)};
  $("#upnext-list").onclick=e=>{let b=e.target.closest("[data-up]");if(!b)return;let v=d.find(x=>x.id===b.dataset.up);if(v)play(v)};
  $("#w-share").onclick=async()=>{const v=d.find(x=>x.id===current);if(!v)return;const url="https://www.youtube.com/watch?v="+v.youtube;try{await navigator.clipboard.writeText(url);const b=$("#w-share");b.textContent="\u{2713} Link copy";setTimeout(()=>{b.textContent="\u{2197} Share"},1800);}catch(e){window.open(url,"_blank","noopener");}};
  $("#watch-close").onclick=()=>{player.innerHTML="";box.hidden=true;current=null;renderGrid()};
  renderGrid();
}
/* Click-to-play facades (e.g. homepage Watch & learn): only ONE live player
   on the page — activating a facade restores the previous one to its
   thumbnail, so two videos can never play at once. */
let liveFacade=null,liveHtml="";
document.addEventListener("click",e=>{
  let b=e.target.closest(".fx-facade[data-yt]");if(!b||liveFacade===b)return;
  if(liveFacade){liveFacade.innerHTML=liveHtml;liveFacade.classList.remove("is-playing")}
  liveFacade=b;liveHtml=b.innerHTML;b.classList.add("is-playing");
  b.innerHTML=`<iframe src="https://www.youtube-nocookie.com/embed/${esc(b.dataset.yt)}?autoplay=1&rel=0&playsinline=1" title="${esc(b.getAttribute("aria-label")||"YouTube video")}" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe>`;
});
document.addEventListener("DOMContentLoaded",()=>{if($("#article-grid"))home();if($("#rails-mount"))homeRails();let p=document.body.dataset.page;if(p==="videos")videosPage();else if(p)listing(p)});

/* ---- Stage 2: homepage category rails (History first, then all categories).
   One single left-right scrollable row per category (owner's v21 correction:
   no double rows), View All card at the end of the row and at the top-right.
   Data comes from /api/home (database); if that is unavailable the rails are
   built from the same content/*.json files the site has always used. ---- */
const RAIL_STATIC={
 script:[{t:"Mundari Bani Script",s:"The 27-letter script created by Rohidas Singh Nag",img:"assets/img/mundari-bani-script-chart.jpg",href:"script.html"},{t:"Grammar & Structure",s:"How Mundari words and sentences are built",href:"grammar.html"},{t:"Learn Mundari",s:"Everyday words, phrases and practice",href:"learn.html"},{t:"The Alphabet",s:"Every Bani letter with its sound",img:"assets/img/mundari-bani-script-chart.jpg",href:"script.html"}],
 language:[{t:"The Mundari Language",s:"Horo jagar — history, speakers and status",href:"language.html"},{t:"Dictionary",s:"Mundari words in Bani and Roman script",href:"dictionary.html"},{t:"Grammar",s:"Verbs, cases and sentence patterns",href:"grammar.html"},{t:"Learn & Practise",s:"Start speaking with guided lessons",href:"learn.html"}],
 movement:[{t:"The Language Movement",s:"The living effort to keep Mundari strong",img:"assets/img/nag-birthday-celebration-01.jpg",href:"movement.html"},{t:"History",s:"From early times to the present day",img:"assets/img/sarhul-sarna-grove.jpg",href:"history.html"},{t:"People & Leaders",s:"Birsa Munda, Rohidas Singh Nag and more",img:"assets/img/rohidas-singh-nag.jpg",href:"people.html"}],
 culture:[{t:"Culture & Traditions",s:"Festivals, dance, music, food and craft",img:"assets/img/sarhul-dance-ranchi.jpg",href:"culture.html"},{t:"Sarhul",s:"The festival of flowers at the Sarna grove",img:"assets/img/sarhul-sarna-grove.jpg",href:"sarhul.html"},{t:"Karam",s:"The Karam branch, song and all-night dance",img:"assets/img/karam-festival.jpg",href:"karam.html"},{t:"Sohrai",s:"Harvest lamps and wall painting",img:"assets/img/sohrai-wall-art-isko.jpg",href:"sohrai.html"}]
};
function railCard(o){
 if(o.viewall)return `<a class="fx-rail-card fx-rail-viewall" href="${esc(o.href||"#")}"><span class="fx-rail-media"><span class="fx-rail-art"><span class="fx-rail-arrow">→</span></span></span><span class="fx-rail-body"><b>View All</b></span></a>`;
 const media=o.img?`<img src="${esc(o.img)}" alt="" loading="lazy" width="480" height="360" onerror="this.style.display='none'">`:"";
 const art=`<span class="fx-rail-art">${o.bani?`<span class="fx-rail-bani">${esc(o.bani)}</span>`:"✳"}</span>`;
 return `<a class="fx-rail-card" href="${esc(o.href||"#")}"><span class="fx-rail-media">${art}${media}</span><span class="fx-rail-body"><b>${esc(o.t)}</b></span></a>`;
}
function railSection(id,title,viewAll,items){
 if(!items||!items.length)return "";
 items=items.slice(0,10);
 const va={t:"View All",s:"See everything in this section",href:viewAll,viewall:true};
 const all=items.concat([va]);
 const rows=`<div class="fx-rail">${all.map(railCard).join("")}</div>`;
 return `<div class="fx-rail-sec" id="rail-${id}"><div class="fx-rail-head"><h2>${esc(title)}</h2><span class="fx-rail-tools"><span class="fx-rail-hint" aria-hidden="true">slide →</span><a class="fx-viewall" href="${esc(viewAll)}">View All →</a></span></div>${rows}</div>`;
}
const toCard=(x,href)=>({t:x.title,s:x.excerpt||x.category||x.date||"",img:x.image&&x.image.src?x.image.src:(x.featured_image||null),href});
async function homeRails(){
 const mount=$("#rails-mount");if(!mount)return;
 let groups=null,dict=[];
 try{let r=await fetch("/api/home");if(r.ok){let j=await r.json();if(j&&j.ok){groups=j.groups;dict=j.dictionary||[]}}}catch(e){}
 if(!groups){
   const [a,n,st,v,g,bk]=await Promise.all([load("articles"),load("news"),load("stories"),load("videos"),load("gallery"),load("books")]);
   const pub=x=>x.status==="published";
   groups={articles:a.filter(pub),news:n.filter(pub),stories:st.filter(pub),videos:v.filter(pub),gallery:g.filter(pub),books:bk.filter(pub),people:a.filter(x=>pub(x)&&x.category==="People & Personalities"),history:a.filter(x=>pub(x)&&x.category==="History")};
 }
 const histPinned=[{t:"Mundari History",s:"The story of the Mundari people and their land",img:"assets/img/sarhul-sarna-grove.jpg",href:"history.html"},{t:"Birsa Munda",s:"Dharti Aaba — the hero of the Ulgulan",img:"assets/img/birsa-munda-portrait.jpg",href:"article.html?id=birsa-munda"},{t:"Rohidas Singh Nag",s:"Ol Guru — creator of the Mundari Bani script",img:"assets/img/rohidas-singh-nag.jpg",href:"article.html?id=rohidas-singh-nag"}];
 const histItems=[...histPinned,...(groups.history||[]).map(x=>toCard(x,"article.html?id="+x.id))].filter((v,i,a)=>a.findIndex(y=>y.href===v.href)===i);
 const dictCards=dict.length?dict.map(w=>({t:w.word,s:w.meaning_en||"",bani:w.bani||"",href:"dictionary.html"})):[{t:"Open the Dictionary",s:"Mundari words in Bani and Roman script",href:"dictionary.html"}];
 const bookCards=(groups.books&&groups.books.length)?groups.books.map(x=>toCard(x,"books.html")):[{t:"Books & Publications",s:"Research in progress — verified titles are being collected",href:"books.html"}];
 mount.innerHTML=[
  railSection("videos","Music & Videos","videos.html",(groups.videos||[]).map(x=>({t:x.title,s:x.channel||x.category||"",img:"https://i.ytimg.com/vi/"+x.youtube+"/hqdefault.jpg",href:"videos.html"}))),,
  railSection("dictionary","Dictionary","dictionary.html",dictCards),,
  railSection("news","News & Updates","news.html",(groups.news||[]).map(x=>toCard(x,"news.html?id="+x.id))),,
  railSection("gallery","Gallery","gallery.html",(groups.gallery||[]).map(x=>({t:x.title,s:x.caption||x.credit||"",img:x.image&&x.image.src?x.image.src:null,href:"gallery.html"}))),,
  railSection("language","Language","language.html",RAIL_STATIC.language),,
  railSection("script","Script & Writing","script.html",RAIL_STATIC.script),,
  railSection("culture","Culture & Traditions","culture.html",RAIL_STATIC.culture),,
  railSection("stories","Community Stories","stories.html",(groups.stories||[]).map(x=>toCard(x,"stories.html?id="+x.id))),,
  railSection("history","History","history.html",histItems),,
  railSection("people","People & Leaders","people.html",(groups.people||[]).map(x=>toCard(x,"article.html?id="+x.id))),,
  railSection("movement","The Movement","movement.html",RAIL_STATIC.movement),,
  railSection("articles","Articles","articles.html",(groups.articles||[]).map(x=>toCard(x,"article.html?id="+x.id))),,
  railSection("books","Books & Publications","books.html",bookCards)
 ].join("");
}
