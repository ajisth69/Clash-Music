/**
 * storage.js — Persistence & Advanced Taste Engine v2
 */

const KEYS = {
  VOLUME:'clash_volume', LAST:'clash_lastPlayed', HISTORY:'clash_history',
  PLAY_LOG:'clash_play_log', LIKED:'clash_liked', PLAYLISTS:'clash_playlists',
  QUEUE:'clash_queue', QUEUE_IDX:'clash_queue_idx',
  EQ_PRESET:'clash_eq_preset', EQ_CUSTOM:'clash_eq_custom',
  VIS_ENABLED:'clash_visualizer_enabled', VIS_MODE:'clash_visualizer_mode',
  CROSSFADE_ON:'clash_crossfade_enabled', CROSSFADE_DUR:'clash_crossfade_duration',
  GAPLESS:'clash_gapless', THEME:'clash_theme',
  RECENT_SEARCHES:'clash_recent_searches', SLEEP_TIMER:'clash_sleep_timer',
  SPATIAL_AUDIO:'clash_spatial_audio', SPATIAL_MODE:'clash_spatial_mode', HIFI_MODE:'clash_hifi_mode',
  WAVESHAPER_MODE:'clash_waveshaper_mode',
};

function readJSON(key,fb){try{const r=localStorage.getItem(key);return r?JSON.parse(r):fb;}catch{return fb;}}
function writeJSON(key,val){try{localStorage.setItem(key,JSON.stringify(val));}catch{}}

export function getVolume(){const v=parseFloat(localStorage.getItem(KEYS.VOLUME));return isNaN(v)?0.7:Math.min(1,Math.max(0,v));}
export function saveVolume(vol){localStorage.setItem(KEYS.VOLUME,String(vol));}
export function getLastPlayed(){return readJSON(KEYS.LAST,null);}
export function saveLastPlayed(song){if(song)writeJSON(KEYS.LAST,song);}
export function getQueue(){return readJSON(KEYS.QUEUE,[]);}
export function getQueueIdx(){return parseInt(localStorage.getItem(KEYS.QUEUE_IDX))||0;}
export function saveQueue(q,idx){writeJSON(KEYS.QUEUE,q);localStorage.setItem(KEYS.QUEUE_IDX,String(idx));}

/* History — extended to 50 */
export function getHistory(){return readJSON(KEYS.HISTORY,[]);}
export function addToHistory(song){
  if(!song?.id)return;
  let h=getHistory().filter(s=>s.id!==song.id);
  h.unshift(song);
  if(h.length>50)h=h.slice(0,50);
  writeJSON(KEYS.HISTORY,h);
}

/* Play Log — 500 events with completion % */
export function getPlayLog(){return readJSON(KEYS.PLAY_LOG,[]);}

export function logPlay(song,completionPct=0){
  if(!song?.id)return;
  let log=getPlayLog();
  const now=Date.now();
  const recent=log.find(e=>e.id===song.id&&now-e.ts<10000);
  if(recent){recent.completion=Math.max(recent.completion,Math.round(completionPct));writeJSON(KEYS.PLAY_LOG,log);return;}
  log.unshift({
    id:song.id,title:song.title,artist:song.artist,artists:song.artists||[],
    album:song.album||'',language:song.language||'',image:song.image||'',
    streamUrl:song.streamUrl||'',duration:song.duration||0,
    ts:now,completion:Math.round(completionPct),
  });
  if(log.length>500)log=log.slice(0,500);
  writeJSON(KEYS.PLAY_LOG,log);
}

export function getHeardSongIds(minCompletion=70){
  const log=getPlayLog();const byId={};
  log.forEach(e=>{if(!byId[e.id]||byId[e.id]<e.completion)byId[e.id]=e.completion;});
  const heard=new Set();
  Object.entries(byId).forEach(([id,c])=>{if(c>=minCompletion)heard.add(id);});
  return heard;
}

/* Liked */
export function getLiked(){return readJSON(KEYS.LIKED,[]);}
export function isLiked(id){return getLiked().some(s=>s.id===id);}
export function toggleLike(song){
  if(!song?.id)return false;
  let liked=getLiked();
  const idx=liked.findIndex(s=>s.id===song.id);
  if(idx>-1){liked.splice(idx,1);writeJSON(KEYS.LIKED,liked);return false;}
  liked.unshift(song);writeJSON(KEYS.LIKED,liked);return true;
}

