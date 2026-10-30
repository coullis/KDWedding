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
const lightbox = document.getElementById('lightbox');
const lbImg = lightbox.querySelector('.lb-img');
const lbCount = lightbox.querySelector('.lb-count');

let photos = [];
let current = 0;

async function load() {
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .list('', { limit: 1000, sortBy: { column: 'name', order: 'asc' } });

  if (error) {
    status.textContent = `Error: ${error.message}`;
    return;
  }

  photos = data
    .filter((f) => f.id && /\.(jpe?g|png|webp|gif)$/i.test(f.name))
    .map((f) => ({
      name: f.name,
      url: supabase.storage.from(BUCKET).getPublicUrl(f.name).data.publicUrl,
    }));

  status.hidden = photos.length > 0;
  if (!photos.length) status.textContent = 'No photos yet.';

  grid.innerHTML = photos
    .map(
      (p, i) =>
        `<button class="thumb" data-i="${i}"><img src="${p.url}" alt="" loading="lazy" /></button>`
    )
    .join('');
}

function show(i) {
  current = (i + photos.length) % photos.length;
  lbImg.src = photos[current].url;
  lbCount.textContent = `${current + 1} / ${photos.length}`;
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