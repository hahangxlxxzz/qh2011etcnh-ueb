const PREVIEW_MARGIN = 24;
const PREVIEW_CONTENT_OFFSET = 56;
const AUTO_RESUME_DELAY = 5000;
const ease = "sine.inOut";

let destinations = [];

window.addEventListener('error', (e) => {
  console.error('Window error:', e && e.error ? e.error : e.message || e);
});

window.addEventListener('unhandledrejection', (e) => {
  console.error('Unhandled rejection:', e && (e.reason || e));
});

const resolveImagePath = (imagePath) => {
  if (!imagePath) return "";
  if (/^(?:https?:)?\/\//i.test(imagePath) || imagePath.startsWith("data:")) {
    return imagePath;
  }

  const normalizedPath = imagePath.replace(/^\.\/+/, "");
  if (normalizedPath.startsWith("data/")) {
    return normalizedPath;
  }

  return `data/${normalizedPath}`;
};

const FALLBACK_IMAGE = resolveImagePath('img/img-20111105.jpg');

const PAUSE_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/></svg>`;
const PLAY_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M5 3v18l15-9L5 3z"/></svg>`;

const byId = (id) => document.getElementById(id);
const cardStage = byId("card-stage");
const slideNumbers = byId("slide-numbers");
const progressTrackBackground = document.querySelector(
  ".progress-track-background"
);

const state = {
  order: [],
  detailsEven: true,
  offsetTop: 200,
  offsetLeft: 700,
  cardWidth: 140,
  cardHeight: 90,
  gap: 18,
  numberSize: 40,
  autoActive: false,
  isTransitioning: false,
  resumeTimeout: null,
};

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const waitUntilIdle = async () => {
  while (state.isTransitioning) {
    await wait(16);
  }
};

const getTrackWidth = () => progressTrackBackground?.offsetWidth ?? 500;
const getCard = (index) => `#card${index}`;
const getCardContent = (index) => `#card-content-${index}`;
const getSliderItem = (index) => `#slide-item-${index}`;

const updateActiveCardClass = () => {
  document.querySelectorAll(".slideshow-card").forEach((card) => {
    const index = Number(card.dataset.cardIndex);
    card.classList.toggle("slideshow-card--active", index === state.order[0]);
  });
};

const updateDetailsPanel = (selector, content) => {
  const root = document.querySelector(selector);
  if (!root || !content) return;

  root.querySelector(".location-text").textContent = content.place;
  root.querySelector(".title-line--primary").textContent = content.title;
  root.querySelector(".title-line--secondary").textContent = content.title2;
  root.querySelector(".description").textContent = content.description;
};

const setInitialDetails = () => {
  updateDetailsPanel("#details-even", destinations[0]);
  updateDetailsPanel("#details-odd", destinations[1] ?? destinations[0]);
};

const computePreviewOffsets = (previewCount) => {
  const { innerHeight, innerWidth } = window;
  state.offsetTop = Math.max(
    innerHeight - state.cardHeight - PREVIEW_MARGIN,
    PREVIEW_MARGIN
  );
  const previewWidth =
    previewCount > 0
      ? previewCount * state.cardWidth + (previewCount - 1) * state.gap
      : state.cardWidth;
  state.offsetLeft = Math.max(
    innerWidth - previewWidth - PREVIEW_MARGIN,
    PREVIEW_MARGIN
  );
};

const animate = (target, duration, properties) =>
  new Promise((resolve) => {
    gsap.to(target, {
      ...properties,
      duration,
      onComplete: resolve,
    });
  });

const renderSlides = () => {
  const cardsMarkup = destinations
    .map(
      (item, index) => `
        <article class="slideshow-card" id="card${index}" data-card-index="${index}">
          <img class="slideshow-card-media" src="${item.image}" alt="${item.place}" loading="lazy" onerror="this.onerror=null; this.src='${FALLBACK_IMAGE}'" />
        </article>`
    )
    .join("");

  const cardContentMarkup = destinations
    .map(
      (item, index) => `
        <div class="card-content" id="card-content-${index}">
          <div class="content-start"></div>
          <div class="content-place">${item.place}</div>
          <div class="content-title-1">${item.title}</div>
          <div class="content-title-2">${item.title2}</div>
        </div>`
    )
    .join("");

  cardStage.innerHTML = `${cardsMarkup}${cardContentMarkup}`;

  // slide numbers removed; keep the container empty
  slideNumbers.innerHTML = "";
};

