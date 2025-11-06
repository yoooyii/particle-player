// —— 粒子全局 —— 
let particles = [];
let showText = true;
// —— 播放器全局（外链模式）——
let currentIndex = -1;
let selectEl, titleEl, embedWrap, embedEl;
let playBtn, nextBtn, prevBtn;
let addLinkBtn, addUrlInput, addTitleInput;
// 运行时词库：默认取 words.js 的 WORD_BANK，但允许用户覆盖
let RUNTIME_WORDS = [];              // 实际使用的词列表
const WORDS_KEY = 'particle_words_v1'; // localStorage 键名

// 面板DOM
let wordInput, applyBtn, resetBtn, exportBtn, importInput;


const MAX_PARTICLES = 600;
const BG = [11,15,26];
const TAIL_ALPHA = 60, GRAVITY = 0.02, FRICTION = 0.995;

function setup() {
  createCanvas(windowWidth, windowHeight);
  background(...BG);

  // 绑定播放器 DOM
  volSlider = document.getElementById('vol');     // 本版不会用到音量（外链自己管音量）
  playBtn   = document.getElementById('play');
  nextBtn   = document.getElementById('next');
  prevBtn   = document.getElementById('prev');
  addBtn    = document.getElementById('add');     // 本版不再使用“本地添加”
  fileInput = document.getElementById('fileInput');
  selectEl  = document.getElementById('playlist');
  titleEl   = document.getElementById('title');
  embedWrap = document.getElementById('embedWrap');
  embedEl   = document.getElementById('embed');
  addLinkBtn   = document.getElementById('addLink');
  addUrlInput  = document.getElementById('addUrl');
  addTitleInput= document.getElementById('addTitle');
  // 词库面板绑定
  wordInput   = document.getElementById('wordInput');
  applyBtn    = document.getElementById('applyWords');
  resetBtn    = document.getElementById('resetWords');
  exportBtn   = document.getElementById('exportWords');
  importInput = document.getElementById('importWords');

  // 初始化词库：优先读 localStorage，其次用默认 WORD_BANK（来自 words.js）
  try {
    const saved = localStorage.getItem(WORDS_KEY);
    RUNTIME_WORDS = saved ? JSON.parse(saved) : (Array.isArray(WORD_BANK) ? WORD_BANK.slice() : []);
  } catch {
    RUNTIME_WORDS = Array.isArray(WORD_BANK) ? WORD_BANK.slice() : [];
  }
  // 同步到文本框
  if (wordInput) wordInput.value = RUNTIME_WORDS.join('\n');

  // 事件：应用并保存
  if (applyBtn) applyBtn.onclick = () => {
    const arr = parseWordsFromTextarea();
    if (arr.length) {
      RUNTIME_WORDS = arr;
      localStorage.setItem(WORDS_KEY, JSON.stringify(RUNTIME_WORDS));
    } else {
      alert('请输入至少一个词（每行一个）');
    }
  };

  // 事件：恢复默认
  if (resetBtn) resetBtn.onclick = () => {
    RUNTIME_WORDS = Array.isArray(WORD_BANK) ? WORD_BANK.slice() : [];
    localStorage.setItem(WORDS_KEY, JSON.stringify(RUNTIME_WORDS));
    if (wordInput) wordInput.value = RUNTIME_WORDS.join('\n');
  };

  // 导出 JSON
  if (exportBtn) exportBtn.onclick = () => {
    const blob = new Blob([JSON.stringify(RUNTIME_WORDS, null, 2)], {type:'application/json'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'words.json'; a.click();
    URL.revokeObjectURL(url);
  };

  // 导入 JSON
  if (importInput) importInput.onchange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const arr = JSON.parse(text);
      if (Array.isArray(arr) && arr.length) {
        RUNTIME_WORDS = arr.map(x => String(x)).filter(Boolean);
        localStorage.setItem(WORDS_KEY, JSON.stringify(RUNTIME_WORDS));
        if (wordInput) wordInput.value = RUNTIME_WORDS.join('\n');
      } else {
        alert('JSON 文件格式应为字符串数组，比如 ["A","B","C"]');
      }
    } catch {
      alert('读取/解析失败，请确认是有效的 JSON 文件');
    }
    e.target.value = ''; // 清空选择
  };

  // 回车也能提交
  if (wordInput) wordInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      applyBtn?.click();
    }
  });

  // 帮助函数：从文本框解析词
  function parseWordsFromTextarea() {
    const raw = (wordInput?.value || '');
    return raw
      .split(/\r?\n|,|;/)          // 支持换行/逗号/分号分隔
      .map(s => s.trim())
      .filter(Boolean);
  }


  if (addLinkBtn) {
    addLinkBtn.onclick = () => tryAddLink();
  }
  if (addUrlInput) {
    addUrlInput.addEventListener('keydown', e => {
      if (e.key === 'Enter') tryAddLink();
    });
  }

  // 外链模式：隐藏“本地添加/音量”
  if (addBtn) addBtn.style.display = 'none';
  if (volSlider) volSlider.disabled = true;

  refreshPlaylist();

  // 事件
  playBtn.onclick = () => { // 播放/暂停：外链没法直接控制，就当“播放当前”
    if (currentIndex === -1 && SONGS.length) playIndex(0);
    else playIndex(currentIndex); // 重新赋 src 实现“播放”
  };
  nextBtn.onclick = () => playIndex((currentIndex + 1) % SONGS.length);
  prevBtn.onclick = () => playIndex((currentIndex - 1 + SONGS.length) % SONGS.length);
  selectEl.onchange = () => playIndex(parseInt(selectEl.value, 10));
}

