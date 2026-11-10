/* Mundari Samaj v5 — feature loader (Articles / News / Stories / Gallery).
   Extends the v4 loader with the v5 media schema: optional featured image
   ("image"), ordered "media" items (image / youtube / instagram / x /
   facebook / link, official embed methods only, lazy, with fallback
   links), "related" records rendered as Related reading cards, and share
   buttons on detail views. Gallery tiles show real photos when a record
   has one and keep the tone-tile fallback otherwise. Only
   status==="published" records render; unverified articles keep the
   Editorial note. */
const paths={articles:"content/articles.json",news:"content/news.json",stories:"content/stories.json",gallery:"content/gallery.json",videos:"content/videos.json",books:"content/books.json",instagram:"content/instagram.json"};
const $=s=>document.querySelector(s);
const esc=s=>String(s||"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const apiType={articles:"article",news:"news",stories:"story",gallery:"gallery",videos:"video",books:"book",instagram:"instagram"};
async function load(k){if(apiType[k]){try{let r=await fetch("/api/content?type="+apiType[k]+"&per=200");if(r.ok){let j=await r.json();if(j&&j.ok&&Array.isArray(j.items))return j.items}}catch(e){}}try{let r=await fetch(paths[k]);return r.ok?await r.json():[]}catch(e){return[]}}
const published=x=>x.status==="published";
function art(t){return `<div class="fx-card-art" data-tone="${esc(t||"sage")}"></div>`}
function thumb(x){return x.image&&x.image.src?`<img class="fx-card-img" src="${esc(x.image.src)}" alt="${esc(x.image.caption||x.title)}" loading="lazy" decoding="async">`:art(x.tone)}
function card(x){return `<article class="fx-content-card">${thumb(x)}<div class="fx-card-body"><span class="fx-tag">${esc(x.category)} · ${esc(x.readTime)}</span><h3>${esc(x.title)}</h3><p>${esc(x.excerpt)}</p><div class="fx-card-foot"><span>${esc(x.date)}</span><a href="article/${encodeURIComponent(x.id)}">Read article ↗</a></div></div></article>`}
function photoSlug(x){return x._slug||x.id||String(x.title||"").toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-+|-+$/g,"");}
function photoFrame(x){
  const src=x.image&&x.image.src;if(!src)return "";
  return `<a class="fx-photo-frame" href="gallery/${encodeURIComponent(photoSlug(x))}"><span class="fx-photo-img"><img src="${esc(src)}" alt="${esc(x.image.caption||x.title)}" loading="lazy" decoding="async"></span><span class="fx-photo-title">${esc(x.title)}</span></a>`;
}
function galleryTile(x){
  if(x.type==="social"&&x.url){let emb="";
    if(x.platform==="instagram"){let g=igCode(x);if(g.code)emb=`<div class="fx-embed fx-embed-tall"><iframe src="https://www.instagram.com/${g.kind}/${g.code}/embed" title="${esc(x.title||"Instagram post")}" loading="lazy" allowfullscreen></iframe></div>`}
    else if(x.platform==="facebook"){emb=`<div class="fx-embed"><iframe src="https://www.facebook.com/plugins/post.php?href=${encodeURIComponent(x.url)}&show_text=true" title="${esc(x.title||"Facebook post")}" loading="lazy" allowfullscreen></iframe></div>`}
    if(emb)return `<figure class="fx-gallery-tile has-embed">${emb}<figcaption class="fx-gallery-cap"><b>${esc(x.title)}</b><span>${esc(x.caption||"")}</span><span class="fx-gallery-credit">${esc(x.credit||"")}</span><a href="${esc(x.url)}" target="_blank" rel="noopener">View on Instagram ↗</a></figcaption></figure>`}
  if(x.image&&x.image.src)return `<figure class="fx-gallery-tile has-img"><a href="gallery/${encodeURIComponent(photoSlug(x))}" aria-label="Open photo: ${esc(x.title)}"><img src="${esc(x.image.src)}" alt="${esc(x.image.caption||x.title)}" loading="lazy" decoding="async"></a><figcaption class="fx-gallery-cap"><b>${esc(x.title)}</b><span>${esc(x.caption)}</span><span class="fx-gallery-credit">${esc(x.credit||"")}</span> <a href="gallery/${encodeURIComponent(photoSlug(x))}">Open photo ↗</a></figcaption></figure>`;
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
  let seg=k==="articles"?"article":k==="stories"?"story":k;
  let url="https://mundarisamaj.pages.dev/"+seg+((k==="articles"||k==="stories"||k==="news")?"/":"?id=")+encodeURIComponent(x.id);
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
const LANGMETA=[
 {code:"en",name:"English",native:"English"},
 {code:"unr",name:"Mundari",native:"𞓧𞓟𞓨𞓡𞓕𞓣𞓚 · Bani script"},
 {code:"or",name:"Odia",native:"ଓଡ଼ିଆ"},
 {code:"hi",name:"Hindi",native:"हिन्दी"},
 {code:"bn",name:"Bengali",native:"বাংলা"}
];
function wireTheme(){
  const btn=document.getElementById("fx-theme"); if(!btn) return;
  const icon=document.getElementById("fx-theme-icon"), label=document.getElementById("fx-theme-label");
  const sync=()=>{ const d=document.documentElement.getAttribute("data-theme")==="dark"; if(icon)icon.textContent=d?"🌙":"☀️"; if(label)label.textContent=d?"Dark":"Light"; btn.setAttribute("aria-label", d?"Switch to light theme":"Switch to dark theme"); };
  sync();
  btn.addEventListener("click",()=>{ const next=document.documentElement.getAttribute("data-theme")==="dark"?"light":"dark"; document.documentElement.setAttribute("data-theme",next); try{localStorage.setItem("ms-theme",next);}catch(e){} sync(); });
}
function wireLang(x,el){
  const note=el.querySelector("#fx-lang-note"), cur=el.querySelector("#fx-lang-cur");
  const titleEl=document.querySelector(".page-hero h1.fx-title")||el.querySelector(".fx-title"),
        leadEl=document.querySelector(".page-hero p.fx-lead")||el.querySelector(".fx-lead"),
        bodyEl=el.querySelector(".fx-body-copy"), creditEl=el.querySelector("#fx-trans-credit");
  if(!titleEl||!leadEl||!bodyEl) return;
  const orig={t:titleEl.textContent, l:leadEl.textContent, b:bodyEl.innerHTML};
  let now="en";
  const avail=c=>c==="en"||(x.translations||[]).includes(c);
  const pills=[...el.querySelectorAll(".fx-pill")];
  const mark=()=>pills.forEach(pp=>pp.setAttribute("aria-pressed", pp.dataset.lang===now?"true":"false"));
  async function setLang(c){
    if(c===now){ mark(); return; }
    if(!avail(c)){
      note.textContent="This article is not yet available in "+LANGNAME[c]+". Translations are added only after they have been supplied and reviewed by a competent speaker.";
      note.hidden=false; mark(); return;
    }
    if(c==="en"){
      titleEl.textContent=orig.t; leadEl.textContent=orig.l; bodyEl.innerHTML=orig.b;
      if(creditEl) creditEl.textContent=""; note.hidden=true; now="en"; if(cur)cur.textContent="Currently: English"; mark(); return;
    }
    try{
      const r=await fetch("content/i18n/"+encodeURIComponent(x.id)+"."+c+".json");
      if(!r.ok) throw new Error("missing");
      const tr=await r.json();
      titleEl.textContent=tr.translatedTitle||orig.t;
      leadEl.textContent=tr.translatedSummary||orig.l;
      bodyEl.innerHTML=(Array.isArray(tr.content)?tr.content:[]).map(v=>v.type==="h2"?`<h2>${esc(v.text)}</h2>`:`<p>${esc(v.text)}</p>`).join("");
      if(creditEl) creditEl.textContent="Translation"+(tr.translationStatus?": "+tr.translationStatus:"")+(tr.reviewer?" · Reviewed by "+tr.reviewer:"")+(tr.reviewedAt?" · "+tr.reviewedAt:"")+(tr.region?" · Variety/region: "+tr.region:"");
      note.hidden=true; now=c; if(cur)cur.textContent="Currently: "+LANGNAME[c]; mark();
    }catch(e){
      note.textContent="This article is not yet available in "+LANGNAME[c]+".";
      note.hidden=false; mark();
    }
  }
  pills.forEach(pp=>pp.addEventListener("click",()=>setLang(pp.dataset.lang)));
  mark();
  const modal=el.querySelector("#fx-lang-modal"), list=el.querySelector("#fx-lang-list"), search=el.querySelector("#fx-lang-search");
  if(modal&&list){
    const close=()=>{ modal.removeAttribute("open"); document.body.style.overflow=""; };
    const render=(q="")=>{
      const qq=q.trim().toLowerCase();
      const items=LANGMETA.filter(l=>!qq||l.name.toLowerCase().includes(qq)||l.native.toLowerCase().includes(qq));
      list.innerHTML= items.length? items.map(l=>`<li><button type="button" data-lang="${l.code}" role="option"><span>${esc(l.name)} <small>${esc(l.native)}</small></span><span class="fx-lang-status">${avail(l.code)?"Available":"In preparation"}</span></button></li>`).join("") : `<li class="fx-lang-empty">No languages match your search.</li>`;
      list.querySelectorAll("button[data-lang]").forEach(b=>b.addEventListener("click",()=>{ close(); setLang(b.dataset.lang); }));
    };
    const open=()=>{ modal.setAttribute("open",""); document.body.style.overflow="hidden"; render(""); if(search){ search.value=""; setTimeout(()=>search.focus(),30); } };
    const more=el.querySelector("#fx-lang-more"); if(more) more.addEventListener("click",open);
    const cls=el.querySelector("#fx-lang-close"); if(cls) cls.addEventListener("click",close);
    modal.addEventListener("click",e=>{ if(e.target===modal) close(); });
    document.addEventListener("keydown",e=>{ if(e.key==="Escape"&&modal.hasAttribute("open")) close(); });
    if(search) search.addEventListener("input",()=>render(search.value));
  }
}
function bodyHtml(blocks, isArt){
  let out="", h2n=0, buf=[], lt=null;
  const flush=()=>{ if(buf.length){ out+= lt==="ol" ? `<ol class="fx-points">${buf.map(t=>`<li>${esc(t)}</li>`).join("")}</ol>` : `<ul class="fx-points">${buf.map(t=>`<li>${esc(t)}</li>`).join("")}</ul>`; buf=[]; lt=null; } };
  for(const v of (blocks||[])){
    if(v.type==="h2"){ flush(); h2n++; out+= isArt?`<h2 id="sec-${h2n}">${esc(v.text)}</h2>`:`<h2>${esc(v.text)}</h2>`; continue; }
    const t=String(v.text||"");
    if(/^•\s/.test(t)){ if(lt!=="ul"){flush(); lt="ul";} buf.push(t.replace(/^•\s*/,"")); continue; }
    const m=t.match(/^\d+[.)]\s+(.*)$/);
    if(m){ if(lt!=="ol"){flush(); lt="ol";} buf.push(m[1]); continue; }
    flush(); out+=`<p>${esc(t)}</p>`;
  }
  flush();
  return {html:out, h2n};
}
function fillHero(x){
  const hero=document.querySelector(".page-hero"); if(!hero) return;
  hero.classList.add("fx-hero-detail");
  const hh=hero.querySelector("h1"); if(hh){ hh.textContent=x.title; hh.classList.add("fx-title"); }
  const hp=hero.querySelector("p:not(.section-kicker)"); if(hp){ hp.textContent=x.excerpt||""; hp.classList.add("fx-lead"); }
  const hk=hero.querySelector(".section-kicker"); if(hk) hk.textContent="MUNDARI SAMAJ · "+String(x.category||"").toUpperCase()+(x.date?" · "+x.date:"");
  document.title=x.title+" — Mundari Samaj";
  const cr=document.querySelector('nav[aria-label="Breadcrumb"] span[aria-current="page"]'); if(cr) cr.textContent=x.title;
  if(!document.getElementById("fx-progress")){ const pb=document.createElement("div"); pb.id="fx-progress"; document.body.appendChild(pb); }
  const pb=document.getElementById("fx-progress");
  const onScroll=()=>{ const h=document.documentElement, mx=h.scrollHeight-h.clientHeight; pb.style.width=(mx>0?(h.scrollTop/mx)*100:0)+"%"; };
  if(window.__fxScroll) removeEventListener("scroll", window.__fxScroll);
  window.__fxScroll=onScroll; addEventListener("scroll", onScroll, {passive:true}); onScroll();
}
function detail(x,k,el,all){
  const isArt = k==="articles";
  const bd = Array.isArray(x.body) ? bodyHtml(x.body, isArt) : {html:`<p>${esc(x.body)}</p>`, h2n:0};
  let b = bd.html;
  let tocItems = (isArt && bd.h2n>=3 && Array.isArray(x.body)) ? x.body.filter(v=>v.type==="h2") : [];
  let tocCard="", tocSide="";
  if(tocItems.length){
    let i=0;
    tocCard=`<nav class="fx-toc" aria-label="Table of contents"><h2>Contents</h2><ol>${tocItems.map(v=>`<li><a href="#sec-${++i}">${esc(v.text)}</a></li>`).join("")}</ol></nav>`;
    tocSide=`<aside class="fx-side"><nav class="fx-tocside" aria-label="Table of contents"><h2>In this article</h2><ol>${tocItems.map((v,j)=>`<li><a href="#sec-${j+1}">${esc(v.text)}</a></li>`).join("")}</ol></nav></aside>`;
  }
  let feat=x.image&&x.image.src?`<figure class="fx-figure fx-featured"><img src="${esc(x.image.src)}" alt="${esc(x.image.caption||x.title)}" loading="lazy" decoding="async"><figcaption>${esc(x.image.caption||"")}${x.image.credit?` <span class="fx-credit">${esc(x.image.credit)}</span>`:""}</figcaption></figure>`:"";
  let media=Array.isArray(x.media)?x.media.map(mediaItem).join(""):"";
  let rel="";
  if(Array.isArray(x.related)&&all){let cards=x.related.map(id=>(all||[]).find(y=>y.id===id)).filter(y=>y&&published(y)).map(y=>{
     if(k==="articles")return card(y);
     if(k==="stories")return `<article class="fx-content-card"><div class="fx-card-body"><span class="fx-tag">${esc(y.place)}</span><h3>${esc(y.title)}</h3><p>${esc(y.excerpt)}</p><a href="story/${encodeURIComponent(y.id)}">Read story →</a></div></article>`;
     return `<article class="fx-content-card"><div class="fx-card-body"><span class="fx-tag">${esc(y.category)} · ${esc(y.date)}</span><h3>${esc(y.title)}</h3><p>${esc(y.excerpt)}</p><a href="news/${encodeURIComponent(y.id)}">Read update →</a></div></article>`}).join("");
   if(cards)rel=`<h2 class="fx-related-h">Related reading</h2><div class="fx-card-grid">${cards}</div>`}
  let srcs=Array.isArray(x.sources)&&x.sources.length?`<div class="fx-sources"><h2>Data sources &amp; further reading</h2><ul>${x.sources.map(s=>`<li>${s.type?`<span class="fx-src-type">${esc(s.type)}</span> `:""}${s.url?`<a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(srcLabel(s))}</a>`:esc(srcLabel(s))}</li>`).join("")}</ul><p class="fx-sources-note">Facts in this profile were compiled from the sources above. Corrections from the community are welcome — see the Contribute page.</p></div>`:"";
  let chips=[`<span class="fx-chip">${esc(x.author||x.contributor||"Mundari Samaj")}</span>`];
  if(x.readTime)chips.push(`<span class="fx-chip">${esc(x.readTime)}</span>`);
  if(isArt&&x.region)chips.push(`<span class="fx-chip">Region: ${esc(x.region)}</span>`);
  if(isArt&&x.updatedAt)chips.push(`<span class="fx-chip">Updated ${esc(x.updatedAt)}</span>`);
  if(isArt&&x.reviewStatus)chips.push(`<span class="fx-chip fx-chip-status">${esc(x.reviewStatus)}</span>`);
  const themeBtn=`<button class="fx-theme" id="fx-theme" type="button" aria-label="Switch to dark theme"><span id="fx-theme-icon">☀️</span> <span id="fx-theme-label">Light</span></button>`;
  let toolbar, noteCredit="", modalHtml="";
  if(isArt){
    toolbar=`<div class="fx-toolbar" role="region" aria-label="Reading tools"><div class="fx-lang" role="group" aria-label="Language"><button class="fx-pill" data-lang="en" type="button" aria-pressed="true">English</button><button class="fx-pill fx-pill-bani" data-lang="unr" type="button" aria-pressed="false" title="Mundari — Bani script">𞓧𞓟𞓨𞓡𞓕𞓣𞓚 <span>Mundari · Bani</span></button><button class="fx-more" id="fx-lang-more" type="button" aria-haspopup="dialog">🌐 More languages</button><span class="fx-lang-cur" id="fx-lang-cur">Currently: English</span></div>${themeBtn}</div>`;
    noteCredit=`<div class="fx-lang-note" id="fx-lang-note" hidden></div><p class="fx-meta" id="fx-trans-credit"></p>`;
    modalHtml=`<div class="fx-lang-modal" id="fx-lang-modal" role="dialog" aria-modal="true" aria-labelledby="fx-lang-title"><div class="fx-lang-panel"><div class="fx-lang-head"><h2 id="fx-lang-title">Choose a language</h2><button class="fx-lang-close" id="fx-lang-close" type="button" aria-label="Close language picker">✕</button></div><input type="search" class="fx-lang-search" id="fx-lang-search" placeholder="Search languages — English, Mundari, Odia, Hindi, Bengali…" aria-label="Search languages" autocomplete="off"><ul class="fx-lang-list" id="fx-lang-list" role="listbox" aria-label="Available languages"></ul><p class="fx-lang-foot">Translations are published only after review by a competent speaker. Languages marked “In preparation” are being worked on.</p></div></div>`;
  } else {
    toolbar=`<div class="fx-toolbar fx-toolbar-solo">${themeBtn}</div>`;
  }
  let cta=`<div class="fx-cta"><p>Have something to add or correct? Help us keep this record accurate and complete.</p><a class="fx-cta-btn" href="contribute">Contribute →</a></div>`;
  el.innerHTML=`<div class="fx-readwrap">${toolbar}<div class="fx-layout${tocSide?" has-side":""}">${tocSide}<article class="fx-article-layout"><a href="${k}">← Back</a>${noteCredit}<div class="fx-chips">${chips.join("")}</div>${x.verified===false?'<div class="fx-notice"><b>Editorial note:</b> Introductory material. Check community-specific claims with reliable sources and relevant knowledge holders.</div>':""}${feat}${tocCard}<div class="fx-body-copy">${b}</div>${media}${srcs}${cta}${shareBlock(x,k)}${rel}</article></div></div>${modalHtml}`;
  fillHero(x);
  wireTheme();
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
  if(nl)nl.innerHTML=n.filter(published).map(x=>`<article class="fx-news-item"><div class="fx-news-date">${esc(x.date)}<br>${esc(x.category)}</div><div><h3>${esc(x.title)}</h3><p>${esc(x.excerpt)}</p></div><a href="news/${x.id}">↗</a></article>`).join("");
  const sg=$("#story-grid");
  if(sg)sg.innerHTML=s.filter(published).slice(0,2).map(x=>`<article class="fx-story-card">${x.image&&x.image.src?`<img class="fx-card-img" src="${esc(x.image.src)}" alt="${esc(x.image.caption||x.title)}" loading="lazy" decoding="async">`:""}<span class="fx-tag">${esc(x.place)}</span><h3>${esc(x.title)}</h3><p>${esc(x.excerpt)}</p></article>`).join("");
  const gg=$("#gallery-grid");
  if(gg)gg.innerHTML=g.filter(x=>published(x)&&x.image&&x.image.src).slice(0,8).map(photoFrame).join("");
  const gs=$("#global-search"),sb=$("#search-button"),sr=$("#search-results");
  if(gs&&sb&&sr){
    let run=()=>{let q=gs.value.toLowerCase().trim();let all=[...a.map(x=>({...x,t:"Article",u:"article"})),...n.map(x=>({...x,t:"News",u:"news"})),...s.map(x=>({...x,t:"Story",u:"stories"}))].filter(x=>published(x)&&q&&(x.title+" "+x.excerpt+" "+x.category).toLowerCase().includes(q));sr.innerHTML=all.map(x=>`<a href="${x.u}?id=${x.id}"><b>${esc(x.title)}</b> — ${x.t}</a>`).join("")||(q?"<p>No results found.</p>":"")};
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
    if(x.image&&x.image.src)return `<figure class="fx-feed-item"><a href="gallery/${encodeURIComponent(photoSlug(x))}" aria-label="Open photo: ${esc(x.title)}"><img src="${esc(x.image.src)}" alt="${esc(x.image.caption||x.title)}" loading="lazy" decoding="async"></a><figcaption><b>${esc(x.title)}</b><span>${esc(x.caption||"")}</span><span class="fx-gallery-credit">${esc(x.credit||"")}</span> <a href="gallery/${encodeURIComponent(photoSlug(x))}">Open photo ↗</a></figcaption></figure>`;
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

function instagramFeed(el,d){
  const accts=[["all","All posts"],["mundarisamaj","@mundarisamaj"],["mundariarchive","@mundariarchive"]];
  let f="all",pos=0;const BATCH=6;
  el.innerHTML=`<div class="fx-ig-head"><div class="fx-chips">${accts.map(a=>`<button class="fx-chip${a[0]==="all"?" active":""}" data-acc="${a[0]}" type="button">${a[1]}</button>`).join("")}</div><p class="fx-ig-note">Every post and reel from our two Instagram pages, shown through Instagram's official embed. This page updates automatically when we post.</p></div><div class="fx-gallery-feed" id="ig-feed"></div><div class="fx-feed-note"><button class="fx-chip fx-load-more" id="ig-more" type="button">Load more posts</button></div>`;
  const feed=el.querySelector("#ig-feed"),more=el.querySelector("#ig-more");
  const list=()=>f==="all"?d:d.filter(x=>x.account===f);
  function batch(){const L=list();let html="";for(let i=0;i<BATCH&&pos<L.length;i++,pos++)html+=galleryTile(L[pos]);let w=document.createElement("div");w.innerHTML=html;while(w.firstChild)feed.appendChild(w.firstChild);more.style.display=pos>=L.length?"none":""}
  el.querySelectorAll("[data-acc]").forEach(b=>b.addEventListener("click",()=>{f=b.dataset.acc;pos=0;feed.innerHTML="";el.querySelectorAll("[data-acc]").forEach(x=>x.classList.toggle("active",x===b));batch()}));
  more.addEventListener("click",batch);
  batch();
}

function feedCard(x,href,tag){
 const img=(x.image&&x.image.src)||x.featured_image||null;
 const media=img?`<a class="fx-feed-media" href="${esc(href)}"><img src="${esc(img)}" alt="${esc(x.title||"")}" loading="lazy" decoding="async"></a>`:"";
 return `<article class="fx-feed-card">${media}<div class="fx-feed-body"><span class="fx-tag">${esc(tag||x.category||"")}${x.date?" · "+esc(x.date):""}</span><h3><a href="${esc(href)}">${esc(x.title)}</a></h3><p>${esc(x.excerpt||x.summary||"")}</p><a class="fx-feed-more" href="${esc(href)}">Read in full →</a></div></article>`;
}
async function listing(k){
  const el=$("#page-list");if(!el)return;
  let d=await load(k),id=new URLSearchParams(location.search).get("id");if(!id){let pm=location.pathname.match(/^\/(story|news)\/([^/]+)/);if(pm&&((k==="stories"&&pm[1]==="story")||(k==="news"&&pm[1]==="news")))id=decodeURIComponent(pm[2]);}
  if(id){let x=d.find(y=>y.id===id);if(x)detail(x,k,el,d);else el.innerHTML='<div class="fx-empty-state">Content not found.</div>';return}
  d=d.filter(published);
  if(k==="news"){el.innerHTML='<div class="fx-feed-list">'+d.map(x=>feedCard(x,"news/"+x.id,x.category||"Update")).join("")+"</div>"}
  else if(k==="gallery"){galleryFeed(el,d)}
  else if(k==="instagram"){instagramFeed(el,d)}
  else if(k==="stories"){el.innerHTML='<div class="fx-feed-list">'+d.map(x=>feedCard(x,"story/"+x.id,x.place)).join("")+"</div>"}
  else el.innerHTML='<div class="fx-feed-list">'+d.map(x=>feedCard(x,k+"?id="+x.id,x.category)).join("")+"</div>";
}
async function videosPage(){
  const el=$("#page-list");if(!el)return;const pageTitle=document.title;
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
    try{const root=location.pathname.replace(/\/videos(\.html)?(\/[^/]+)?\/?$/,"/videos");history.pushState(null,"",root+"/"+encodeURIComponent(v.id));document.title=v.title+" — Mundari Samaj";}catch(e){}
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
  $("#w-share").onclick=async()=>{const v=d.find(x=>x.id===current);if(!v)return;const url=location.href;try{await navigator.clipboard.writeText(url);const b=$("#w-share");b.textContent="\u{2713} Link copy";setTimeout(()=>{b.textContent="\u{2197} Share"},1800);}catch(e){window.open(url,"_blank","noopener");}};
  $("#watch-close").onclick=()=>{player.innerHTML="";box.hidden=true;current=null;try{const root=location.pathname.replace(/\/videos(\.html)?(\/[^/]+)?\/?$/,"/videos");history.pushState(null,"",root);document.title=pageTitle;}catch(e){}renderGrid()};
  renderGrid();
  let startId=new URLSearchParams(location.search).get("id");if(!startId){let pm=location.pathname.match(/\/videos\/([^/]+)\/?$/);if(pm)startId=decodeURIComponent(pm[1]);}if(startId){let sv=d.find(x=>x.id===startId);if(sv)play(sv,false);}
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
async function homeInstagram(){
  const mount=$("#ig-home-mount");if(!mount)return;
  let d=(await load("instagram")).filter(published);
  if(!d.length){mount.innerHTML='<p class="fx-muted">Posts will appear here soon.</p>';return}
  mount.innerHTML='<div class="fx-gallery-feed">'+d.slice(0,4).map(galleryTile).join("")+"</div>";
}

document.addEventListener("DOMContentLoaded",()=>{if($("#article-grid"))home();if($("#rails-mount"))homeRails();if($("#ig-home-mount"))homeInstagram();let p=document.body.dataset.page;if(p==="videos")videosPage();else if(p)listing(p)});

/* ---- Stage 2: homepage category rails (History first, then all categories).
   One single left-right scrollable row per category (owner's v21 correction:
   no double rows), View All card at the end of the row and at the top-right.
   Data comes from /api/home (database); if that is unavailable the rails are
   built from the same content/*.json files the site has always used. ---- */
const RAIL_STATIC={
 script:[{t:"Mundari Bani Script",s:"The 27-letter script created by Rohidas Singh Nag",img:"assets/img/mundari-bani-script-chart.jpg",href:"script"},{t:"Grammar & Structure",s:"How Mundari words and sentences are built",href:"grammar"},{t:"Learn Mundari",s:"Everyday words, phrases and practice",href:"learn"},{t:"The Alphabet",s:"Every Bani letter with its sound",img:"assets/img/mundari-bani-script-chart.jpg",href:"script"}],
 language:[{t:"The Mundari Language",s:"Horo jagar — history, speakers and status",href:"language"},{t:"Dictionary",s:"Mundari words in Bani and Roman script",href:"dictionary"},{t:"Grammar",s:"Verbs, cases and sentence patterns",href:"grammar"},{t:"Learn & Practise",s:"Start speaking with guided lessons",href:"learn"}],
 movement:[{t:"The Language Movement",s:"The living effort to keep Mundari strong",img:"assets/img/nag-birthday-celebration-01.jpg",href:"movement"},{t:"History",s:"From early times to the present day",img:"assets/img/sarhul-sarna-grove.jpg",href:"history"},{t:"People & Leaders",s:"Birsa Munda, Rohidas Singh Nag and more",img:"assets/img/rohidas-singh-nag.jpg",href:"people"}],
 culture:[{t:"Culture & Traditions",s:"Festivals, dance, music, food and craft",img:"assets/img/sarhul-dance-ranchi.jpg",href:"culture"},{t:"Sarhul",s:"The festival of flowers at the Sarna grove",img:"assets/img/sarhul-sarna-grove.jpg",href:"sarhul"},{t:"Karam",s:"The Karam branch, song and all-night dance",img:"assets/img/karam-festival.jpg",href:"karam"},{t:"Sohrai",s:"Harvest lamps and wall painting",img:"assets/img/sohrai-wall-art-isko.jpg",href:"sohrai"}]
};
function railCard(o){
 if(o.viewall)return `<a class="fx-rail-card fx-rail-viewall" href="${esc(o.href||"#")}"><span class="fx-rail-media"><span class="fx-rail-art"><span class="fx-rail-arrow">→</span></span></span><span class="fx-rail-body"><b>View All</b></span></a>`;
 const media=o.img?`<img src="${esc(o.img)}" alt="" loading="lazy" width="480" height="360" onerror="this.style.display='none'">`:"";
 const art=`<span class="fx-rail-art">${o.bani?`<span class="fx-rail-bani">${esc(o.bani)}</span>`:"✳"}</span>`;
 return `<a class="fx-rail-card" href="${esc(o.href||"#")}"><span class="fx-rail-media">${art}${media}</span><span class="fx-rail-body"><b>${esc(o.t)}</b>${o.bani&&o.s?`<small class="fx-rail-sub">${esc(o.s)}</small>`:""}</span></a>`;
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
 const histPinned=[{t:"Mundari History",s:"The story of the Mundari people and their land",img:"assets/img/sarhul-sarna-grove.jpg",href:"history"},{t:"Birsa Munda",s:"Dharti Aaba — the hero of the Ulgulan",img:"assets/img/birsa-munda-portrait.jpg",href:"article/birsa-munda"},{t:"Rohidas Singh Nag",s:"Ol Guru — creator of the Mundari Bani script",img:"assets/img/rohidas-singh-nag.jpg",href:"article/rohidas-singh-nag"}];
 const histItems=[...histPinned,...(groups.history||[]).map(x=>toCard(x,"article/"+x.id))].filter((v,i,a)=>a.findIndex(y=>y.href===v.href)===i);
 const dictCards=dict.length?dict.map(w=>({t:w.word,s:w.meaning_en||"",bani:w.bani||"",href:"dictionary"})):[{t:"Open the Dictionary",s:"Mundari words in Bani and Roman script",href:"dictionary"}];
 const bookCards=(groups.books&&groups.books.length)?groups.books.map(x=>toCard(x,"books")):[{t:"Books & Publications",s:"Research in progress — verified titles are being collected",href:"books"}];
 mount.innerHTML=[
  railSection("videos","Music & Videos","videos",(groups.videos||[]).map(x=>({t:x.title,s:x.channel||x.category||"",img:"https://i.ytimg.com/vi/"+x.youtube+"/hqdefault.jpg",href:"videos"}))),,
  railSection("dictionary","Dictionary","dictionary",dictCards),,
  railSection("news","News & Updates","news",(groups.news||[]).map(x=>toCard(x,"news/"+x.id))),,
  railSection("gallery","Gallery","gallery",(groups.gallery||[]).map(x=>({t:x.title,s:x.caption||x.credit||"",img:x.image&&x.image.src?x.image.src:null,href:"gallery"}))),,
  railSection("language","Language","language",RAIL_STATIC.language),,
  railSection("script","Script & Writing","script",RAIL_STATIC.script),,
  railSection("culture","Culture & Traditions","culture",RAIL_STATIC.culture),,
  railSection("stories","Community Stories","stories",(groups.stories||[]).map(x=>toCard(x,"story/"+x.id))),,
  railSection("history","History","history",histItems),,
  railSection("people","People & Leaders","people",(groups.people||[]).map(x=>toCard(x,"article/"+x.id))),,
  railSection("movement","The Movement","movement",RAIL_STATIC.movement),,
  railSection("articles","Articles","articles",(groups.articles||[]).map(x=>toCard(x,"article/"+x.id))),,
  railSection("books","Books & Publications","books",bookCards)
 ].join("");
}

document.addEventListener("click",function(e){if(!document.querySelector("base"))return;var a=e.target&&e.target.closest?e.target.closest('a[href^="#"]'):null;if(!a)return;var tid=a.getAttribute("href").slice(1);if(!tid)return;var t=document.getElementById(tid);if(t){e.preventDefault();t.scrollIntoView({behavior:"smooth"});}});
