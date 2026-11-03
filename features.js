/* Mundari Samaj v5 — feature loader (Articles / News / Stories / Gallery).
   Extends the v4 loader with the v5 media schema: optional featured image
   ("image"), ordered "media" items (image / youtube / instagram / x /
   facebook / link, official embed methods only, lazy, with fallback
   links), "related" records rendered as Related reading cards, and share
   buttons on detail views. Gallery tiles show real photos when a record
   has one and keep the tone-tile fallback otherwise. Only
   status==="published" records render; unverified articles keep the
   Editorial note. */
const paths={articles:"content/articles.json",news:"content/news.json",stories:"content/stories.json",gallery:"content/gallery.json",videos:"content/videos.json"};
const $=s=>document.querySelector(s);
const esc=s=>String(s||"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const apiType={articles:"article",news:"news",stories:"story",gallery:"gallery",videos:"video"};
async function load(k){if(apiType[k]){try{let r=await fetch("/api/content?type="+apiType[k]+"&per=200");if(r.ok){let j=await r.json();if(j&&j.ok&&Array.isArray(j.items))return j.items}}catch(e){}}try{let r=await fetch(paths[k]);return r.ok?await r.json():[]}catch(e){return[]}}
const published=x=>x.status==="published";
function art(t){return `<div class="fx-card-art" data-tone="${esc(t||"sage")}"></div>`}
function thumb(x){return x.image&&x.image.src?`<img class="fx-card-img" src="${esc(x.image.src)}" alt="${esc(x.image.caption||x.title)}" loading="lazy" decoding="async">`:art(x.tone)}
function card(x){return `<article class="fx-content-card">${thumb(x)}<div class="fx-card-body"><span class="fx-tag">${esc(x.category)} · ${esc(x.readTime)}</span><h3>${esc(x.title)}</h3><p>${esc(x.excerpt)}</p><div class="fx-card-foot"><span>${esc(x.date)}</span><a href="article.html?id=${encodeURIComponent(x.id)}">Read article ↗</a></div></div></article>`}
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
function detail(x,k,el,all){
  let b=Array.isArray(x.body)?x.body.map(v=>v.type==="h2"?`<h2>${esc(v.text)}</h2>`:`<p>${esc(v.text)}</p>`).join(""):`<p>${esc(x.body)}</p>`;
  let feat=x.image&&x.image.src?`<figure class="fx-figure fx-featured"><img src="${esc(x.image.src)}" alt="${esc(x.image.caption||x.title)}" loading="lazy" decoding="async"><figcaption>${esc(x.image.caption||"")}${x.image.credit?` <span class="fx-credit">${esc(x.image.credit)}</span>`:""}</figcaption></figure>`:"";
  let media=Array.isArray(x.media)?x.media.map(mediaItem).join(""):"";
  let rel="";
  if(Array.isArray(x.related)&&all){let cards=x.related.map(id=>(all||[]).find(y=>y.id===id)).filter(y=>y&&published(y)).map(y=>{
     if(k==="articles")return card(y);
     if(k==="stories")return `<article class="fx-content-card"><div class="fx-card-body"><span class="fx-tag">${esc(y.place)}</span><h3>${esc(y.title)}</h3><p>${esc(y.excerpt)}</p><a href="stories.html?id=${encodeURIComponent(y.id)}">Read story →</a></div></article>`;
     return `<article class="fx-content-card"><div class="fx-card-body"><span class="fx-tag">${esc(y.category)} · ${esc(y.date)}</span><h3>${esc(y.title)}</h3><p>${esc(y.excerpt)}</p><a href="news.html?id=${encodeURIComponent(y.id)}">Read update →</a></div></article>`}).join("");
   if(cards)rel=`<h2 class="fx-related-h">Related reading</h2><div class="fx-card-grid">${cards}</div>`}
  let srcs=Array.isArray(x.sources)&&x.sources.length?`<div class="fx-sources"><h2>Sources &amp; further reading</h2><ul>${x.sources.map(s=>`<li><a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.label)}</a></li>`).join("")}</ul><p class="fx-sources-note">Facts in this profile were compiled from the sources above. Corrections from the community are welcome — see the Contribute page.</p></div>`:"";
  el.innerHTML=`<article class="fx-article-layout"><a href="${k}.html">← Back</a><p class="section-kicker">${esc(x.category)} · ${esc(x.date)}</p><h1>${esc(x.title)}</h1><p class="fx-lead">${esc(x.excerpt)}</p><p class="fx-meta">By ${esc(x.author||x.contributor||"Mundari Samaj")} · ${esc(x.readTime||"")}</p>${x.verified===false?'<div class="fx-notice"><b>Editorial note:</b> Introductory material. Check community-specific claims with reliable sources and relevant knowledge holders.</div>':""}${feat}<div class="fx-body-copy">${b}</div>${media}${srcs}${shareBlock(x,k)}${rel}</article>`;
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
  if(gg)gg.innerHTML=g.filter(published).slice(0,8).map(galleryTile).join("");
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
  let cats=["All",...new Set(d.map(v=>v.category))];let f="All";let current=null;
  let queue=d.map(v=>v.youtube).join(",");
  el.innerHTML=`<div class="fx-watchbox" id="watch-box" hidden><div class="fx-embed" id="watch-player"></div><div class="fx-watch-desc"><div class="fx-watch-desc-head"><h2 id="watch-title"></h2><button class="fx-close" id="watch-close" type="button" aria-label="Close player">✕</button></div><p class="fx-watch-meta" id="watch-meta"></p><p id="watch-note"></p><p><a id="watch-link" href="#" target="_blank" rel="noopener">Watch on YouTube ↗</a></p></div></div>`+
  `<div class="fx-chips" id="video-filters">${cats.map(c=>`<button class="fx-chip" data-vf="${esc(c)}">${esc(c)}</button>`).join("")}</div>`+
  `<div class="fx-card-grid" id="video-grid"></div>`+
  `<p class="fx-video-note">Only one video plays at a time — starting another stops the first, so the page stays fast. Videos play in YouTube's standard player with full controls — you can also continue to YouTube from inside the player for related videos and everything else YouTube offers. Nothing is downloaded, copied or re-uploaded, and channels keep their own views and credit. Know a Mundari song or video that belongs here? Send us its YouTube link from the Contribute page.</p>`;
  const hub=`<div class="fx-ythub"><h2>Search all of YouTube</h2><p>Looking for more? Search the whole of YouTube from here — results open on YouTube itself, where you have full control.</p><form class="fx-ytsearch" id="yt-search"><input type="search" id="yt-q" placeholder="Search YouTube — try: Mundari song" aria-label="Search YouTube"><button type="submit">Search YouTube ↗</button></form><div class="fx-ytchips"><a href="https://www.youtube.com/results?search_query=mundari+song" target="_blank" rel="noopener">Mundari songs</a><a href="https://www.youtube.com/results?search_query=mundari+karma+song" target="_blank" rel="noopener">Karma songs</a><a href="https://www.youtube.com/results?search_query=mundari+dance" target="_blank" rel="noopener">Mundari dance</a><a href="https://www.youtube.com/results?search_query=birsa+munda" target="_blank" rel="noopener">Birsa Munda</a><a href="https://www.youtube.com/results?search_query=mundari+language" target="_blank" rel="noopener">Mundari language</a></div></div>`;
  el.innerHTML=hub+el.innerHTML;
  const yf=$("#yt-search");if(yf)yf.addEventListener("submit",e=>{e.preventDefault();const q=($("#yt-q").value||"").trim();window.open("https://www.youtube.com/results?search_query="+encodeURIComponent(q||"mundari"),"_blank","noopener")});
  const grid=$("#video-grid"),box=$("#watch-box"),player=$("#watch-player");
  function cardHtml(v){
    return `<article class="fx-content-card fx-video-card${current===v.id?" is-active":""}"><div class="fx-embed"><button class="fx-facade" data-vid="${esc(v.id)}" aria-label="Play: ${esc(v.title)}"><img src="https://i.ytimg.com/vi/${esc(v.youtube)}/hqdefault.jpg" alt="${esc(v.title)}" loading="lazy" decoding="async"><span class="fx-play-badge" aria-hidden="true">▶</span></button></div><div class="fx-card-body"><span class="fx-tag">${esc(v.category)}${current===v.id?" · Now playing":""}</span><h3>${esc(v.title)}</h3><p>${esc(v.note||"")}</p><div class="fx-card-foot"><span>${esc(v.channel)}</span><a href="https://www.youtube.com/watch?v=${esc(v.youtube)}" target="_blank" rel="noopener">Watch on YouTube ↗</a></div></div></article>`;
  }
  function renderGrid(){
    grid.innerHTML=d.filter(v=>f==="All"||v.category===f).map(cardHtml).join("");
    document.querySelectorAll("#video-filters .fx-chip").forEach(c=>c.classList.toggle("active",c.dataset.vf===f));
  }
  function play(v,scroll=true){
    current=v.id;
    player.innerHTML=`<iframe src="https://www.youtube-nocookie.com/embed/${v.youtube}?autoplay=1" title="${esc(v.title)}" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe>`;
    box.hidden=false;
    $("#watch-title").textContent=v.title;
    $("#watch-meta").textContent=v.channel+" · "+v.category;
    $("#watch-note").textContent=v.note||"";
    $("#watch-link").href="https://www.youtube.com/watch?v="+v.youtube;
    renderGrid();
    if(scroll)box.scrollIntoView({behavior:"smooth",block:"start"});
  }
  $("#video-filters").onclick=e=>{let b=e.target.closest("[data-vf]");if(!b)return;f=b.dataset.vf;renderGrid()};
  grid.onclick=e=>{let b=e.target.closest("[data-vid]");if(!b)return;let v=d.find(x=>x.id===b.dataset.vid);if(v)play(v)};
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
   Two left-right scrollable rows per category, View All at the top-right.
   Data comes from /api/home (database); if that is unavailable the rails are
   built from the same content/*.json files the site has always used. ---- */
