import DefaultTheme from 'vitepress/theme';
import type { Theme } from 'vitepress';
import { inBrowser, useRoute } from 'vitepress';
// @ts-expect-error no need to add vue
import { nextTick, onMounted, watch } from 'vue';
import './custom.css';

/**
 * Lightbox with guide captions
 */

interface GalleryEntry {
  img: HTMLImageElement;
  heading: string;
  narration: string;
}

interface OverlayRefs {
  root: HTMLDivElement;
  stageImg: HTMLImageElement;
  captionTitle: HTMLDivElement;
  captionBody: HTMLDivElement;
  captionCounter: HTMLDivElement;
  prevBtn: HTMLButtonElement;
  nextBtn: HTMLButtonElement;
}

let listenerAttached = false;
let overlay: OverlayRefs | null = null;
let gallery: GalleryEntry[] = [];
let currentIndex = 0;

function stopPropagation(event: Event): void {
  event.stopPropagation();
}

function onKeydown(event: KeyboardEvent): void {
  switch (event.key) {
    case 'Escape':
      closeOverlay();
      break;
    case 'ArrowLeft':
      showAt(currentIndex - 1);
      break;
    case 'ArrowRight':
      showAt(currentIndex + 1);
      break;
  }
}

function closeOverlay(): void {
  if (!overlay) {
    return;
  }
  overlay.root.remove();
  overlay = null;
  gallery = [];
  currentIndex = 0;
  document.removeEventListener('keydown', onKeydown);
  document.body.style.overflow = '';
}

function showAt(index: number): void {
  if (!overlay || index < 0 || index >= gallery.length) {
    return;
  }

  currentIndex = index;
  const entry = gallery[currentIndex];
  const img = entry.img;

  overlay.stageImg.src = img.currentSrc || img.src;
  overlay.stageImg.alt = img.alt;
  overlay.captionTitle.textContent = entry.heading;
  overlay.captionTitle.hidden = !entry.heading;

  const bodyText = entry.narration || img.alt;

  overlay.captionBody.textContent = bodyText;
  overlay.captionBody.hidden = !bodyText;
  overlay.captionCounter.textContent = `${currentIndex + 1} / ${gallery.length}`;
  overlay.prevBtn.hidden = currentIndex === 0;
  overlay.nextBtn.hidden = currentIndex === gallery.length - 1;
}

function buildOverlay(): OverlayRefs {
  const root = document.createElement('div');
  root.className = 'screenshot-overlay';
  root.addEventListener('click', closeOverlay);

  const prevBtn = document.createElement('button');
  prevBtn.type = 'button';
  prevBtn.className = 'screenshot-nav screenshot-nav-prev';
  prevBtn.setAttribute('aria-label', 'Previous screenshot');
  prevBtn.textContent = '‹'; // ‹
  prevBtn.addEventListener('click', (event) => {
    stopPropagation(event);
    showAt(currentIndex - 1);
  });

  const nextBtn = document.createElement('button');
  nextBtn.type = 'button';
  nextBtn.className = 'screenshot-nav screenshot-nav-next';
  nextBtn.setAttribute('aria-label', 'Next screenshot');
  nextBtn.textContent = '›'; // ›
  nextBtn.addEventListener('click', (event) => {
    stopPropagation(event);
    showAt(currentIndex + 1);
  });

  const stage = document.createElement('div');
  stage.className = 'screenshot-stage';

  const stageImg = document.createElement('img');
  stage.appendChild(stageImg);

  const caption = document.createElement('div');
  caption.className = 'screenshot-caption';
  caption.addEventListener('click', stopPropagation);

  const captionTitle = document.createElement('div');
  captionTitle.className = 'screenshot-caption-title';

  const captionBody = document.createElement('div');
  captionBody.className = 'screenshot-caption-body';

  const captionCounter = document.createElement('div');
  captionCounter.className = 'screenshot-caption-counter';

  caption.append(captionTitle, captionBody, captionCounter);
  stage.appendChild(caption);

  root.append(prevBtn, stage, nextBtn);

  return { root, stageImg, captionTitle, captionBody, captionCounter, prevBtn, nextBtn };
}

function collectGallery(): GalleryEntry[] {
  const doc = document.querySelector('.vp-doc');
  if (!doc) {
    return [];
  }

  const entries: GalleryEntry[] = [];
  let heading = '';
  let narration = '';

  doc.querySelectorAll<HTMLElement>('h2, h3, p, img.screenshot').forEach((el) => {
    if (el.tagName === 'H2' || el.tagName === 'H3') {
      heading = (el.textContent ?? '').replace(/\u200B/g, '').trim();
      narration = '';
    } else if (el.tagName === 'P') {
      if (!el.querySelector('img.screenshot')) {
        narration = (el.textContent ?? '').trim();
      }
    } else {
      entries.push({ img: el as HTMLImageElement, heading, narration });
    }
  });

  return entries;
}

function openOverlay(clicked: HTMLImageElement): void {
  closeOverlay();

  gallery = collectGallery();
  const index = gallery.findIndex((entry) => entry.img === clicked);

  overlay = buildOverlay();
  document.body.appendChild(overlay.root);
  document.body.style.overflow = 'hidden';
  document.addEventListener('keydown', onKeydown);

  showAt(index === -1 ? 0 : index);
}

function onDocumentClick(event: MouseEvent): void {
  const target = event.target as HTMLElement | null;
  if (!target) {
    return;
  }

  const img = target.closest<HTMLImageElement>('.vp-doc img.screenshot');
  if (img) {
    openOverlay(img);
  }
}

function attachLightbox(): void {
  if (!inBrowser || listenerAttached) {
    return;
  }
  document.addEventListener('click', onDocumentClick);
  listenerAttached = true;
}

export default {
  extends: DefaultTheme,
  setup() {
    if (!inBrowser) {
      return;
    }

    const route = useRoute();

    attachLightbox();
    onMounted(() => {
      attachLightbox();
    });

    watch(
      () => route.path,
      () => {
        closeOverlay();
        nextTick(() => attachLightbox());
      },
    );
  },
} satisfies Theme;