const playIndicator = async () => {
  await animate(".indicator", 2, { x: 0 });
  await animate(".indicator", 0.8, {
    x: window.innerWidth,
    delay: 0.3,
  });
  gsap.set(".indicator", { x: -window.innerWidth });
};

const advance = () =>
  new Promise((resolve) => {
    const previousActive = state.order[0];
    state.order.push(state.order.shift());
    state.detailsEven = !state.detailsEven;

    const detailsActive = state.detailsEven ? "#details-even" : "#details-odd";
    const detailsInactive = state.detailsEven ? "#details-odd" : "#details-even";

    updateDetailsPanel(detailsActive, destinations[state.order[0]]);
    updateActiveCardClass();

    gsap.set(detailsActive, { zIndex: 22 });
    gsap.to(detailsActive, { opacity: 1, delay: 0.4, ease });

    gsap.to(`${detailsActive} .location-text`, {
      y: 0,
      delay: 0.1,
      duration: 0.7,
      ease,
    });

    gsap.to(`${detailsActive} .title-line--primary`, {
      y: 0,
      delay: 0.15,
      duration: 0.7,
      ease,
    });

    gsap.to(`${detailsActive} .title-line--secondary`, {
      y: 0,
      delay: 0.15,
      duration: 0.7,
      ease,
    });

    gsap.to(`${detailsActive} .description`, {
      y: 0,
      delay: 0.3,
      duration: 0.4,
      ease,
    });

    computePreviewOffsets(state.order.length - 1);

    gsap.to("#pagination", {
      top: Math.max(state.offsetTop - 90, PREVIEW_MARGIN),
      left: state.offsetLeft,
      ease,
      delay: 0.15,
    });

    const [active, ...rest] = state.order;
    const previous = rest[rest.length - 1];

    gsap.set(detailsInactive, { zIndex: 12 });

    gsap.to(`${detailsActive} .action-row`, {
      y: 0,
      delay: 0.35,
      duration: 0.4,
      ease,
      onComplete: resolve,
    });

    gsap.set(getCard(previous), { zIndex: 10 });
    gsap.set(getCard(active), { zIndex: 20 });
    gsap.to(getCard(previous), { scale: 1.2, ease });

    gsap.to(getCardContent(active), {
      y: state.offsetTop + state.cardHeight - 32,
      opacity: 0,
      duration: 0.3,
      ease,
    });

    gsap.to(getSliderItem(active), { x: 0, ease });
    gsap.to(getSliderItem(previous), { x: -state.numberSize, ease });
    gsap.to(".progress-fill", {
      width: (getTrackWidth() / state.order.length) * (active + 1),
      ease,
    });

    gsap.to(getCard(active), {
      x: 0,
      y: 0,
      ease,
      width: window.innerWidth,
      height: window.innerHeight,
      borderRadius: 0,
      onComplete: () => {
        const xNew =
          state.offsetLeft + (rest.length - 1) * (state.cardWidth + state.gap);

        gsap.set(getCard(previous), {
          x: xNew,
          y: state.offsetTop,
          width: state.cardWidth,
          height: state.cardHeight,
          zIndex: 30,
          borderRadius: 16,
          scale: 1,
        });

        gsap.set(getCardContent(previous), {
          x: xNew,
          y: state.offsetTop + state.cardHeight - PREVIEW_CONTENT_OFFSET,
          opacity: 1,
          zIndex: 40,
        });

        gsap.set(getSliderItem(previous), {
          x: rest.length * state.numberSize,
        });

        gsap.set(detailsInactive, { opacity: 0 });
        gsap.set(`${detailsInactive} .location-text`, { y: 100 });
        gsap.set(`${detailsInactive} .title-line--primary`, { y: 100 });
        gsap.set(`${detailsInactive} .title-line--secondary`, { y: 100 });
        gsap.set(`${detailsInactive} .description`, { y: 50 });
        gsap.set(`${detailsInactive} .action-row`, { y: 60 });

        // reset any zoom/pan transforms after transition completes
        try { resetAllImageTransforms(); } catch (e) { /* ignore */ }
      },
    });

    rest.forEach((index, position) => {
      if (index === previous) return;

      const xTarget =
        state.offsetLeft + position * (state.cardWidth + state.gap);

      gsap.set(getCard(index), { zIndex: 30 });
      gsap.to(getCard(index), {
        x: xTarget,
        y: state.offsetTop,
        width: state.cardWidth,
        height: state.cardHeight,
        ease,
        delay: 0.1 * (position + 1),
        borderRadius: 16,
      });

      gsap.to(getCardContent(index), {
        x: xTarget,
        y: state.offsetTop + state.cardHeight - PREVIEW_CONTENT_OFFSET,
        opacity: 1,
        zIndex: 40,
        ease,
        delay: 0.1 * (position + 1),
      });

      gsap.to(getSliderItem(index), {
        x: (position + 1) * state.numberSize,
        ease,
      });
    });
  });