const RAIL_STATIC={
 script:[{t:"Mundari Bani Script",s:"The 27-letter script created by Rohidas Singh Nag",img:"assets/img/mundari-bani-script-chart.jpg",href:"script.html"},{t:"Grammar & Structure",s:"How Mundari words and sentences are built",href:"grammar.html"},{t:"Learn Mundari",s:"Everyday words, phrases and practice",href:"learn.html"},{t:"The Alphabet",s:"Every Bani letter with its sound",img:"assets/img/mundari-bani-script-chart.jpg",href:"script.html"}],
 language:[{t:"The Mundari Language",s:"Horo jagar — history, speakers and status",href:"language.html"},{t:"Dictionary",s:"Mundari words in Bani and Roman script",href:"dictionary.html"},{t:"Grammar",s:"Verbs, cases and sentence patterns",href:"grammar.html"},{t:"Learn & Practise",s:"Start speaking with guided lessons",href:"learn.html"}],
 movement:[{t:"The Language Movement",s:"The living effort to keep Mundari strong",img:"assets/img/nag-birthday-celebration-01.jpg",href:"movement.html"},{t:"History",s:"From early times to the present day",img:"assets/img/sarhul-sarna-grove.jpg",href:"history.html"},{t:"People & Leaders",s:"Birsa Munda, Rohidas Singh Nag and more",img:"assets/img/rohidas-singh-nag.jpg",href:"people.html"}],
 culture:[{t:"Culture & Traditions",s:"Festivals, dance, music, food and craft",img:"assets/img/sarhul-dance-ranchi.jpg",href:"culture.html"},{t:"Festivals",s:"Sarhul, Karam, Mage, Phagu and more",img:"assets/img/karam-festival.jpg",href:"festivals.html"},{t:"Sohrai Wall Art",s:"Harvest painting on village walls",img:"assets/img/sohrai-wall-art-isko.jpg",href:"culture.html"}]
};
function railCard(o){
 if(o.viewall)return `<a class="fx-rail-card fx-rail-viewall" href="${esc(o.href||"#")}"><span class="fx-rail-media"><span class="fx-rail-art"><span class="fx-rail-arrow">→</span></span></span><span class="fx-rail-body"><b>View All</b><small>${esc(o.s||"")}</small></span></a>`;
 const media=o.img?`<img src="${esc(o.img)}" alt="" loading="lazy" width="480" height="360" onerror="this.style.display='none'">`:"";
 const art=`<span class="fx-rail-art">${o.bani?`<span class="fx-rail-bani">${esc(o.bani)}</span>`:"✳"}</span>`;
 return `<a class="fx-rail-card" href="${esc(o.href||"#")}"><span class="fx-rail-media">${art}${media}</span><span class="fx-rail-body"><b>${esc(o.t)}</b><small>${esc(o.s||"")}</small></span></a>`;
}
function railSection(id,title,viewAll,items){
 if(!items||!items.length)return "";
 items=items.slice(0,10);
 const va={t:"View All",s:"See everything in this section",href:viewAll,viewall:true};
 const rowA=items.filter((_,i)=>i%2===0),rowB=items.filter((_,i)=>i%2===1);
 if(rowB.length)rowB.push(va);else rowA.push(va);
 let rows=`<div class="fx-rail">${rowA.map(railCard).join("")}</div>`;
 if(rowB.length)rows+=`<div class="fx-rail">${rowB.map(railCard).join("")}</div>`;
 return `<div class="fx-rail-sec" id="rail-${id}"><div class="fx-rail-head"><h2>${esc(title)}</h2><span class="fx-rail-tools"><span class="fx-rail-hint" aria-hidden="true">slide →</span><a class="fx-viewall" href="${esc(viewAll)}">View All →</a></span></div>${rows}</div>`;
}
const toCard=(x,href)=>({t:x.title,s:x.excerpt||x.category||x.date||"",img:x.image&&x.image.src?x.image.src:(x.featured_image||null),href});
async function homeRails(){
 const mount=$("#rails-mount");if(!mount)return;
 let groups=null,dict=[];
 try{let r=await fetch("/api/home");if(r.ok){let j=await r.json();if(j&&j.ok){groups=j.groups;dict=j.dictionary||[]}}}catch(e){}
 if(!groups){
   const [a,n,st,v,g]=await Promise.all([load("articles"),load("news"),load("stories"),load("videos"),load("gallery")]);
   const pub=x=>x.status==="published";
   groups={articles:a.filter(pub),news:n.filter(pub),stories:st.filter(pub),videos:v.filter(pub),gallery:g.filter(pub),books:[],people:a.filter(x=>pub(x)&&x.category==="People & Personalities"),history:a.filter(x=>pub(x)&&x.category==="History")};
 }
 const histPinned=[{t:"Mundari History",s:"The story of the Mundari people and their land",img:"assets/img/sarhul-sarna-grove.jpg",href:"history.html"},{t:"Birsa Munda",s:"Dharti Aaba — the hero of the Ulgulan",img:"assets/img/birsa-munda-portrait.jpg",href:"article.html?id=birsa-munda"},{t:"Rohidas Singh Nag",s:"Ol Guru — creator of the Mundari Bani script",img:"assets/img/rohidas-singh-nag.jpg",href:"article.html?id=rohidas-singh-nag"}];
 const histItems=[...histPinned,...(groups.history||[]).map(x=>toCard(x,"article.html?id="+x.id))].filter((v,i,a)=>a.findIndex(y=>y.href===v.href)===i);
 const dictCards=dict.length?dict.map(w=>({t:w.word,s:w.meaning_en||"",bani:w.bani||"",href:"dictionary.html"})):[{t:"Open the Dictionary",s:"Mundari words in Bani and Roman script",href:"dictionary.html"}];
 const bookCards=(groups.books&&groups.books.length)?groups.books.map(x=>toCard(x,"books.html")):[{t:"Books & Publications",s:"Research in progress — verified titles are being collected",href:"books.html"}];
 mount.innerHTML=[
  railSection("history","History","history.html",histItems),
  railSection("script","Script & Writing","script.html",RAIL_STATIC.script),
  railSection("dictionary","Dictionary","dictionary.html",dictCards),
  railSection("language","Language","language.html",RAIL_STATIC.language),
  railSection("people","People & Leaders","people.html",(groups.people||[]).map(x=>toCard(x,"article.html?id="+x.id))),
  railSection("movement","The Movement","movement.html",RAIL_STATIC.movement),
  railSection("culture","Culture & Traditions","culture.html",RAIL_STATIC.culture),
  railSection("articles","Articles","articles.html",(groups.articles||[]).map(x=>toCard(x,"article.html?id="+x.id))),
  railSection("news","News & Updates","news.html",(groups.news||[]).map(x=>toCard(x,"news.html?id="+x.id))),
  railSection("stories","Community Stories","stories.html",(groups.stories||[]).map(x=>toCard(x,"stories.html?id="+x.id))),
  railSection("videos","Music & Videos","videos.html",(groups.videos||[]).map(x=>({t:x.title,s:x.channel||x.category||"",img:"https://i.ytimg.com/vi/"+x.youtube+"/hqdefault.jpg",href:"videos.html"}))),
  railSection("gallery","Gallery","gallery.html",(groups.gallery||[]).map(x=>({t:x.title,s:x.caption||x.credit||"",img:x.image&&x.image.src?x.image.src:null,href:"gallery.html"}))),
  railSection("books","Books & Publications","books.html",bookCards)
 ].join("");
}
