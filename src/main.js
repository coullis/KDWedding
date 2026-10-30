import './style.css';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

const BUCKET = 'photos';
const app = document.getElementById('app');

app.innerHTML = `
  <header><h1>Our Wedding Photos</h1></header>
  <p id="status">Loading...</p>
  <nav id="filters" class="filters" aria-label="Filter photos" hidden></nav>
  <div id="grid" class="grid"></div>
  <div id="lightbox" class="lightbox" hidden>
    <button class="lb-close" aria-label="Close">&times;</button>
    <button class="lb-prev" aria-label="Previous">&#8249;</button>
    <img class="lb-img" alt="" />
    <button class="lb-next" aria-label="Next">&#8250;</button>
    <div class="lb-count"></div>
  </div>
`;

const grid = document.getElementById('grid');
const status = document.getElementById('status');
const filters = document.getElementById('filters');
const lightbox = document.getElementById('lightbox');
const lbImg = lightbox.querySelector('.lb-img');
const lbCount = lightbox.querySelector('.lb-count');

let photos = [];
let visiblePhotos = [];
let activeFolder = null;
let current = 0;

async function load() {
  const folders = [''];
  const visitedFolders = new Set();
  const discoveredFolders = new Set();

  try {
    while (folders.length) {
      const folder = folders.shift();
      if (visitedFolders.has(folder)) continue;
      visitedFolders.add(folder);

      const { data, error } = await supabase.storage
        .from(BUCKET)
        .list(folder, { limit: 1000, sortBy: { column: 'name', order: 'asc' } });

      if (error) throw error;

      for (const entry of data) {
        const path = folder ? `${folder}/${entry.name}` : entry.name;
        if (entry.id) {
          if (/\.(jpe?g|png|webp|gif)$/i.test(entry.name)) {
            photos.push({
              folder,
              path,
              url: supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl,
            });
          }
        } else {
          discoveredFolders.add(path);
          folders.push(path);
        }
      }
    }
  } catch (error) {
    status.textContent = `Error: ${error instanceof Error ? error.message : 'Unable to load photos.'}`;
    return;
  }

  photos.sort((a, b) => a.path.localeCompare(b.path));

  status.hidden = photos.length > 0;
  if (!photos.length) status.textContent = 'No photos yet.';

  const photoFolders = [...discoveredFolders]
    .filter((folder) =>
      photos.some((photo) => photo.folder === folder || photo.folder.startsWith(`${folder}/`))
    )
    .sort((a, b) => a.localeCompare(b));
  renderFilters(photoFolders);
  renderGrid();
}

function renderFilters(folders) {
  filters.hidden = false;
  filters.replaceChildren();

  for (const [value, label] of [[null, 'All'], ...folders.map((folder) => [folder, folder])]) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'filter-tag';
    button.textContent = label;
    button.setAttribute('aria-pressed', String(activeFolder === value));
    button.addEventListener('click', () => {
      activeFolder = value;
      renderFilters(folders);
      renderGrid();
    });
    filters.append(button);
  }
}

function renderGrid() {
  visiblePhotos =
    activeFolder === null
      ? photos
      : photos.filter(
          (photo) =>
            photo.folder === activeFolder || photo.folder.startsWith(`${activeFolder}/`)
        );
  grid.replaceChildren();

  visiblePhotos.forEach((photo, index) => {
    const thumb = document.createElement('button');
    thumb.type = 'button';
    thumb.className = 'thumb';
    thumb.dataset.i = String(index);
    thumb.setAttribute('aria-label', `Open photo ${index + 1}`);

    const img = document.createElement('img');
    img.src = photo.url;
    img.alt = '';
    img.loading = 'lazy';
    thumb.append(img);
    grid.append(thumb);
  });
}

function show(i) {
  current = (i + visiblePhotos.length) % visiblePhotos.length;
  lbImg.src = visiblePhotos[current].url;
  lbCount.textContent = `${current + 1} / ${visiblePhotos.length}`;
}

function openLightbox(i) {
  show(i);
  lightbox.hidden = false;
  document.body.classList.add('no-scroll');
}

function closeLightbox() {
  lightbox.hidden = true;
  lbImg.removeAttribute('src');
  document.body.classList.remove('no-scroll');
}

grid.addEventListener('click', (e) => {
  const thumb = e.target.closest('.thumb');
  if (thumb) openLightbox(Number(thumb.dataset.i));
});

lightbox.querySelector('.lb-close').addEventListener('click', closeLightbox);
lightbox.querySelector('.lb-prev').addEventListener('click', () => show(current - 1));
lightbox.querySelector('.lb-next').addEventListener('click', () => show(current + 1));
lightbox.addEventListener('click', (e) => {
  if (e.target === lightbox) closeLightbox();
});

document.addEventListener('keydown', (e) => {
  if (lightbox.hidden) return;
  if (e.key === 'Escape') closeLightbox();
  if (e.key === 'ArrowLeft') show(current - 1);
  if (e.key === 'ArrowRight') show(current + 1);
});

// Swipe on touch screens
let touchX = null;
lightbox.addEventListener('touchstart', (e) => (touchX = e.touches[0].clientX));
lightbox.addEventListener('touchend', (e) => {
  if (touchX === null) return;
  const dx = e.changedTouches[0].clientX - touchX;
  if (Math.abs(dx) > 50) show(current + (dx < 0 ? 1 : -1));
  touchX = null;
});

load();