/* ══ Advanced Taste Engine v2 ══ */
const MOOD_KEYWORDS={
  romantic:['love','pyar','ishq','dil','heart','romance','baby','darling','mohabbat','tumse'],
  sad:['sad','dard','broken','cry','miss','alone','judai','bewafa','tanha','pain'],
  party:['party','dance','dj','beat','club','bass','vibe','fire','lit','bhangra'],
  chill:['chill','lofi','relax','peace','calm','sleep','rain','drive','night'],
  hype:['rap','hip hop','hustle','king','boss','squad','gang','flex','trap'],
};

function detectMoods(songs){
  const sc={};
  songs.forEach(s=>{
    const t=`${s.title||''} ${s.album||''}`.toLowerCase();
    for(const[m,words]of Object.entries(MOOD_KEYWORDS))if(words.some(w=>t.includes(w)))sc[m]=(sc[m]||0)+1;
  });
  return Object.entries(sc).sort((a,b)=>b[1]-a[1]).map(([m])=>m);
}

export function getTopArtistsAdvanced(n=10){
  const log=getPlayLog(),liked=getLiked(),now=Date.now();
  const scores={},meta={};
  log.forEach(entry=>{
    const dayAgo=(now-entry.ts)/86400000;
    const recency=Math.exp(-0.07*dayAgo);
    const comp=(entry.completion||0)/100;
    const w=recency*(0.3+0.7*comp);
    (entry.artist||'').split(/,\s*/).forEach(raw=>{
      const name=raw.trim();
      if(!name||name.length<=1||name==='Unknown Artist')return;
      scores[name]=(scores[name]||0)+w;
      if(!meta[name])meta[name]={id:'',count:0,total:0};
      meta[name].count++;meta[name].total+=entry.completion||0;
    });
    (entry.artists||[]).forEach(a=>{if(a.id&&meta[a.name])meta[a.name].id=a.id;});
  });
  liked.forEach(song=>{
    (song.artist||'').split(/,\s*/).forEach(raw=>{
      const name=raw.trim();
      if(!name||name.length<=1||name==='Unknown Artist')return;
      scores[name]=(scores[name]||0)+3.0;
      if(!meta[name])meta[name]={id:'',count:0,total:0};
    });
    (song.artists||[]).forEach(a=>{if(a.id&&meta[a.name])meta[a.name].id=a.id;});
  });
  return Object.entries(scores).sort((a,b)=>b[1]-a[1]).slice(0,n)
    .map(([name,score])=>({name,score,id:meta[name]?.id||'',count:meta[name]?.count||0}));
}

export function getTasteQueries(){
  const log=getPlayLog(),liked=getLiked(),history=getHistory();
  const all=[...liked,...liked,...log.slice(0,50),...history];
  if(all.length<2)return[];
  const top=getTopArtistsAdvanced(8);
  if(!top.length)return[];
  const moods=detectMoods(all);
  const langCount={};
  all.forEach(s=>{if(s.language)langCount[s.language]=(langCount[s.language]||0)+1;});
  const topLang=Object.entries(langCount).sort((a,b)=>b[1]-a[1])[0]?.[0]||'';
  const q=[];
  if(top[0])q.push(top[0].name);
  if(top[1])q.push(`${top[1].name} songs`);
  if(top[2])q.push(`${top[2].name} latest`);
  if(top[0]&&top[1])q.push(`${top[0].name} ${top[1].name}`);
  if(moods[0]){const lang=topLang&&topLang!=='english'?` ${topLang}`:'';q.push(`${moods[0]}${lang} songs`);}
  if(liked.length){
    const pick=liked[Math.floor(Math.random()*Math.min(liked.length,5))];
    const clean=(pick.title||'').replace(/[^a-zA-Z\u0900-\u097F\s]/g,'').trim();
    if(clean.length>2)q.push(clean);
  }
  if(top[3])q.push(`${top[3].name} best songs`);
  if(moods[1])q.push(`${moods[1]} ${topLang||'hindi'} songs`);
  return[...new Set(q)].slice(0,7);
}

export function getTasteSummary(){
  const log=getPlayLog(),liked=getLiked(),history=getHistory();
  if(!log.length&&!liked.length&&!history.length)return null;
  const top=getTopArtistsAdvanced(3).map(a=>a.name);
  const all=[...liked,...liked,...log.slice(0,30),...history];
  const moods=detectMoods(all);
  return{totalListened:log.length,totalLiked:liked.length,topArtists:top,topMood:moods[0]||null};
}