const runStep = async (withIndicator = true) => {
  await waitUntilIdle();
  state.isTransitioning = true;
  if (withIndicator) {
    await playIndicator();
  } else {
    gsap.set(".indicator", { x: -window.innerWidth });
  }
  await advance();
  state.isTransitioning = false;
};

const loop = async () => {
  if (!state.autoActive) return;
  await runStep(true);
  if (state.autoActive) loop();
};

const stopAutoCycle = () => {
  state.autoActive = false;
  clearTimeout(state.resumeTimeout);
};

const scheduleAutoResume = () => {
  clearTimeout(state.resumeTimeout);
  state.resumeTimeout = setTimeout(() => {
    if (!state.autoActive) {
      state.autoActive = true;
      loop();
    }
  }, AUTO_RESUME_DELAY);
};

const handleCardClick = async (event) => {
  const card = event.target.closest(".slideshow-card");
  if (!card) return;

  const index = Number(card.dataset.cardIndex);
  if (!Number.isInteger(index) || index === state.order[0]) return;

  stopAutoCycle();
  await waitUntilIdle();

  const stepsNeeded = state.order.indexOf(index);
  if (stepsNeeded <= 0) {
    scheduleAutoResume();
    return;
  }

  for (let i = 0; i < stepsNeeded; i += 1) {
    await runStep(false);
  }

  scheduleAutoResume();
};

const handleResize = async () => {
  if (!destinations.length) return;
  await waitUntilIdle();

  computePreviewOffsets(state.order.length - 1);
  const [active, ...rest] = state.order;

  gsap.set(getCard(active), {
    x: 0,
    y: 0,
    width: window.innerWidth,
    height: window.innerHeight,
    borderRadius: 0,
  });
  gsap.set(getCardContent(active), { x: 0, y: 0, opacity: 0 });

  rest.forEach((index, position) => {
    const xTarget =
      state.offsetLeft + position * (state.cardWidth + state.gap);

    gsap.set(getCard(index), {
      x: xTarget,
      y: state.offsetTop,
      width: state.cardWidth,
      height: state.cardHeight,
      zIndex: 30,
      borderRadius: 16,
    });

    gsap.set(getCardContent(index), {
      x: xTarget,
      y: state.offsetTop + state.cardHeight - PREVIEW_CONTENT_OFFSET,
      opacity: 1,
      zIndex: 40,
    });

    gsap.set(getSliderItem(index), {
      x: (position + 1) * state.numberSize,
    });
  });

  gsap.set("#pagination", {
    top: Math.max(state.offsetTop - 90, PREVIEW_MARGIN),
    left: state.offsetLeft,
  });

  gsap.set(".indicator", { x: -window.innerWidth });
};

const normalizeImageSrc = (src) => {
  if (!src) return src;
  // fix common typo .ipg -> .jpg
  if (src.endsWith('.ipg')) return src.replace(/\.ipg$/i, '.jpg');
  return src;
};

const loadImage = (src, tried = false) =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => {
      if (!tried) {
        const corrected = normalizeImageSrc(src);
        if (corrected !== src) {
          // try corrected filename once
          loadImage(corrected, true).then(resolve).catch(reject);
          return;
        }
      }
      reject(new Error(`Failed to load image: ${src}`));
    };
    img.src = src;
  });

const loadImages = async () => {
  const results = await Promise.allSettled(destinations.map(({ image }) => loadImage(image)));
  const failed = results.filter((r) => r.status === "rejected").length;
  if (failed > 0) {
    console.warn(`Some images failed to load: ${failed}`);
  }
  return results;
};

const applyImageOrientations = () => {
  document.querySelectorAll('.slideshow-card-media').forEach((img) => {
    try {
      const w = img.naturalWidth || img.width || 0;
      const h = img.naturalHeight || img.height || 0;
      if (!w || !h) return;
      if (h > w) {
        img.classList.add('orient-portrait');
        img.classList.remove('orient-landscape');
      } else {
        img.classList.add('orient-landscape');
        img.classList.remove('orient-portrait');
      }
    } catch (e) {
      // ignore
    }
  });
};