function windowResized() { resizeCanvas(windowWidth, windowHeight); }

function draw() {
  noStroke(); fill(BG[0], BG[1], BG[2], TAIL_ALPHA); rect(0,0,width,height);
  if (mouseIsPressed || (mouseX>=0 && mouseY>=0 && frameCount%2===0)) emit(mouseX, mouseY, mouseIsPressed ? 12 : 3);
  for (let i=particles.length-1;i>=0;i--){
    const p=particles[i]; p.vy+=GRAVITY; p.vx*=FRICTION; p.vy*=FRICTION; p.x+=p.vx; p.y+=p.vy; p.life--;
    const dx=mouseX-p.x, dy=mouseY-p.y, pull=60/(dx*dx+dy*dy+1); p.vx+=dx*pull*0.4; p.vy+=dy*pull*0.4;
    if (p.text && showText){ push(); translate(p.x,p.y); rotate(p.angle); fill(200,220,255,map(p.life,0,p.maxLife,0,255)); noStroke(); textAlign(CENTER,CENTER); textSize(p.size); text(p.text,0,0); pop(); }
    else { noStroke(); fill(160,200,255,map(p.life,0,p.maxLife,0,255)); circle(p.x,p.y,p.size); }
    if (p.life<=0||p.x<-50||p.x>width+50||p.y<-50||p.y>height+50) particles.splice(i,1);
  }
}

function mousePressed(){ emit(mouseX,mouseY,28,true); }
function emit(x,y,count=8,burst=false){
  for (let i=0;i<count;i++){
    if (particles.length>MAX_PARTICLES) particles.shift();
    const speed=burst?random(1.5,4.5):random(0.6,2.2), dir=random(TWO_PI), isText=showText&&random()<0.22;
    particles.push({x,y,vx:cos(dir)*speed,vy:sin(dir)*speed,size:isText?random(14,22):random(2,4.6),
      life:int(random(45,120)),maxLife:120,text: isText && RUNTIME_WORDS.length ? random(RUNTIME_WORDS) : null,angle:random(-0.4,0.4)});
  }
}
function keyPressed(){ if(key==='C'||key==='c'){background(...BG);particles.length=0;} if(key==='T'||key==='t'){showText=!showText;} }

function refreshPlaylist(){
  selectEl.innerHTML = "";
  SONGS.forEach((s,i)=>{
    const opt=document.createElement('option');
    opt.value=String(i); opt.textContent=s.title||`Track ${i+1}`;
    selectEl.appendChild(opt);
  });
  selectEl.disabled = SONGS.length===0;
  embedWrap.style.display = SONGS.length ? 'block' : 'none';
  titleEl.textContent = SONGS.length ? '未播放' : '（暂无外链）';
}

