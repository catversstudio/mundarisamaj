const menuButton=document.querySelector('.menu-toggle');const nav=document.querySelector('.main-nav');menuButton?.addEventListener('click',()=>{const open=nav.classList.toggle('open');menuButton.setAttribute('aria-expanded',String(open));menuButton.setAttribute('aria-label',open?'Close navigation':'Open navigation')});nav?.querySelectorAll('a').forEach(a=>a.addEventListener('click',()=>{nav.classList.remove('open');menuButton?.setAttribute('aria-expanded','false')}));
const yearEl=document.getElementById('year');if(yearEl){yearEl.textContent=new Date().getFullYear();}

const searchItems=[
['Introduction to the Munda Community','Discover','discover'],['Where Mundari is spoken — identity and dialects','Discover','identity'],['Munda histories and historical sources','History','history'],['People and personalities — including Birsa Munda','History','people'],['The Mundari language movement','History','movement'],['Mundari language overview','Language','language'],['Mundari Bani script — the 27 letters','Language','script'],['Mundari grammar','Language','grammar'],['Mundari dictionary — 128 words','Language','dictionary'],['Learn Mundari — flashcards and sentences','Language','learn'],['Culture and traditions','Culture','culture'],['Festivals — Sarhul, Karam, Sohrai','Culture','festivals'],
['Sarhul — the festival of flowers','Culture','sarhul'],['Karam festival','Culture','karam'],['Mage Parab — honouring the ancestors','Culture','mage-parab'],['Phagu — hunting and colours','Culture','phagu'],['Sohrai — harvest and wall art','Culture','sohrai'],['Music, dance and oral traditions','Culture','culture'],['Community stories and regions','Community','community'],['Digital library and archive','Library','library'],['Books and learning resources','Library','resources'],['About Mundari Samaj','About','about'],['How to contribute','Community','contribute'],
['Books & publications','Library','books'],['News & updates','News','news'],['Media gallery — photographs & videos','Media','gallery'],['Articles — read everything','Library','articles'],['Today\'s Mundari Bulletin','News','./']
];
const searchInput=document.getElementById('site-search');const results=document.getElementById('search-results');const clearBtn=document.getElementById('search-clear');
if(searchInput&&results){
const escS=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const markS=(t,q)=>{const i=String(t).toLowerCase().indexOf(q);if(i<0||!q)return escS(t);return escS(t.slice(0,i))+'<mark>'+escS(t.slice(i,i+q.length))+'</mark>'+escS(t.slice(i+q.length));};
let sTimer=null,sActive=-1,sLastQ='';
const QUICK=[['Mundari dictionary — 128 words','dictionary'],['Mundari Bani script — 27 letters','script'],['People and personalities — Birsa Munda','people'],['Sarhul — the festival of flowers','sarhul'],['Articles — read everything','articles'],['Learn Mundari — flashcards and sentences','learn']];
function closeResults(){results.hidden=true;results.innerHTML='';sActive=-1;}
function mkLink(href,title,sub,q){const a=document.createElement('a');a.className='search-result';a.href=href;a.innerHTML='<b></b><small></small>';a.querySelector('b').innerHTML=markS(title,q);a.querySelector('small').textContent=sub;return a;}
function mkGroup(t){const d=document.createElement('div');d.className='search-group';d.textContent=t;return d;}
function showQuick(){results.innerHTML='';sActive=-1;results.appendChild(mkGroup('Popular on Mundari Samaj'));QUICK.forEach(x=>results.appendChild(mkLink(x[1],x[0],'Open page','')));results.hidden=false;}
function typeLink(t,id){return ({article:'article/'+encodeURIComponent(id),news:'news/'+encodeURIComponent(id),story:'story/'+encodeURIComponent(id),video:'videos/'+encodeURIComponent(id),gallery:'gallery/'+encodeURIComponent(id),book:'books/'+encodeURIComponent(id)})[t]||'articles';}
function typeName(t){return ({article:'Article',news:'News',story:'Story',video:'Video',gallery:'Gallery',book:'Book'})[t]||'Page';}
async function runSearch(q){
  results.innerHTML='<p class="search-note">Searching…</p>';results.hidden=false;sActive=-1;
  const local=searchItems.filter(x=>(x[0]+' '+x[1]).toLowerCase().includes(q)).slice(0,6);
  let apiContent=[],apiDict=[];
  try{const r=await fetch('/api/search?q='+encodeURIComponent(q));if(r.ok){const d=await r.json();apiContent=d.content||[];apiDict=d.dictionary||[];}}catch(e){}
  if(sLastQ!==q)return;
  results.innerHTML='';
  const seen=new Set(local.map(x=>x[2]));
  if(local.length){results.appendChild(mkGroup('Pages & topics'));local.forEach(x=>results.appendChild(mkLink(x[2],x[0],x[1]+' · Open page',q)));}
  const extra=apiContent.filter(it=>!seen.has(typeLink(it._type,it.id))).slice(0,5);
  if(extra.length){results.appendChild(mkGroup('Articles, news & more'));extra.forEach(it=>results.appendChild(mkLink(typeLink(it._type,it.id),it.title,typeName(it._type)+(it._published?' · '+String(it._published).slice(0,10):''),q)));}
  if(apiDict.length){results.appendChild(mkGroup('Dictionary words'));apiDict.slice(0,4).forEach(w=>results.appendChild(mkLink('dictionary?q='+encodeURIComponent(w.word),w.word+(w.bani?' · '+w.bani:''),(w.meaning_en||'Mundari word')+' · Dictionary',q)));}
  if(!local.length&&!extra.length&&!apiDict.length){const p=document.createElement('p');p.className='search-note';p.innerHTML='No match found. Try another word — or open the <a href="dictionary?q='+encodeURIComponent(q)+'">Dictionary</a>.';results.appendChild(p);}
  const foot=document.createElement('a');foot.className='search-foot';foot.href='search?q='+encodeURIComponent(q);foot.textContent='See all results →';results.appendChild(foot);
  results.hidden=false;
}
searchInput.addEventListener('input',()=>{const q=searchInput.value.trim().toLowerCase();sLastQ=q;if(clearBtn)clearBtn.hidden=!q;clearTimeout(sTimer);if(!q){showQuick();return;}sTimer=setTimeout(()=>runSearch(q),180);});
searchInput.addEventListener('focus',()=>{if(!searchInput.value.trim())showQuick();});
if(clearBtn)clearBtn.addEventListener('click',()=>{searchInput.value='';clearBtn.hidden=true;searchInput.focus();showQuick();});
searchInput.addEventListener('keydown',e=>{
  const items=[...results.querySelectorAll('a.search-result')];
  if(e.key==='Escape'){closeResults();return;}
  if(!items.length)return;
  if(e.key==='ArrowDown'||e.key==='ArrowUp'){e.preventDefault();sActive=e.key==='ArrowDown'?Math.min(sActive+1,items.length-1):Math.max(sActive-1,0);items.forEach((el,i)=>el.classList.toggle('active',i===sActive));if(items[sActive])items[sActive].scrollIntoView({block:'nearest'});}
  else if(e.key==='Enter'&&sActive>=0){e.preventDefault();items[sActive].click();}
});
document.addEventListener('click',e=>{if(!results.hidden&&!e.target.closest('.header-search'))closeResults();});
results.hidden=true;
}

document.getElementById('contribution-form').addEventListener('submit',e=>{e.preventDefault();const f=e.currentTarget;const data=new FormData(f);const subject=encodeURIComponent('Mundari Samaj contribution: '+data.get('type'));const body=encodeURIComponent('Name: '+data.get('name')+'\nEmail: '+(data.get('email')||'Not provided')+'\nType: '+data.get('type')+'\n\nContribution:\n'+data.get('message')+'\n\nI confirm I have permission to share this material and understand it will be reviewed.');const status=document.getElementById('form-status');status.textContent='Your email app should open with a prepared draft. This site does not store submissions.';window.location.href='mailto:mundarisamaj@outlook.com?subject='+subject+'&body='+body;});