const fetchDestinations = async () => {
  // append timestamp to avoid stale caching when editing the JSON
  const response = await fetch(`data/destinations.json?ts=${Date.now()}`);
  if (!response.ok) {
    throw new Error("Không thể tải d��� liệu slideshow");
  }

  const payload = await response.json();
  if (!Array.isArray(payload.destinations)) {
    throw new Error("Định dạng dữ liệu không hợp lệ");
  }

  destinations = payload.destinations.map((destination) => ({
    ...destination,
    image: resolveImagePath(destination.image),
  }));
};

function init() {
  const [active, ...rest] = state.order;
  const detailsActive = state.detailsEven ? "#details-even" : "#details-odd";
  const detailsInactive = state.detailsEven ? "#details-odd" : "#details-even";
  const { innerHeight: height, innerWidth: width } = window;

  computePreviewOffsets(rest.length);

  gsap.set("#pagination", {
    top: Math.max(state.offsetTop - 90, PREVIEW_MARGIN),
    left: state.offsetLeft,
    y: 120,
    opacity: 0,
    zIndex: 60,
  });

  gsap.set(getCard(active), {
    x: 0,
    y: 0,
    width: width,
    height: height,
  });
  gsap.set(getCardContent(active), { x: 0, y: 0, opacity: 0 });
  gsap.set(detailsActive, { opacity: 0, zIndex: 22, x: -200 });
  gsap.set(detailsInactive, { opacity: 0, zIndex: 12 });
  gsap.set(`${detailsInactive} .location-text`, { y: 100 });
  gsap.set(`${detailsInactive} .title-line--primary`, { y: 100 });
  gsap.set(`${detailsInactive} .title-line--secondary`, { y: 100 });
  gsap.set(`${detailsInactive} .description`, { y: 50 });
  gsap.set(`${detailsInactive} .action-row`, { y: 60 });

  gsap.set(".progress-fill", {
    width: (getTrackWidth() / state.order.length) * (active + 1),
  });

  rest.forEach((index, position) => {
    const initialX =
      state.offsetLeft + (position + 2) * (state.cardWidth + state.gap);

    gsap.set(getCard(index), {
      x: initialX,
      y: state.offsetTop + 60,
      width: state.cardWidth,
      height: state.cardHeight,
      zIndex: 30,
      borderRadius: 16,
    });

    gsap.set(getCardContent(index), {
      x: initialX,
      zIndex: 40,
      y: state.offsetTop + state.cardHeight - PREVIEW_CONTENT_OFFSET,
      opacity: 1,
    });

    gsap.set(getSliderItem(index), { x: (position + 1) * state.numberSize });
  });

  gsap.set(".indicator", { x: -width });
  updateActiveCardClass();

  const startDelay = 0.6;

  gsap.to(".cover", {
    x: width + 400,
    delay: 0.5,
    ease,
    onComplete: () => {
      setTimeout(() => {
        state.autoActive = true;
        loop();
      }, 500);
    },
  });

  rest.forEach((index, position) => {
    const xTarget =
      state.offsetLeft + position * (state.cardWidth + state.gap);

    gsap.to(getCard(index), {
      x: xTarget,
      y: state.offsetTop,
      zIndex: 30,
      ease,
      delay: startDelay + 0.05 * position,
    });

    gsap.to(getCardContent(index), {
      x: xTarget,
      zIndex: 40,
      ease,
      delay: startDelay + 0.05 * position,
    });
  });

  gsap.to("#pagination", { y: 0, opacity: 1, ease, delay: startDelay });
  gsap.to(detailsActive, { opacity: 1, x: 0, ease, delay: startDelay });
}

const attachEventListeners = () => {
  cardStage.addEventListener("click", handleCardClick);
  window.addEventListener("resize", handleResize);

  const pauseBtn = document.querySelector('.pause-button');
  if (pauseBtn) {
    // set initial icon
    pauseBtn.innerHTML = PAUSE_SVG;
    pauseBtn.addEventListener('click', () => {
      if (state.autoActive) {
        stopAutoCycle();
        pauseBtn.classList.add('paused');
        pauseBtn.setAttribute('aria-pressed', 'true');
        pauseBtn.innerHTML = PLAY_SVG;
      } else {
        state.autoActive = true;
        pauseBtn.classList.remove('paused');
        pauseBtn.setAttribute('aria-pressed', 'false');
        pauseBtn.innerHTML = PAUSE_SVG;
        loop();
      }
    });
  }
};

// Zoom / pan support for images (desktop and mobile)
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

const resetImageTransform = (img) => {
  img.style.transition = '';
  img.style.transform = '';
  img.dataset.scale = '1';
  img.dataset.tx = '0';
  img.dataset.ty = '0';
};