/* Custom Playlists */
export function getPlaylists(){return readJSON(KEYS.PLAYLISTS,[]);}
export function createPlaylist(name){
  if(!name?.trim())return null;
  const p={id:`pl_${Date.now()}_${Math.floor(Math.random()*1000)}`,name:name.trim(),songs:[]};
  const list=getPlaylists();list.push(p);writeJSON(KEYS.PLAYLISTS,list);return p;
}
export function addToPlaylist(pid,song){
  if(!pid||!song?.id)return false;
  const list=getPlaylists();const pl=list.find(p=>p.id===pid);if(!pl)return false;
  if(pl.songs.length>=50)return'full';
  if(pl.songs.some(s=>s.id===song.id))return'duplicate';
  pl.songs.push(song);writeJSON(KEYS.PLAYLISTS,list);return'added';
}
export function removeFromPlaylist(pid,sid){
  if(!pid||!sid)return false;
  const list=getPlaylists();const pl=list.find(p=>p.id===pid);if(!pl)return false;
  const before=pl.songs.length;pl.songs=pl.songs.filter(s=>s.id!==sid);
  if(pl.songs.length!==before){writeJSON(KEYS.PLAYLISTS,list);return true;}return false;
}
export function importPlaylist(name,songs){
  if(!name||!songs?.length)return null;
  const p={id:`pl_${Date.now()}_${Math.floor(Math.random()*1000)}`,name:name.trim(),songs:songs.slice(0,50)};
  const list=getPlaylists();list.push(p);writeJSON(KEYS.PLAYLISTS,list);return p;
}
export function deletePlaylist(pid){
  if(!pid)return false;
  const list=getPlaylists(),f=list.filter(p=>p.id!==pid);
  if(f.length!==list.length){writeJSON(KEYS.PLAYLISTS,f);return true;}return false;
}

/* Settings */
export function getEQPreset(){return localStorage.getItem(KEYS.EQ_PRESET)||'Flat';}
export function saveEQPreset(n){localStorage.setItem(KEYS.EQ_PRESET,n);}
export function getEQCustom(){return readJSON(KEYS.EQ_CUSTOM,[0,0,0,0,0]);}
export function saveEQCustom(g){writeJSON(KEYS.EQ_CUSTOM,g);}
export function getVisualizerEnabled(){return readJSON(KEYS.VIS_ENABLED,true);}
export function saveVisualizerEnabled(b){writeJSON(KEYS.VIS_ENABLED,!!b);}
export function getVisualizerMode(){return localStorage.getItem(KEYS.VIS_MODE)||'bars';}
export function saveVisualizerMode(m){localStorage.setItem(KEYS.VIS_MODE,m);}
export function getCrossfadeEnabled(){return readJSON(KEYS.CROSSFADE_ON,false);}
export function saveCrossfadeEnabled(b){writeJSON(KEYS.CROSSFADE_ON,!!b);}
export function getCrossfadeDuration(){const v=parseFloat(localStorage.getItem(KEYS.CROSSFADE_DUR));return isNaN(v)?5:v;}
export function saveCrossfadeDuration(s){localStorage.setItem(KEYS.CROSSFADE_DUR,String(s));}
export function getGapless(){return readJSON(KEYS.GAPLESS,false);}
export function saveGapless(b){writeJSON(KEYS.GAPLESS,!!b);}
export function getTheme(){return localStorage.getItem(KEYS.THEME)||'dark';}
export function saveTheme(t){localStorage.setItem(KEYS.THEME,t);}
export function getRecentSearches(){return readJSON(KEYS.RECENT_SEARCHES,[]);}
export function addRecentSearch(q){
  if(!q?.trim())return;
  let list=getRecentSearches().filter(s=>s!==q.trim());
  list.unshift(q.trim());if(list.length>8)list=list.slice(0,8);
  writeJSON(KEYS.RECENT_SEARCHES,list);
}
export function clearRecentSearches(){writeJSON(KEYS.RECENT_SEARCHES,[]);}
export function getSleepTimer(){return readJSON(KEYS.SLEEP_TIMER,null);}
export function saveSleepTimer(ts){writeJSON(KEYS.SLEEP_TIMER,ts);}
export function clearSleepTimer(){localStorage.removeItem(KEYS.SLEEP_TIMER);}
export function getSpatialAudioEnabled(){return readJSON(KEYS.SPATIAL_AUDIO,false);}
export function saveSpatialAudioEnabled(b){writeJSON(KEYS.SPATIAL_AUDIO,!!b);}
export function getSpatialMode(){return localStorage.getItem(KEYS.SPATIAL_MODE)||'normal';}
export function saveSpatialMode(m){localStorage.setItem(KEYS.SPATIAL_MODE,m);}
export function getHiFiMode(){return readJSON(KEYS.HIFI_MODE,false);}
export function saveHiFiMode(b){writeJSON(KEYS.HIFI_MODE,!!b);}
export function getWaveshaperMode(){return readJSON(KEYS.WAVESHAPER_MODE,false);}
export function saveWaveshaperMode(b){writeJSON(KEYS.WAVESHAPER_MODE,!!b);}