function playIndex(i){
  if(!SONGS.length) return;
  currentIndex = (i + SONGS.length) % SONGS.length;
  selectEl.value = String(currentIndex);
  const track = SONGS[currentIndex];
  titleEl.textContent = track.title || '正在播放';
  embedEl.src = track.url;       // 用 iframe 切歌
}

function tryAddLink(){
  const raw = (addUrlInput?.value || "").trim();
  const title = (addTitleInput?.value || "").trim();
  if (!raw) return;
  const norm = normalizeEmbed(raw);
  if (!norm) {
    alert("这个链接不能嵌入或暂不支持。\n支持: YouTube / Spotify / SoundCloud / 网易云 / Bilibili");
    return;
  }
  // 填标题（优先用户输入）
  norm.title = title || norm.title || "Custom Track";

  // 加入列表并播放
  SONGS.push(norm);
  refreshPlaylist();
  playIndex(SONGS.length - 1);

  // 清空输入
  addUrlInput.value = "";
  addTitleInput.value = "";
}

function normalizeEmbed(url){
  try {
    const u = new URL(url);

    // ===== YouTube =====
    if (u.hostname.includes("youtube.com") || u.hostname.includes("youtu.be")) {
      // 1) youtu.be/VIDEO_ID
      if (u.hostname === "youtu.be" && u.pathname.length > 1) {
        const id = u.pathname.slice(1);
        return { title: "YouTube", url: `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&mute=1` };
      }
      // 2) youtube.com/watch?v=VIDEO_ID
      const id = u.searchParams.get("v");
      if (id) {
        return { title: "YouTube", url: `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&mute=1` };
      }
      // 3) 已经是 /embed/VIDEO_ID
      if (u.pathname.startsWith("/embed/")) {
        return { title: "YouTube", url: `https://www.youtube-nocookie.com${u.pathname}${u.search || "?autoplay=1&mute=1"}` };
      }
    }

    // ===== Spotify =====
    if (u.hostname.includes("open.spotify.com")) {
      // /track/xxx  /playlist/xxx  /album/xxx
      const parts = u.pathname.split("/").filter(Boolean); // ["track","ID"]
      if (parts.length >= 2) {
        return { title: "Spotify",
          url: `https://open.spotify.com/embed/${parts[0]}/${parts[1]}?autoplay=1` };
      }
      // 已经是 /embed/…
      if (parts[0] === "embed") return { title: "Spotify", url: u.href };
    }

    // ===== SoundCloud =====
    if (u.hostname.includes("soundcloud.com")) {
      const trackUrl = encodeURIComponent(`https://soundcloud.com${u.pathname}`);
      return { title: "SoundCloud",
        url: `https://w.soundcloud.com/player/?url=${trackUrl}&auto_play=true` };
    }
    if (u.hostname.includes("w.soundcloud.com")) {
      return { title: "SoundCloud", url: u.href };
    }

    // ===== 网易云音乐 =====
    // 例: https://music.163.com/#/song?id=1441757341 或 https://music.163.com/song?id=xxx
    if (u.hostname.includes("music.163.com")) {
      const id = u.searchParams.get("id");
      if (id) {
        // type=2: song, auto=1 自动播放, height=66 迷你条
        return { title: "NetEase",
          url: `https://music.163.com/outchain/player?type=2&id=${id}&auto=1&height=66` };
      }
    }

    // ===== Bilibili =====
    // 例: https://www.bilibili.com/video/BVxxxx
    if (u.hostname.includes("bilibili.com")) {
      const m = u.pathname.match(/\/video\/(BV[\w]+)/i);
      if (m) {
        return { title: "bilibili",
          url: `https://player.bilibili.com/player.html?bvid=${m[1]}&autoplay=1` };
      }
    }
    if (u.hostname.includes("player.bilibili.com")) {
      return { title: "bilibili", url: u.href };
    }

    // 其它：不支持
    return null;
  } catch (e) {
    return null;
  }
}
