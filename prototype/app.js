const GITHUB_DATA_URL = 'https://raw.githubusercontent.com/dxxnomore/CSCI-GA-2270-Computer-Graphics-Final-Project/film-archive-prototype/data/films.json';
const LOCAL_DATA_URL = './films.json';
const $ = id => document.getElementById(id);
const state = { films: [], selected: null, stage: 0, model: null, modelStarted: false };

function validData(data) {
  return data && Array.isArray(data.films) && data.films.length > 0 && data.films.every(f => f.id && f.name && f.brand && f.type && f.source);
}

async function readData() {
  for (const url of [`${GITHUB_DATA_URL}?v=${Date.now()}`, LOCAL_DATA_URL]) {
    try {
      const response = await fetch(url, { cache: 'no-store' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      if (validData(data)) return data.films;
    } catch (error) { /* Use the next source. */ }
  }
  return [];
}

function makeCard(film) {
  const card = document.createElement('button');
  card.type = 'button';
  card.className = 'film-card';
  card.setAttribute('aria-label', `查看 ${film.brand} ${film.name}`);
  const face = document.createElement('span'); face.className = 'package-face';
  const top = document.createElement('span'); top.className = 'package-top'; top.textContent = film.brand;
  const name = document.createElement('span'); name.className = 'package-name'; name.textContent = film.name;
  const bottom = document.createElement('span'); bottom.className = 'package-bottom';
  const iso = document.createElement('span'); iso.className = 'package-iso'; iso.textContent = film.iso;
  const format = document.createElement('span'); format.className = 'package-format'; format.textContent = 'ISO';
  bottom.append(iso, format); face.append(top, name, bottom);
  card.append(face);
  card.addEventListener('click', () => openFilm(film.id));
  return card;
}

function renderGrid() {
  const grid = $('film-grid'); grid.replaceChildren();
  state.films.forEach(film => grid.append(makeCard(film)));
  $('load-error').hidden = state.films.length > 0;
}

function renderMore(film) {
  const container = $('more-content'); container.replaceChildren();
  const photos = Array.isArray(film.photos) ? film.photos.filter(p => p.url && p.author && p.permission) : [];
  const tips = Array.isArray(film.tips) ? film.tips.filter(t => t.text && t.author) : [];
  container.hidden = !photos.length && !tips.length;
  if (photos.length) {
    const heading = document.createElement('h3'); heading.textContent = '样片';
    const gallery = document.createElement('div'); gallery.className = 'photos';
    photos.slice(0, 6).forEach(photo => {
      const figure = document.createElement('figure');
      const image = document.createElement('img'); image.src = photo.url; image.alt = photo.alt || `${photo.author} 的胶片照片`; image.loading = 'lazy';
      const caption = document.createElement('figcaption'); caption.textContent = `${photo.author}${photo.caption ? ` · ${photo.caption}` : ''}`;
      figure.append(image, caption); gallery.append(figure);
    });
    container.append(heading, gallery);
  }
  if (tips.length) {
    const heading = document.createElement('h3'); heading.textContent = '摄影者经验';
    const list = document.createElement('div'); list.className = 'tips';
    tips.slice(0, 3).forEach(tip => {
      const item = document.createElement('blockquote'); item.textContent = tip.text;
      const author = document.createElement('cite'); author.textContent = `— ${tip.author}`;
      item.append(author); list.append(item);
    });
    container.append(heading, list);
  }
}

function openFilm(id, updateUrl = true) {
  const film = state.films.find(f => f.id === id);
  if (!film) return;
  state.selected = film;
  $('collection').hidden = true;
  $('detail').hidden = false;
  $('record-brand').textContent = film.brand;
  $('record-title').textContent = film.name;
  $('record-type').textContent = film.nameZh || film.type;
  $('spec-iso').textContent = String(film.iso);
  $('spec-format').textContent = film.format || '—';
  $('spec-process').textContent = film.process || '—';
  $('record-source').href = film.source;
  renderMore(film);
  setStage(0);
  state.model?.setFilm(film);
  if (!state.modelStarted) { state.modelStarted = true; init3D(); }
  if (updateUrl) history.replaceState(null, '', `#${encodeURIComponent(id)}`);
  window.scrollTo(0, 0);
}

function showGrid(updateUrl = true) {
  $('detail').hidden = true;
  $('collection').hidden = false;
  state.selected = null;
  if (updateUrl) history.replaceState(null, '', location.pathname + location.search);
  window.scrollTo(0, 0);
}

function setStage(n) {
  state.stage = n;
  document.querySelectorAll('[data-stage]').forEach(button => button.setAttribute('aria-pressed', String(Number(button.dataset.stage) === n)));
  state.model?.setStage(n);
}

async function init3D() {
  let THREE;
  try { THREE = await import('https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js'); }
  catch (error) { $('viewer-fallback').hidden = false; return; }

  const canvas = $('model-canvas');
  let renderer;
  try { renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'low-power' }); }
  catch (error) { $('viewer-fallback').hidden = false; return; }
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
      ctx.font = '700 43px Arial'; ctx.fillText(film.brand, 52, 95);
      ctx.fillRect(52, 118, 408, 2);
      ctx.font = '700 60px Arial';
      const words = (film.modelLabel || film.name).split(' ');
      words.forEach((word, i) => ctx.fillText(word.slice(0, 13), 52, 275 + i * 70));
      ctx.font = '700 108px Arial'; ctx.fillText(String(film.iso), 48, 574);
      ctx.font = '28px Arial'; ctx.fillText('ISO', 51, 620); ctx.fillText(film.format || '135', 345, 620);
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

document.querySelectorAll('[data-stage]').forEach(button => button.addEventListener('click', () => setStage(Number(button.dataset.stage))));
$('reset-view').addEventListener('click', () => state.model?.reset());
$('back-button').addEventListener('click', () => showGrid());
$('home-link').addEventListener('click', event => { event.preventDefault(); showGrid(); });
document.addEventListener('keydown', event => { if (event.key === 'Escape' && !$('detail').hidden) showGrid(); });
window.addEventListener('hashchange', () => {
  const id = decodeURIComponent(location.hash.slice(1));
  if (state.films.some(f => f.id === id)) openFilm(id, false);
  else showGrid(false);
});

async function start() {
  state.films = await readData();
  renderGrid();
  const id = decodeURIComponent(location.hash.slice(1));
  if (state.films.some(f => f.id === id)) openFilm(id, false);
}
start();