const enableZoomOnImage = (img) => {
  if (!img) return;
  img.style.touchAction = 'none';
  img.dataset.scale = img.dataset.scale || '1';
  img.dataset.tx = img.dataset.tx || '0';
  img.dataset.ty = img.dataset.ty || '0';

  let pointerDown = false;
  let lastX = 0;
  let lastY = 0;
  let isPanning = false;

  // wheel zoom (desktop)
  const onWheel = (e) => {
    if (!e.ctrlKey && !e.metaKey) e.preventDefault();
    const delta = -e.deltaY;
    const cur = parseFloat(img.dataset.scale) || 1;
    const factor = 1 + (delta > 0 ? 0.08 : -0.08);
    const next = clamp(cur * factor, 1, 3);
    img.dataset.scale = String(next);
    img.style.transform = `translate(${img.dataset.tx}px, ${img.dataset.ty}px) scale(${next})`;
  };

  // pointer events for pan
  const onPointerDown = (e) => {
    pointerDown = true;
    lastX = e.clientX;
    lastY = e.clientY;
    img.setPointerCapture && img.setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e) => {
    if (!pointerDown) return;
    const curScale = parseFloat(img.dataset.scale) || 1;
    if (curScale <= 1) return;
    isPanning = true;
    const dx = e.clientX - lastX;
    const dy = e.clientY - lastY;
    lastX = e.clientX;
    lastY = e.clientY;
    const tx = clamp(parseFloat(img.dataset.tx) + dx, -img.offsetWidth * (curScale - 1), img.offsetWidth * (curScale - 1));
    const ty = clamp(parseFloat(img.dataset.ty) + dy, -img.offsetHeight * (curScale - 1), img.offsetHeight * (curScale - 1));
    img.dataset.tx = String(tx);
    img.dataset.ty = String(ty);
    img.style.transform = `translate(${tx}px, ${ty}px) scale(${curScale})`;
  };
  const onPointerUp = (e) => {
    pointerDown = false;
    if (isPanning) {
      isPanning = false;
    }
    try { img.releasePointerCapture && img.releasePointerCapture(e.pointerId); } catch (err) {}
  };

  // touch pinch
  let touchStartDist = 0;
  let initialScale = 1;
  const getDist = (t0, t1) => Math.hypot(t1.clientX - t0.clientX, t1.clientY - t0.clientY);
  const onTouchStart = (e) => {
    if (e.touches && e.touches.length === 2) {
      touchStartDist = getDist(e.touches[0], e.touches[1]);
      initialScale = parseFloat(img.dataset.scale) || 1;
    }
  };
  const onTouchMove = (e) => {
    if (e.touches && e.touches.length === 2) {
      e.preventDefault();
      const d = getDist(e.touches[0], e.touches[1]);
      const ratio = d / (touchStartDist || d);
      const next = clamp(initialScale * ratio, 1, 3);
      img.dataset.scale = String(next);
      img.style.transform = `translate(${img.dataset.tx}px, ${img.dataset.ty}px) scale(${next})`;
    }
  };

  const onDblClick = (e) => {
    const cur = parseFloat(img.dataset.scale) || 1;
    const next = cur > 1 ? 1 : 2;
    img.dataset.scale = String(next);
    img.dataset.tx = '0';
    img.dataset.ty = '0';
    img.style.transform = `translate(0px, 0px) scale(${next})`;
  };

  img.addEventListener('wheel', onWheel, { passive: false });
  img.addEventListener('pointerdown', onPointerDown);
  window.addEventListener('pointermove', onPointerMove);
  window.addEventListener('pointerup', onPointerUp);
  img.addEventListener('touchstart', onTouchStart, { passive: false });
  img.addEventListener('touchmove', onTouchMove, { passive: false });
  img.addEventListener('dblclick', onDblClick);

  // reset transforms when image is re-rendered or changed
  img.addEventListener('load', () => resetImageTransform(img));
};

const enableZoomForAll = () => {
  document.querySelectorAll('.slideshow-card-media').forEach((img) => enableZoomOnImage(img));
};

const resetAllImageTransforms = () => {
  document.querySelectorAll('.slideshow-card-media').forEach((img) => resetImageTransform(img));
};

const start = async () => {
  try {
    await fetchDestinations();
    if (!destinations.length) return;

    renderSlides();
    state.order = destinations.map((_, index) => index);
    setInitialDetails();
    updateActiveCardClass();
    attachEventListeners();
    await loadImages();
    applyImageOrientations();
    enableZoomForAll();
    init();
  } catch (error) {
    console.error('Start error:', error && error.message ? error.message : error, error);
  }
};

start();
