const GITHUB_DATA_URL = 'https://raw.githubusercontent.com/dxxnomore/CSCI-GA-2270-Computer-Graphics-Final-Project/film-archive-prototype/data/films.json';
const LOCAL_DATA_URL = './films.json';
const $ = (id) => document.getElementById(id);
const state = { films: [], selected: null, filter: '全部', query: '', stage: 0, model: null };

function validData(data) {
  return data && Array.isArray(data.films) && data.films.length > 0 && data.films.every(f => f.id && f.name && f.brand && f.type && f.source);
}

async function readData() {
  for (const [url, label] of [[`${GITHUB_DATA_URL}?v=${Date.now()}`, '馆藏资料已从 GitHub 同步'], [LOCAL_DATA_URL, '当前显示随网站发布的馆藏资料']]) {
    try {
      const response = await fetch(url, { cache: 'no-store' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      if (!validData(data)) throw new Error('Invalid film data');
      $('data-status').textContent = `${label} · 更新于 ${data.updatedAt || '未知日期'}`;
      return data.films;
    } catch (error) { /* Try the next source. */ }
  }
  $('data-status').textContent = '馆藏资料暂时无法读取';
  return [];
}

function makeFilmRow(film, index) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = `film-row${state.selected?.id === film.id ? ' active' : ''}`;
  button.setAttribute('aria-current', state.selected?.id === film.id ? 'true' : 'false');
  const number = document.createElement('span'); number.className = 'ordinal'; number.textContent = String(index + 1).padStart(2, '0');
  const main = document.createElement('span');
  const name = document.createElement('span'); name.className = 'film-name'; name.textContent = film.name;
  const brand = document.createElement('span'); brand.className = 'film-brand'; brand.textContent = film.brand;
  main.append(name, brand);
  const iso = document.createElement('span'); iso.className = 'row-iso'; iso.textContent = `ISO ${film.iso}`;
  button.append(number, main, iso);
  button.addEventListener('click', () => selectFilm(film.id));
  return button;
}

function renderList() {
  const list = $('film-list'); list.replaceChildren();
  const q = state.query.trim().toLowerCase();
  const found = state.films.filter(f => (state.filter === '全部' || f.type === state.filter) && (!q || [f.brand, f.name, f.type, f.iso, f.process].some(x => String(x ?? '').toLowerCase().includes(q))));
  $('item-count').textContent = `${String(found.length).padStart(2, '0')} ITEMS`;
  if (!found.length) {
    const empty = document.createElement('p'); empty.className = 'list-empty'; empty.textContent = '没有找到符合条件的胶片。'; list.append(empty);
  } else found.forEach((film, index) => list.append(makeFilmRow(film, index)));
}

function renderPhotos(photos) {
  const container = $('photo-list'); container.replaceChildren();
  if (!Array.isArray(photos) || !photos.length) {
    for (let i = 1; i <= 3; i++) {
      const item = document.createElement('div'); item.className = 'photo-placeholder';
      const no = document.createElement('span'); no.textContent = String(i).padStart(2, '0');
      const label = document.createElement('span'); label.innerHTML = '摄影作品<br>待收录';
      item.append(no, label); container.append(item);
    }
    return;
  }
  photos.slice(0, 6).forEach(photo => {
    if (!photo.url || !photo.author || !photo.permission) return;
    const figure = document.createElement('figure'); figure.className = 'photo-entry';
    const image = document.createElement('img'); image.src = photo.url; image.alt = photo.alt || `${photo.author} 的胶片照片`; image.loading = 'lazy';
    const caption = document.createElement('figcaption'); caption.textContent = `${photo.author}${photo.caption ? ` · ${photo.caption}` : ''}`;
    figure.append(image, caption); container.append(figure);
  });
}

function renderTips(tips) {
  const container = $('tip-list'); container.replaceChildren();
  if (!Array.isArray(tips) || !tips.length) {
    const item = document.createElement('p'); item.className = 'empty-note'; item.textContent = '精选建议正在征集中。这里只会保留有具体拍摄情境和参考价值的经验。'; container.append(item); return;
  }
  tips.slice(0, 3).forEach(tip => {
    if (!tip.text || !tip.author) return;
    const item = document.createElement('div'); item.className = 'tip-item'; item.textContent = tip.text;
    const by = document.createElement('small'); by.textContent = `— ${tip.author}`; item.append(by); container.append(item);
  });
}

function selectFilm(id) {
  const film = state.films.find(f => f.id === id); if (!film) return;
  state.selected = film;
  const index = state.films.indexOf(film);
  $('viewer-index').textContent = `NO. ${String(index + 1).padStart(3, '0')}`;
  $('record-brand').textContent = film.brand;
  $('record-title').textContent = film.name;
  $('record-type').textContent = film.nameZh || film.type;
  $('record-description').textContent = film.description || '';
  $('spec-iso').textContent = `ISO ${film.iso}`;
  $('spec-format').textContent = film.format;
  $('spec-type').textContent = film.type;
  $('spec-process').textContent = film.process;
  $('scan-status').textContent = film.scanStatus || '待整理';
  $('model-edition').textContent = film.edition || '包装示意模型';
  $('record-source').href = film.source;
  renderPhotos(film.photos); renderTips(film.tips); renderList();
  state.model?.setFilm(film);
  try { history.replaceState(null, '', `#${film.id}`); } catch (error) { /* Optional deep link. */ }
}

function setStage(n) {
  state.stage = n;
  document.querySelectorAll('[data-stage]').forEach(button => {
    const selected = Number(button.dataset.stage) === n;
    button.classList.toggle('selected', selected);
    button.setAttribute('aria-pressed', String(selected));
  });
  $('viewer-title').textContent = ['胶片包装', '胶卷暗盒', '影像胶片'][n];
  state.model?.setStage(n);
}

async function init3D() {
  let THREE;
  try { THREE = await import('https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js'); }
  catch (error) { $('viewer-fallback').hidden = false; $('viewer-hint').hidden = true; return; }

  const canvas = $('model-canvas');
  let renderer;
  try { renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'low-power' }); }
  catch (error) { $('viewer-fallback').hidden = false; $('viewer-hint').hidden = true; return; }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(32, 1, .1, 100); camera.position.set(0, .15, 8.1);
  const ambient = new THREE.AmbientLight(0xffffff, 2.4); scene.add(ambient);
  const key = new THREE.DirectionalLight(0xffffff, 3.2); key.position.set(-3, 6, 7); scene.add(key);
  const rim = new THREE.DirectionalLight(0xffffff, 1.7); rim.position.set(5, 2, -4); scene.add(rim);
  const pivot = new THREE.Group(); scene.add(pivot);
  const box = new THREE.Group(); pivot.add(box);
  const paper = new THREE.MeshStandardMaterial({ color: 0xe8e8e4, roughness: .92 });
  const ink = new THREE.MeshStandardMaterial({ color: 0x171717, roughness: .86 });
  const edge = new THREE.LineBasicMaterial({ color: 0x555555 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(2.08, 2.9, .58), paper); box.add(body);
  const bodyEdges = new THREE.LineSegments(new THREE.EdgesGeometry(body.geometry), edge); box.add(bodyEdges);
  let boxTexture, canTexture;
  const front = new THREE.Mesh(new THREE.PlaneGeometry(2.07, 2.89), new THREE.MeshBasicMaterial({ color: 0xffffff })); front.position.z = .296; box.add(front);
  const flapPivot = new THREE.Group(); flapPivot.position.y = 1.45; box.add(flapPivot);
  const flap = new THREE.Mesh(new THREE.BoxGeometry(2.08, .32, .58), paper); flap.position.y = .15; flapPivot.add(flap);
  flapPivot.add(new THREE.LineSegments(new THREE.EdgesGeometry(flap.geometry), edge));

  const canister = new THREE.Group(); pivot.add(canister);
  const steel = new THREE.MeshStandardMaterial({ color: 0xa4a4a1, metalness: .72, roughness: .33 });
  const canBody = new THREE.Mesh(new THREE.CylinderGeometry(.42, .42, 1.47, 48), steel); canBody.rotation.z = Math.PI / 2; canister.add(canBody);
  for (const x of [-.79, .79]) { const cap = new THREE.Mesh(new THREE.CylinderGeometry(.445, .445, .13, 48), ink); cap.rotation.z = Math.PI / 2; cap.position.x = x; canister.add(cap); }
  const reel = new THREE.Mesh(new THREE.CylinderGeometry(.17, .17, .08, 32), steel); reel.rotation.z = Math.PI / 2; reel.position.x = -.89; canister.add(reel);
  const canLabel = new THREE.Mesh(new THREE.PlaneGeometry(1.13, .52), new THREE.MeshBasicMaterial({ color: 0xffffff })); canLabel.position.z = .428; canister.add(canLabel);

  const strip = new THREE.Group(); pivot.add(strip);
  const stripBody = new THREE.Mesh(new THREE.PlaneGeometry(3.4, .85), ink); strip.add(stripBody);
  const frameMaterial = new THREE.MeshBasicMaterial({ color: 0xaaaaa7 });
  for (let i = 0; i < 4; i++) {
    const frame = new THREE.Mesh(new THREE.PlaneGeometry(.69, .56), frameMaterial); frame.position.set(-1.21 + i * .81, 0, .012); strip.add(frame);
    for (const y of [-.37, .37]) { const perf = new THREE.Mesh(new THREE.PlaneGeometry(.13, .06), new THREE.MeshBasicMaterial({ color: 0xbfbfbb })); perf.position.set(-1.21 + i * .81, y, .013); strip.add(perf); }
  }

  function labelTexture(film, compact = false) {
    const c = document.createElement('canvas'); c.width = 512; c.height = compact ? 220 : 720;
    const ctx = c.getContext('2d'); ctx.fillStyle = '#e7e7e3'; ctx.fillRect(0, 0, c.width, c.height);
    ctx.fillStyle = '#111'; ctx.strokeStyle = '#111';
    if (compact) {
      ctx.font = '700 38px Arial'; ctx.fillText(film.brand, 24, 58); ctx.font = '700 53px Arial'; ctx.fillText((film.modelLabel || film.name).slice(0, 13), 24, 130); ctx.font = '26px Arial'; ctx.fillText(`ISO ${film.iso}`, 25, 184);
    } else {
      ctx.lineWidth = 3; ctx.strokeRect(26, 26, 460, 668);
      ctx.font = '700 36px Arial'; ctx.fillText('FILM ARCHIVE', 52, 86);
      ctx.fillRect(52, 118, 408, 2);
      ctx.font = '700 37px Arial'; ctx.fillText(film.brand, 52, 219);
      ctx.font = '700 60px Arial';
      const words = (film.modelLabel || film.name).split(' ');
      words.forEach((word, i) => ctx.fillText(word.slice(0, 13), 52, 320 + i * 70));
      ctx.font = '700 108px Arial'; ctx.fillText(String(film.iso), 48, 574);
      ctx.font = '28px Arial'; ctx.fillText('ISO', 51, 620); ctx.fillText(film.format || '135', 345, 620);
      ctx.font = '20px Arial'; ctx.fillText('CONCEPT MODEL / NOT ORIGINAL PACKAGING', 52, 671);
    }
    const texture = new THREE.CanvasTexture(c); texture.colorSpace = THREE.SRGBColorSpace; return texture;
  }
  function setFilm(film) {
    boxTexture?.dispose(); canTexture?.dispose();
    boxTexture = labelTexture(film); canTexture = labelTexture(film, true);
    front.material.map = boxTexture; front.material.needsUpdate = true;
    canLabel.material.map = canTexture; canLabel.material.needsUpdate = true;
  }

  let targetStage = 0, progress = 0, drag = false, lastX = 0, lastY = 0, yaw = -.32, pitch = -.09;
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  function setStage3D(n) { targetStage = n; }
  function reset() { yaw = -.32; pitch = -.09; }
  canvas.addEventListener('pointerdown', e => { drag = true; lastX = e.clientX; lastY = e.clientY; canvas.setPointerCapture(e.pointerId); });
  canvas.addEventListener('pointerup', () => { drag = false; });
  canvas.addEventListener('pointercancel', () => { drag = false; });
  canvas.addEventListener('pointermove', e => { if (!drag) return; yaw += (e.clientX - lastX) * .006; pitch = Math.max(-.7, Math.min(.7, pitch + (e.clientY - lastY) * .004)); lastX = e.clientX; lastY = e.clientY; });
  function resize() { const w = canvas.clientWidth, h = canvas.clientHeight; if (!w || !h) return; renderer.setSize(w, h, false); camera.aspect = w / h; camera.position.z = w < 500 ? 9.4 : 8.1; camera.updateProjectionMatrix(); }
  new ResizeObserver(resize).observe(canvas); resize();
  function animate() {
    requestAnimationFrame(animate);
    progress += (targetStage - progress) * (reducedMotion ? 1 : .075);
    if (Math.abs(targetStage - progress) < .001) progress = targetStage;
    const first = Math.min(1, Math.max(0, progress));
    const second = Math.min(1, Math.max(0, progress - 1));
    box.position.set(-1.35 * first - 1.4 * second, .05 + .18 * first, -.1);
    box.rotation.z = -.07 * first - .08 * second;
    box.scale.setScalar(1 - .08 * first - .16 * second);
    flapPivot.rotation.x = -1.1 * first;
    canister.position.set(.9 * first - 2.0 * second, -.08 - .38 * second, .3 + .25 * first);
    canister.scale.setScalar(Math.max(.001, first));
    strip.position.set(.65, -.38, .31);
    strip.scale.set(Math.max(.001, second), Math.max(.001, second), 1);
    strip.visible = second > .01;
    pivot.rotation.y += (yaw - pivot.rotation.y) * .11;
    pivot.rotation.x += (pitch - pivot.rotation.x) * .11;
    renderer.render(scene, camera);
  }
  animate();
  state.model = { setFilm, setStage: setStage3D, reset };
  if (state.selected) setFilm(state.selected);
  setStage3D(state.stage);
}

document.querySelectorAll('[data-filter]').forEach(button => button.addEventListener('click', () => {
  state.filter = button.dataset.filter;
  document.querySelectorAll('[data-filter]').forEach(item => item.setAttribute('aria-pressed', String(item === button)));
  renderList();
}));
$('search').addEventListener('input', event => { state.query = event.target.value; renderList(); });
document.querySelectorAll('[data-stage]').forEach(button => button.addEventListener('click', () => setStage(Number(button.dataset.stage))));
$('reset-view').addEventListener('click', () => state.model?.reset());

async function start() {
  state.films = await readData();
  if (state.films.length) selectFilm(location.hash ? decodeURIComponent(location.hash.slice(1)) : state.films[0].id);
  else renderList();
  init3D();
}
start();
