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
    throw new Error("Không thể tải dữ liệu slideshow");
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
    init();
  } catch (error) {
    console.error('Start error:', error && error.message ? error.message : error, error);
  }
};

start();
