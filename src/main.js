import './style.css';
import { createClient } from '@supabase/supabase-js';
import JSZip from 'jszip';

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

const BUCKET = 'photos';
const app = document.getElementById('app');

app.innerHTML = `
  <button id="checkout-open" class="checkout-open" type="button">
    Checkout <span id="checkout-count" class="checkout-count">0</span>
  </button>
  <header><h1>Andreas & Dorita Wedding</h1></header>
  <p id="status">Loading...</p>
  <nav id="filters" class="filters" aria-label="Filter photos" hidden></nav>
  <div id="grid" class="grid"></div>
  <div id="checkout" class="checkout" role="dialog" aria-modal="true" aria-labelledby="checkout-title" hidden>
    <section class="checkout-panel">
      <button class="checkout-close" type="button" aria-label="Close checkout">&times;</button>
      <h2 id="checkout-title">Selected photos</h2>
      <p class="checkout-empty">No photos selected yet.</p>
      <div class="checkout-slider" hidden>
        <div class="checkout-slide">
          <button class="checkout-prev" type="button" aria-label="Previous selected photo">&#8249;</button>
          <img class="checkout-image" alt="" />
          <button class="checkout-next" type="button" aria-label="Next selected photo">&#8250;</button>
        </div>
        <p class="checkout-caption"></p>
        <p class="checkout-slide-count"></p>
        <button class="checkout-remove" type="button">Remove from selection</button>
      </div>
      <p class="checkout-status" role="status" aria-live="polite"></p>
      <button class="checkout-download" type="button" disabled>Download selected photos</button>
    </section>
  </div>
  <div id="lightbox" class="lightbox" hidden>
    <button class="lb-close" aria-label="Close">&times;</button>
    <button class="lb-prev" aria-label="Previous">&#8249;</button>
    <div class="lb-content">
      <img class="lb-img" alt="" />
      <button class="lb-select" type="button"></button>
    </div>
    <button class="lb-next" aria-label="Next">&#8250;</button>
    <div class="lb-count"></div>
  </div>
`;

const grid = document.getElementById('grid');
const status = document.getElementById('status');
const filters = document.getElementById('filters');
const checkoutOpen = document.getElementById('checkout-open');
const checkoutCount = document.getElementById('checkout-count');
const checkout = document.getElementById('checkout');
const checkoutEmpty = checkout.querySelector('.checkout-empty');
const checkoutSlider = checkout.querySelector('.checkout-slider');
const checkoutImage = checkout.querySelector('.checkout-image');
const checkoutCaption = checkout.querySelector('.checkout-caption');
const checkoutSlideCount = checkout.querySelector('.checkout-slide-count');
const checkoutStatus = checkout.querySelector('.checkout-status');
const checkoutDownload = checkout.querySelector('.checkout-download');
const lightbox = document.getElementById('lightbox');
const lbImg = lightbox.querySelector('.lb-img');
const lbCount = lightbox.querySelector('.lb-count');
const lbSelect = lightbox.querySelector('.lb-select');

let photos = [];
let visiblePhotos = [];
const selectedPhotos = new Set();
let activeFolder = null;
let current = 0;
let checkoutIndex = 0;

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
    const card = document.createElement('div');
    card.className = 'photo-card';

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

    const select = document.createElement('button');
    select.type = 'button';
    select.className = 'photo-select';
    select.setAttribute('aria-pressed', String(selectedPhotos.has(photo.path)));
    select.setAttribute(
      'aria-label',
      selectedPhotos.has(photo.path) ? 'Remove photo from selection' : 'Add photo to selection'
    );
    select.textContent = selectedPhotos.has(photo.path) ? '✓' : '+';
    select.addEventListener('click', () => toggleSelection(photo.path));

    card.append(thumb, select);
    grid.append(card);
  });
}

function toggleSelection(path) {
  if (selectedPhotos.has(path)) {
    selectedPhotos.delete(path);
  } else {
    selectedPhotos.add(path);
  }
  renderGrid();
  renderSelectionState();
}

function renderSelectionState() {
  checkoutCount.textContent = String(selectedPhotos.size);
  checkoutOpen.setAttribute('aria-label', `Checkout, ${selectedPhotos.size} photos selected`);

  const photo = visiblePhotos[current];
  if (photo) {
    const isSelected = selectedPhotos.has(photo.path);
    lbSelect.textContent = isSelected ? '✓ Added to selection' : '+ Add to selection';
    lbSelect.setAttribute('aria-pressed', String(isSelected));
  }

  if (!checkout.hidden) renderCheckout();
}

function renderCheckout() {
  const items = photos.filter((photo) => selectedPhotos.has(photo.path));
  checkoutEmpty.hidden = items.length > 0;
  checkoutSlider.hidden = items.length === 0;
  checkoutDownload.disabled = items.length === 0;

  if (!items.length) return;

  checkoutIndex = Math.min(checkoutIndex, items.length - 1);
  const photo = items[checkoutIndex];
  checkoutImage.src = photo.url;
  checkoutCaption.textContent = photo.path;
  checkoutSlideCount.textContent = `${checkoutIndex + 1} / ${items.length}`;
  checkout.querySelector('.checkout-prev').disabled = items.length < 2;
  checkout.querySelector('.checkout-next').disabled = items.length < 2;
}

function show(i) {
  current = (i + visiblePhotos.length) % visiblePhotos.length;
  const photo = visiblePhotos[current];
  lbImg.src = photo.url;
  lbCount.textContent = `${current + 1} / ${visiblePhotos.length}`;
  renderSelectionState();
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

function openCheckout() {
  renderCheckout();
  checkoutStatus.textContent = '';
  checkout.hidden = false;
  document.body.classList.add('no-scroll');
}

function closeCheckout() {
  checkout.hidden = true;
  document.body.classList.remove('no-scroll');
}

function showCheckoutPhoto(offset) {
  const items = photos.filter((photo) => selectedPhotos.has(photo.path));
  if (!items.length) return;
  checkoutIndex = (checkoutIndex + offset + items.length) % items.length;
  renderCheckout();
}

grid.addEventListener('click', (e) => {
  const thumb = e.target.closest('.thumb');
  if (thumb) openLightbox(Number(thumb.dataset.i));
});

checkoutOpen.addEventListener('click', openCheckout);
checkout.querySelector('.checkout-close').addEventListener('click', closeCheckout);
checkout.querySelector('.checkout-prev').addEventListener('click', () => showCheckoutPhoto(-1));
checkout.querySelector('.checkout-next').addEventListener('click', () => showCheckoutPhoto(1));
checkout.querySelector('.checkout-remove').addEventListener('click', () => {
  const photo = photos.filter((item) => selectedPhotos.has(item.path))[checkoutIndex];
  if (photo) toggleSelection(photo.path);
});
checkout.addEventListener('click', (e) => {
  if (e.target === checkout) closeCheckout();
});
checkoutDownload.addEventListener('click', async () => {
  const items = photos.filter((photo) => selectedPhotos.has(photo.path));
  if (!items.length) return;

  checkoutDownload.disabled = true;
  checkoutStatus.textContent = 'Preparing your download...';

  try {
    const zip = new JSZip();
    for (const photo of items) {
      const response = await fetch(photo.url);
      if (!response.ok) {
        throw new Error(`Could not download ${photo.path} (${response.status}).`);
      }
      zip.file(photo.path, await response.blob());
    }

    const archive = await zip.generateAsync({ type: 'blob' });
    const downloadUrl = URL.createObjectURL(archive);
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = 'wedding-photos.zip';
    link.click();
    URL.revokeObjectURL(downloadUrl);
    checkoutStatus.textContent = `Downloaded ${items.length} photo${items.length === 1 ? '' : 's'}.`;
  } catch (error) {
    checkoutStatus.textContent =
      error instanceof Error ? `Download failed: ${error.message}` : 'Download failed.';
  } finally {
    checkoutDownload.disabled = selectedPhotos.size === 0;
  }
});

lbSelect.addEventListener('click', () => {
  const photo = visiblePhotos[current];
  if (photo) toggleSelection(photo.path);
});

lightbox.querySelector('.lb-close').addEventListener('click', closeLightbox);
lightbox.querySelector('.lb-prev').addEventListener('click', () => show(current - 1));
lightbox.querySelector('.lb-next').addEventListener('click', () => show(current + 1));
lightbox.addEventListener('click', (e) => {
  if (e.target === lightbox) closeLightbox();
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    if (!checkout.hidden) closeCheckout();
    else if (!lightbox.hidden) closeLightbox();
    return;
  }
  if (lightbox.hidden) return;
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