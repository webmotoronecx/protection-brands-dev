/*
  Protection Brands 3D hero bottle: <pb-hero-bottle>, rendered by sections/pb-hero-bottle.liquid.

  One or two bottles float with their labels facing out. They drift, turn and tilt towards
  the mouse, and lift as the hero scrolls away; they don't spin on their own. The headings
  follow the mouse slightly and the scrolling wordmark drifts the other way. Each bottle is
  built in code from a profile measured from its product photo (MODELS); the label artwork
  wraps all the way round, front facing out. The first is the clear Detailing Spray bottle
  with liquid inside; the second is the same, or the white Permagard Car Wash Shampoo bottle
  (data-model-second).

  Performance (see .claude/skills/animation-perf):
  - Three.js (~170 KB gzip) is imported only after the page has loaded and gone idle.
  - The canvas starts transparent and fades in after its first frame; nothing on screen is hidden.
  - Frames run on GSAP's ticker when GSAP is on the page, otherwise on one requestAnimationFrame
    loop, and only while the hero is on screen and the tab is visible.
  - Pixel ratio is capped. Only the canvas changes each frame; no layout properties are touched.
  - Reduced motion: the still image stays if there is one; otherwise one static frame is drawn.
  - No WebGL: the still image stays.
*/

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const coarsePointer = window.matchMedia('(pointer: coarse)');

/* Bottle geometry, in units of the body radius, heights from the base. Measured from the
   500 ml product photo: body 370 px wide, 1,170 px from base to cap top. */
const SHELL = [
  [0, 0], [0.6, 0], [0.8, 0.03], [0.9, 0.06], [0.95, 0.1], [0.98, 0.17], [1, 0.25],
  [1, 5.22], [0.97, 5.27], [0.92, 5.32], [0.79, 5.38], [0.68, 5.43], [0.57, 5.49],
  [0.47, 5.53], [0.41, 5.56], [0.4, 5.66],
];
const LIQUID = [
  [0, 0.04], [0.58, 0.04], [0.85, 0.08], [0.94, 0.14], [0.97, 0.27], [0.97, 5.2],
  [0.93, 5.26], [0.86, 5.3], [0, 5.3],
];
const CAP = [[0, 5.62], [0.455, 5.62], [0.455, 6.18], [0.42, 6.24], [0.28, 6.27], [0, 6.27]];
const CAP_RIBS = { bottom: 5.66, top: 6.14, radius: 0.43 };
const LABEL = { bottom: 0.52, top: 4.98 };

/* Permagard Car Wash Shampoo (236 ml), measured from its product photo the same way (body
   483 px wide, 1,612 px from base to cap top): opaque white plastic, a glossy black label
   from just above the base to the shoulder, and a ribbed black flat-top cap. Scaled to the
   Detailing Spray's height so the two balance in the hero. */
const PERMAGARD = {
  shell: [
    [0, 0], [0.53, 0.02], [0.67, 0.05], [0.77, 0.07], [0.87, 0.12], [0.92, 0.17], [0.96, 0.22],
    [0.98, 0.27], [0.995, 0.35], [1, 0.45], [1, 5.55], [0.994, 5.64], [0.983, 5.72],
    [0.961, 5.76], [0.882, 5.81], [0.716, 5.85], [0.542, 5.89], [0.53, 5.95],
  ],
  cap: [[0, 5.93], [0.522, 5.93], [0.522, 6.6], [0.49, 6.64], [0.4, 6.665], [0, 6.675]],
  capRibs: { bottom: 6.02, top: 6.58, radius: 0.5, count: 90 },
  // turn: radians the artwork is turned round the bottle, to centre it in the hero's pose.
  label: { bottom: 0.36, top: 5.54, radius: 1.004, turn: -0.1 },
  height: 6.675,
};

/* Liquid wobble: the liquid is cut by a surface that stays level in the world and sloshes
   against each bottle's acceleration (a damped spring per axis). LIQUID_LEVEL is the fill
   height from the base, up into the shoulder like the real bottle, so the surface shows
   through the clear plastic above the label.
   SLOSH: spring stiffness and damping, how strongly acceleration tips the surface, and the
   largest tilt (surface slope). */
const LIQUID_LEVEL = 5.20;

/* Sparkling liquid: small bubbles suspended in each bottle, as in a gel: they don't rise,
   they just drift slowly around where they are (one instanced draw per bottle), cut off at
   the moving surface, plus tiny glints twinkling in the liquid (shader). drift is how far a
   bubble wanders (scene units), speed how quickly (radians per second). */
const BUBBLES = { count: 90, radius: [0.025, 0.07], drift: 0.07, speed: [0.25, 0.6], spread: 0.8, bottom: 0.1 };
const SPARKLE = 1.6; // glint brightness
const SLOSH = { stiffness: 10, damping: 3.2, gain: 0.006, max: 0.6 };
const HEIGHT = 6.27;

const MODELS = {
  detailing: {
    shell: SHELL,
    liquid: LIQUID,
    cap: CAP,
    capRibs: { ...CAP_RIBS, count: 45 },
    label: { ...LABEL, radius: 1.006 },
    height: HEIGHT,
    clear: true,
  },
  permagard: { ...PERMAGARD, clear: false },
};

/* Layout of the bottles: position, resting tilt [x, y, z], float phase, and depth (how far
   the bottle moves with the mouse; the front bottle moves most, for parallax).
   Positive z tilt leans the top to the left, negative to the right. */
const LAYOUTS = {
  1: [{ position: [0, 0, 0], tilt: [0.08, 0, 0.16], phase: 0, depth: 0.8 }],
  2: [
    { position: [-0.85, 0.6, 0], tilt: [0.1, 0, 0.2], phase: 0, depth: 0.55 },
    { position: [0.85, -0.6, 0.9], tilt: [0.06, 0, -0.15], phase: 1.9, depth: 1 },
  ],
};

const FLOAT = 0.18; // float height

/* Mouse parallax, at Mouse follow 100%: bottles move towards the mouse (scene units, scaled
   by each bottle's depth), the wordmark behind moves the other way (px). */
const PARALLAX = { bottleX: 1.6, bottleY: 1, wordmarkX: 110, wordmarkY: 36 };

/* Intro: when the 3D first appears, the bottles drop in from above, the second (blue) a
   moment after the first (amber). Distances in scene units. */
const INTRO = { fall: 0.7, settle: 0.9, distance: 11, stagger: 0.18, bounce: 0.6 };
INTRO.duration = INTRO.fall + INTRO.settle;

/* Falling with a small bounce: speeds up as it falls (like gravity), dips just past its
   resting place on landing, springs back up a touch and settles. Seconds in, scene units out. */
function introDrop(seconds) {
  if (seconds <= 0) return INTRO.distance;
  if (seconds < INTRO.fall) return INTRO.distance * (1 - (seconds / INTRO.fall) ** 2);
  const after = seconds - INTRO.fall;
  return -INTRO.bounce * Math.exp(-4.5 * after) * Math.sin(13 * after);
}

/* Reflections & lighting. These defaults are the designed look; each one can be changed in
   the theme editor (Hero bottle (3D) → Reflections & lighting), which passes it in as a
   data attribute on <pb-hero-bottle>. */
const LOOK = {
  highlights: 0.5, // white studio reflections on the plastic and label
  gloss: 0.5, // clear-coat shine on the plastic, liquid and label
  keyLight: 0.5, // main light from the upper right
  rimLight: 0.25, // coloured light from behind, along the left edges
  rimColor: '#ca0d0d',
  shadow: 0.45, // darkness of the shadow behind the bottles
  shadowBlur: 24, // softness of the shadows
};

function readLook(dataset) {
  const number = (value, fallback) => (value === undefined || value === '' || isNaN(value) ? fallback : Number(value));
  return {
    highlights: number(dataset.highlights, LOOK.highlights),
    gloss: number(dataset.gloss, LOOK.gloss),
    keyLight: number(dataset.keyLight, LOOK.keyLight),
    rimLight: number(dataset.rimLight, LOOK.rimLight),
    rimColor: dataset.rimColor || LOOK.rimColor,
    shadow: number(dataset.shadow, LOOK.shadow),
    shadowBlur: number(dataset.shadowBlur, LOOK.shadowBlur),
  };
}
const DPR_CAP = coarsePointer.matches ? 1.5 : 1.75;

class PBHeroBottle extends HTMLElement {
  #abort = new AbortController();
  #disposed = false;

  connectedCallback() {
    const hasPoster = this.classList.contains('pb-hero-bottle--has-poster');
    if (reducedMotion.matches && hasPoster) return;

    // Wait until the page has shown, so Three.js never competes with first paint.
    const start = () => {
      const idle = window.requestIdleCallback || ((fn) => setTimeout(fn, 200));
      idle(() => this.#init(), { timeout: 2000 });
    };
    if (document.readyState === 'complete') start();
    else window.addEventListener('load', start, { once: true, signal: this.#abort.signal });
  }

  disconnectedCallback() {
    this.#disposed = true;
    this.#abort.abort();
    this.#stop?.();
    this.#observer?.disconnect();
    this.#resizer?.disconnect();
    this.#scene?.traverse((object) => {
      object.geometry?.dispose();
      object.material?.map?.dispose();
      object.material?.dispose();
    });
    this.#environment?.dispose();
    this.#renderer?.dispose();
  }

  #renderer;
  #scene;
  #camera;
  #environment;
  #observer;
  #resizer;
  #stop;
  #bottles = [];
  #THREE;
  #surfacePoint;
  #pointer = { x: 0, y: 0, targetX: 0, targetY: 0, clientX: -1, clientY: -1, moved: false };
  #hovered = -1; // index of the bottle under the mouse, -1 for none
  #raycaster;
  #ndc;
  #marquee;
  #texts = [];
  #last = 0;
  #introStart = 0; // seconds (performance.now), 0 once the intro has finished
  #clock = 0; // seconds of animation so far; the float starts from the still image's pose

  async #init() {
    if (this.#disposed) return;

    let THREE;
    try {
      THREE = await import(this.dataset.three);
      this.#THREE = THREE;
      this.#surfacePoint = new THREE.Vector3();
      this.#raycaster = new THREE.Raycaster();
      this.#ndc = new THREE.Vector2();
    } catch {
      return; // Keep the still image.
    }
    if (this.#disposed) return;

    const canvas = this.querySelector('canvas');
    try {
      this.#renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
    } catch {
      return; // No WebGL: keep the still image.
    }

    const renderer = this.#renderer;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, DPR_CAP));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    // Soft shadows: the front bottle shades the one behind, and both cast onto a
    // see-through backdrop for a layered look.
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.VSMShadowMap;

    const look = readLook(this.dataset);
    this.#marquee = this.querySelector('.pb-hero-bottle__marquee');
    this.#texts = [...this.querySelectorAll('.pb-hero-bottle__text')];

    this.#scene = new THREE.Scene();
    this.#environment = studioEnvironment(THREE, renderer);
    this.#scene.environment = this.#environment;
    this.#scene.environmentIntensity = look.highlights;

    this.#camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
    this.#addLights(THREE, look);

    // The first bottle is always the Detailing Spray; the second can be the Permagard bottle,
    // with its own label.
    const layout = LAYOUTS[this.dataset.bottles] || LAYOUTS[2];
    const models = layout.map((spec, index) =>
      index === 1 && MODELS[this.dataset.modelSecond] ? this.dataset.modelSecond : 'detailing'
    );
    const labelUrls = models.map((model, index) => (index === 1 ? this.dataset.labelSecond || this.dataset.label : this.dataset.label));
    const labels = await Promise.all(
      [...new Set(labelUrls)].map((url) => loadTexture(THREE, url).then((texture) => [url, texture]).catch(() => [url, null]))
    ).then((entries) => new Map(entries));
    if (this.#disposed) return;
    for (const texture of labels.values()) if (texture) texture.anisotropy = renderer.capabilities.getMaxAnisotropy();

    // Each bottle can have its own liquid colour (the second is the car care bottle).
    const liquids = [this.dataset.liquid || '#b5650e', this.dataset.liquidSecond || this.dataset.liquid || '#b5650e'];
    const geometries = new Map([...new Set(models)].map((name) => [name, bottleGeometries(THREE, MODELS[name])]));

    const sparkling = this.dataset.sparkle !== 'false';
    layout.forEach((spec, index) => {
      const model = MODELS[models[index]];
      // The second (car care) bottle can have a gel finish: clearer, glossier, a faint shimmer.
      const finish = index === 1 ? this.dataset.finishSecond || 'gel' : 'liquid';
      const materials = model.clear
        ? bottleMaterials(THREE, labels.get(labelUrls[index]), liquids[index], look.gloss, finish)
        : opaqueBottleMaterials(THREE, labels.get(labelUrls[index]), look.gloss);
      const group = new THREE.Group();
      for (const [name, geometry] of Object.entries(geometries.get(models[index]))) {
        const mesh = new THREE.Mesh(geometry, materials[name]);
        mesh.renderOrder = model.clear && name === 'shell' ? 2 : name === 'label' ? 1 : 0;
        mesh.castShadow = true;
        mesh.receiveShadow = !model.clear || name !== 'shell';
        mesh.position.y = -HEIGHT / 2;
        group.add(mesh);
      }
      group.position.set(...spec.position);
      group.rotation.set(...spec.tilt);
      this.#scene.add(group);
      // Liquid (and its sparkle) only in the clear bottle.
      const surface = materials.liquid?.userData.surface || null;
      if (surface) surface.pbSparkle.value = sparkling ? SPARKLE : 0;
      let fizz = null;
      if (surface && sparkling) {
        fizz = makeBubbles(THREE, surface);
        group.add(fizz.mesh);
        updateBubbles(fizz, 0, 0);
      }

      this.#bottles.push({
        fizz,
        group,
        spec,
        surface,
        slosh: { x: 0, vx: 0, z: 0, vz: 0, px: null, py: 0, pz: 0, ry: 0, speedX: 0, speedY: 0, speedZ: 0 },
      });
    });

    this.#resize();
    this.#resizer = new ResizeObserver(() => this.#resize());
    this.#resizer.observe(this);

    if (reducedMotion.matches) {
      this.#render(0);
      this.classList.add('is-ready');
      return;
    }

    const hasPoster = this.classList.contains('pb-hero-bottle--has-poster');
    if (!hasPoster) this.#introStart = performance.now() / 1000;
    this.#render(0);

    if (hasPoster) {
      // The still did the entrance. Swap to the 3D only once its drop-in has finished, and in
      // a single frame (no crossfade): the 3D is drawn in the still's exact pose, so the two
      // never show together. Float and mouse-follow start after the swap.
      const posters = [...this.querySelectorAll('.pb-hero-bottle__poster')];
      const animations = posters.flatMap((poster) => poster.getAnimations());
      await Promise.all(animations.map((animation) => animation.finished.catch(() => {})));
      if (this.#disposed) return;
      this.#render(0);
    }

    this.classList.add('is-ready');
    this.#listen();
  }

  #addLights(THREE, look) {
    const key = new THREE.DirectionalLight(0xffffff, 1.4 * look.keyLight);
    key.position.set(4, 6, 8);
    // Rim light from behind, picks out the edges against the dark background.
    const rim = new THREE.DirectionalLight(new THREE.Color(look.rimColor), look.rimLight);
    rim.position.set(-6, 3, -6);
    const fill = new THREE.DirectionalLight(0xffffff, 0.5);
    fill.position.set(-5, -2, 6);
    this.#scene.add(key, rim, fill);

    // Shadow light: from the upper right, in front, so shadows fall down and to the left.
    const shadowLight = new THREE.DirectionalLight(0xffffff, 0.01);
    shadowLight.position.set(3, 3, 10);
    shadowLight.castShadow = true;
    const shadow = shadowLight.shadow;
    shadow.mapSize.set(512, 512); // lower resolution = softer and cheaper
    shadow.radius = look.shadowBlur;
    shadow.blurSamples = 24;
    shadow.bias = -0.0005;
    Object.assign(shadow.camera, { left: -8, right: 8, top: 8, bottom: -8, near: 1, far: 30 });
    this.#scene.add(shadowLight);

    // Backdrop: invisible except for the shadow that falls on it.
    const backdrop = new THREE.Mesh(
      new THREE.PlaneGeometry(60, 60),
      new THREE.ShadowMaterial({ color: 0x000000, opacity: look.shadow })
    );
    backdrop.position.z = -2.5;
    backdrop.receiveShadow = true;
    this.#scene.add(backdrop);
  }

  #resize() {
    const width = this.clientWidth;
    const height = this.clientHeight;
    if (!width || !height) return;
    this.#renderer.setSize(width, height, false);

    // Fit the bottles: by height on wide screens, by width on narrow ones.
    const camera = this.#camera;
    const two = this.#bottles.length > 1;
    const needHeight = two ? 11.5 : 9.5;
    const needWidth = two ? 6.5 : 5;
    const tan = Math.tan(THREE_DEG(camera.fov / 2));
    camera.aspect = width / height;
    // Bottle size setting: 1 = fit, larger moves the camera closer.
    const size = Number(this.dataset.size || 1);
    const distance = Math.max(needHeight / 2 / tan, needWidth / 2 / (tan * camera.aspect));
    camera.position.set(0, 0, distance / size);
    camera.lookAt(0, 0, 0);
    camera.updateProjectionMatrix();
    if (reducedMotion.matches) this.#render(0);
  }

  #listen() {
    const { signal } = this.#abort;
    const pointer = this.#pointer;
    const strength = Number(this.dataset.strength ?? 0.6);

    if (!coarsePointer.matches) {
      window.addEventListener(
        'pointermove',
        (event) => {
          pointer.targetX = (event.clientX / window.innerWidth) * 2 - 1;
          pointer.targetY = (event.clientY / window.innerHeight) * 2 - 1;
          pointer.clientX = event.clientX;
          pointer.clientY = event.clientY;
          pointer.moved = true;
        },
        { passive: true, signal }
      );

      // Clicking a bottle goes where its heading's Shop now button goes.
      this.addEventListener(
        'click',
        (event) => {
          if (this.#hovered < 0 || event.target.closest('a, button')) return;
          const href = this.#texts[this.#hovered]?.querySelector('a')?.href;
          if (href) window.location.href = href;
        },
        { signal }
      );
    }

    // Run frames only while the hero is on screen and the tab is visible.
    let onScreen = false;
    // Also paused while the floating menu (assets/pb-menu.js) covers the page.
    const update = () =>
      onScreen && !document.hidden && !document.documentElement.hasAttribute('data-pb-menu-open')
        ? this.#start()
        : this.#stop?.();
    this.#observer = new IntersectionObserver(([entry]) => {
      onScreen = entry.isIntersecting;
      update();
    });
    this.#observer.observe(this);
    document.addEventListener('visibilitychange', update, { signal });
    document.addEventListener('pb:menu', update, { signal });

    reducedMotion.addEventListener(
      'change',
      () => {
        if (!reducedMotion.matches) return;
        this.#observer.disconnect();
        this.#stop?.();
      },
      { signal }
    );
  }

  /* Which bottle is under the mouse: one ray from the camera through the pointer, checked
     only when the pointer has moved. Bottle 1 (amber) goes with the first heading, bottle 2
     (blue) with the second: the matching heading and its Shop now button react (CSS). */
  #updateHover(rect) {
    const { clientX, clientY } = this.#pointer;
    let hovered = -1;
    const inside = clientX >= rect.left && clientX <= rect.right && clientY >= rect.top && clientY <= rect.bottom;
    if (inside && this.#bottles.length) {
      this.#ndc.set(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1);
      this.#raycaster.setFromCamera(this.#ndc, this.#camera);
      const hit = this.#raycaster.intersectObjects(
        this.#bottles.map(({ group }) => group),
        true
      )[0];
      if (hit) hovered = this.#bottles.findIndex(({ group }) => group === hit.object.parent);
    }
    if (hovered === this.#hovered) return;

    this.#hovered = hovered;
    if (hovered < 0) delete this.dataset.hover;
    else this.dataset.hover = String(hovered + 1);
    this.#texts.forEach((text, index) => text.classList.toggle('is-active', index === hovered));
    this.style.cursor = hovered < 0 ? '' : 'pointer';
  }

  /* Keeps each bottle's liquid surface level in the world and sloshes it against the
     bottle's acceleration. */
  #updateLiquids(dt) {
    const wobble = this.dataset.wobble !== 'false' && !reducedMotion.matches;
    const point = this.#surfacePoint;

    for (const { group, surface, slosh, fizz } of this.#bottles) {
      if (fizz) updateBubbles(fizz, reducedMotion.matches ? 0 : dt, this.#clock);
      if (surface) surface.pbTime.value = this.#clock;
      if (!surface) continue;
      const { x, y, z } = group.position;

      if (wobble && dt > 0 && slosh.px !== null) {
        const speedX = (x - slosh.px) / dt;
        const speedY = (y - slosh.py) / dt;
        const speedZ = (z - slosh.pz) / dt;
        const turn = (group.rotation.y - slosh.ry) / dt;
        // Acceleration tips the surface; a landing jolt (vertical) and turning add a little.
        const pushX = ((speedX - slosh.speedX) / dt) * SLOSH.gain + ((speedY - slosh.speedY) / dt) * SLOSH.gain * 0.25;
        const pushZ = ((speedZ - slosh.speedZ) / dt) * SLOSH.gain + turn * 0.04;
        const targetX = Math.min(Math.max(pushX, -SLOSH.max), SLOSH.max);
        const targetZ = Math.min(Math.max(pushZ, -SLOSH.max), SLOSH.max);

        slosh.vx += (SLOSH.stiffness * (targetX - slosh.x) - SLOSH.damping * slosh.vx) * dt;
        slosh.vz += (SLOSH.stiffness * (targetZ - slosh.z) - SLOSH.damping * slosh.vz) * dt;
        slosh.x = Math.min(Math.max(slosh.x + slosh.vx * dt, -SLOSH.max), SLOSH.max);
        slosh.z = Math.min(Math.max(slosh.z + slosh.vz * dt, -SLOSH.max), SLOSH.max);
        slosh.speedX = speedX;
        slosh.speedY = speedY;
        slosh.speedZ = speedZ;
      }
      slosh.px = x;
      slosh.py = y;
      slosh.pz = z;
      slosh.ry = group.rotation.y;

      group.updateMatrixWorld();
      point.set(0, LIQUID_LEVEL - HEIGHT / 2, 0);
      surface.pbSurfacePoint.value.copy(group.localToWorld(point));
      surface.pbSurfaceNormal.value.set(slosh.x, 1, slosh.z).normalize();
    }
  }

  #start() {
    if (this.#stop) return;
    this.#last = performance.now() / 1000;
    const gsap = window.gsap;
    if (gsap) {
      const tick = (time) => this.#render(time);
      gsap.ticker.add(tick);
      this.#stop = () => {
        gsap.ticker.remove(tick);
        this.#stop = undefined;
      };
    } else {
      let frame;
      const loop = (ms) => {
        this.#render(ms / 1000);
        frame = requestAnimationFrame(loop);
      };
      frame = requestAnimationFrame(loop);
      this.#stop = () => {
        cancelAnimationFrame(frame);
        this.#stop = undefined;
      };
    }
  }

  #render(time) {
    const dt = Math.min(Math.max(time - this.#last, 0), 0.05);
    this.#last = time;
    this.#clock += dt;

    const pointer = this.#pointer;
    const strength = Number(this.dataset.strength ?? 0.6);
    const ease = 1 - Math.exp(-dt * 4);
    pointer.x += (pointer.targetX - pointer.x) * ease;
    pointer.y += (pointer.targetY - pointer.y) * ease;

    // 0 when the hero's top is at the top of the screen, 1 when it has scrolled fully away.
    const rect = this.getBoundingClientRect();
    const scrolled = Math.min(Math.max(-rect.top / rect.height, 0), 1);

    // Intro offset per bottle: falls from INTRO.distance above, bounces a little, settles.
    const now = performance.now() / 1000;
    const introOffset = (index) => {
      if (!this.#introStart) return 0;
      return introDrop(now - this.#introStart - index * INTRO.stagger);
    };

    this.#bottles.forEach(({ group, spec }, index) => {
      // The bottle under the mouse grows a little.
      const scale = group.scale.x + ((index === this.#hovered ? 1.05 : 1) - group.scale.x) * ease * 2;
      group.scale.setScalar(scale);
      group.rotation.x = spec.tilt[0] + pointer.y * 0.35 * strength;
      group.rotation.y = spec.tilt[1] + pointer.x * 0.8 * strength;
      group.rotation.z = spec.tilt[2] - pointer.x * 0.2 * strength;
      // Drift towards the mouse; the front bottle moves further than the one behind.
      group.position.x = spec.position[0] + pointer.x * PARALLAX.bottleX * spec.depth * strength;
      group.position.y =
        spec.position[1] -
        pointer.y * PARALLAX.bottleY * spec.depth * strength +
        Math.sin(this.#clock * 1.1 + spec.phase) * FLOAT +
        scrolled * 3 +
        introOffset(index);
    });

    this.#updateLiquids(dt);
    if (pointer.moved) {
      pointer.moved = false;
      this.#updateHover(rect);
    }

    if (this.#introStart && now - this.#introStart > INTRO.duration + INTRO.stagger * this.#bottles.length) {
      this.#introStart = 0;
    }

    // The scrolling wordmark drifts the other way, so it reads as a layer further back.
    if (this.#marquee) {
      const x = -pointer.x * PARALLAX.wordmarkX * strength;
      const y = -pointer.y * PARALLAX.wordmarkY * strength;
      this.#marquee.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`;
    }

    // Headings and buttons, the front layer, follow the mouse a little (kept small so the
    // text stays easy to read and the buttons easy to hit).
    if (this.#texts.length) {
      const x = pointer.x * 26 * strength;
      const y = pointer.y * 16 * strength;
      const transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`;
      for (const text of this.#texts) text.style.transform = transform;
    }

    this.#renderer.render(this.#scene, this.#camera);
  }
}

const THREE_DEG = (degrees) => (degrees * Math.PI) / 180;

function loadTexture(THREE, url) {
  const loader = new THREE.TextureLoader();
  loader.setCrossOrigin('anonymous');
  return loader.loadAsync(url).then((texture) => {
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  });
}

function lathe(THREE, points, segments) {
  return new THREE.LatheGeometry(
    points.map(([r, y]) => new THREE.Vector2(r, y)),
    segments
  );
}

/* Shell, cap and label (and liquid, for a clear bottle) for one model, scaled to HEIGHT. */
function bottleGeometries(THREE, model) {
  const parts = { shell: lathe(THREE, model.shell, 96) };
  if (model.liquid) parts.liquid = lathe(THREE, model.liquid, 96);

  // Cap with vertical grip ribs: push the side wall in and out around the circumference.
  const ribs = model.capRibs;
  const cap = lathe(THREE, model.cap, ribs.count * 4);
  const position = cap.attributes.position;
  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i);
    const y = position.getY(i);
    const z = position.getZ(i);
    if (y > ribs.bottom && y < ribs.top && Math.hypot(x, z) > ribs.radius) {
      const scale = 1 + 0.025 * Math.sign(Math.cos(Math.atan2(x, z) * ribs.count));
      position.setXYZ(i, x * scale, y, z * scale);
    }
  }
  cap.computeVertexNormals();
  parts.cap = cap;

  // Label: open cylinder just outside the shell, the artwork wrapped once around it.
  // thetaStart = PI puts the middle of the artwork (the front) facing the camera.
  const { bottom, top, radius, turn = 0 } = model.label;
  const label = new THREE.CylinderGeometry(radius, radius, top - bottom, 128, 1, true, Math.PI + turn);
  label.translate(0, bottom + (top - bottom) / 2, 0);
  parts.label = label;

  const scale = HEIGHT / model.height;
  if (scale !== 1) for (const geometry of Object.values(parts)) geometry.scale(scale, scale, scale);
  return parts;
}

/* Bubbles for one bottle: small spheres drawn in one go (InstancedMesh), cut off at the same
   moving surface as the liquid (shares its uniforms). Positions are bottle-local. */
function makeBubbles(THREE, surface) {
  const material = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    emissive: 0xffffff,
    emissiveIntensity: 0.01,
    roughness: 1,
    transparent: true,
    opacity: 0.2,
    depthWrite: false,
  });
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, surface);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vPbWorld;')
      .replace(
        '#include <project_vertex>',
        '#include <project_vertex>\n' +
          '#ifdef USE_INSTANCING\nvPbWorld = (modelMatrix * instanceMatrix * vec4(transformed, 1.0)).xyz;\n' +
          '#else\nvPbWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;\n#endif'
      );
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vPbWorld;\nuniform vec3 pbSurfacePoint;\nuniform vec3 pbSurfaceNormal;')
      .replace(
        '#include <clipping_planes_fragment>',
        '#include <clipping_planes_fragment>\nif (dot(vPbWorld - pbSurfacePoint, pbSurfaceNormal) > 0.0) discard;'
      );
  };

  const mesh = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 10, 8), material, BUBBLES.count);
  mesh.frustumCulled = false;
  mesh.renderOrder = 1; // after the liquid (0), before the clear plastic (2)
  const random = (min, max) => min + Math.random() * (max - min);
  const bubbles = Array.from({ length: BUBBLES.count }, () => {
    const angle = Math.random() * Math.PI * 2;
    const distance = Math.sqrt(Math.random()) * BUBBLES.spread;
    return {
      x: Math.cos(angle) * distance,
      z: Math.sin(angle) * distance,
      y: random(BUBBLES.bottom, LIQUID_LEVEL),
      radius: random(...BUBBLES.radius),
      speed: random(...BUBBLES.speed),
      phase: Math.random() * Math.PI * 2,
      phase2: Math.random() * Math.PI * 2,
    };
  });
  return { mesh, bubbles, matrix: new THREE.Matrix4() };
}

function updateBubbles(fizz, dt, time) {
  const { mesh, bubbles, matrix } = fizz;
  const { drift } = BUBBLES;
  bubbles.forEach((bubble, index) => {
    // A slow, looping wander around the bubble's home position; never rises away.
    const t = time * bubble.speed;
    const x = bubble.x + Math.sin(t + bubble.phase) * drift;
    const y = bubble.y + Math.sin(t * 0.7 + bubble.phase2) * drift * 0.8;
    const z = bubble.z + Math.cos(t * 0.85 + bubble.phase) * drift;
    matrix.makeScale(bubble.radius, bubble.radius, bubble.radius);
    matrix.setPosition(x, y - HEIGHT / 2, z);
    mesh.setMatrixAt(index, matrix);
  });
  mesh.instanceMatrix.needsUpdate = true;
}

/* Cuts the liquid at a surface plane given in world space (point + normal, set every frame
   by #updateLiquids), and shades the inside faces that show through the cut as the surface. */
function addLiquidSurface(THREE, material, colour, tint = 0.25, rim = 0) {
  const uniforms = {
    pbSurfacePoint: { value: new THREE.Vector3() },
    pbSurfaceNormal: { value: new THREE.Vector3(0, 1, 0) },
    pbSurfaceColour: { value: colour.clone().lerp(new THREE.Color(0xffffff), tint) },
    pbRim: { value: rim },
    pbRimColour: { value: colour.clone().lerp(new THREE.Color(0xffffff), 0.5) },
    pbTime: { value: 0 },
    pbSparkle: { value: 0 },
  };
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vPbWorld;\nvarying vec3 vPbLocal;')
      .replace(
        '#include <project_vertex>',
        '#include <project_vertex>\nvPbWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;\nvPbLocal = transformed;'
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        '#include <common>\nvarying vec3 vPbWorld;\nvarying vec3 vPbLocal;\nuniform vec3 pbSurfacePoint;\nuniform vec3 pbSurfaceNormal;\nuniform vec3 pbSurfaceColour;\nuniform float pbRim;\nuniform vec3 pbRimColour;\nuniform float pbTime;\nuniform float pbSparkle;'
      )
      .replace(
        '#include <clipping_planes_fragment>',
        '#include <clipping_planes_fragment>\nif (dot(vPbWorld - pbSurfacePoint, pbSurfaceNormal) > 0.0) discard;'
      )
      .replace(
        '#include <dithering_fragment>',
        '#include <dithering_fragment>\n' +
          // Rim glow: brighter where the surface turns away from the viewer (gel finish).
          'float pbFacing = abs(dot(normalize(normal), normalize(vViewPosition)));\n' +
          'gl_FragColor.rgb += pbRimColour * pbRim * pow(1.0 - pbFacing, 2.5);\n' +
          // Sparkle: a few cells of a 3D grid hold a tiny glint that twinkles on and off.
          'vec3 pbCellPos = vPbLocal * 11.0;\n' +
          'vec3 pbCell = floor(pbCellPos);\n' +
          'float pbHash = fract(sin(dot(pbCell, vec3(12.9898, 78.233, 37.719))) * 43758.5453);\n' +
          'float pbTwinkle = pow(max(0.0, sin(pbTime * 2.6 + pbHash * 60.0)), 18.0);\n' +
          'float pbDot = smoothstep(0.2, 0.0, length(fract(pbCellPos) - 0.5));\n' +
          'gl_FragColor.rgb += vec3(pbSparkle * pbDot * pbTwinkle * step(0.7, pbHash));\n' +
          'if (!gl_FrontFacing) gl_FragColor.rgb = mix(gl_FragColor.rgb, pbSurfaceColour, 0.55);'
      );
  };
  return uniforms;
}

/* Liquid looks. Gel: a little see-through, glass-smooth clear coat, bright highlights, a
   faint iridescent shimmer, and edges that glow (rim) the way light catches gelatin. */
const LIQUID_FINISHES = {
  liquid: {
    opacity: 0.92,
    emissiveIntensity: 0.28,
    roughness: 0.08,
    clearcoatRoughness: 0.04,
    surfaceTint: 0.25,
    rim: 0,
  },
  gel: {
    opacity: 0.8,
    emissiveIntensity: 0.34,
    roughness: 0.02,
    clearcoatRoughness: 0.01,
    specularIntensity: 1,
    iridescence: 0.35,
    iridescenceIOR: 1.3,
    surfaceTint: 0.4,
    rim: 0.75,
  },
};

function bottleMaterials(THREE, labelTexture, liquidColour, gloss, finish = 'liquid') {
  const liquid = new THREE.Color(liquidColour);
  // Glossy amber: a little self-glow so it reads as lit-through liquid, not paint. Both sides
  // are drawn: the inside faces showing through the cut become the liquid's top surface.
  const { surfaceTint, rim, ...look } = LIQUID_FINISHES[finish] || LIQUID_FINISHES.liquid;
  const liquidMaterial = new THREE.MeshPhysicalMaterial({
    color: liquid,
    emissive: liquid,
    clearcoat: gloss,
    transparent: true,
    side: THREE.DoubleSide,
    depthWrite: false, // so the bubbles inside show through the liquid's front face
    ...look,
  });
  liquidMaterial.userData.surface = addLiquidSurface(THREE, liquidMaterial, liquid, surfaceTint, rim);

  return {
    liquid: liquidMaterial,
    label: new THREE.MeshPhysicalMaterial({
      color: labelTexture ? 0xffffff : 0x111111,
      map: labelTexture,
      roughness: 0.42,
      clearcoat: 0.2 * gloss,
      clearcoatRoughness: 0.3,
    }),
    cap: new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.55 }),
    shell: new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      roughness: 0.06,
      transparent: true,
      opacity: 0.16,
      clearcoat: gloss,
      clearcoatRoughness: 0.05,
      depthWrite: false,
    }),
  };
}

/* An opaque bottle (Permagard): glossy white plastic, a high-gloss black label wrap and a
   matt black cap. No liquid. */
function opaqueBottleMaterials(THREE, labelTexture, gloss) {
  return {
    shell: new THREE.MeshPhysicalMaterial({
      color: 0xe6e8eb,
      roughness: 0.32,
      clearcoat: 0.6 * gloss,
      clearcoatRoughness: 0.12,
    }),
    label: new THREE.MeshPhysicalMaterial({
      color: labelTexture ? 0xffffff : 0x0d0d0f,
      map: labelTexture,
      roughness: 0.3,
      clearcoat: gloss,
      clearcoatRoughness: 0.06,
    }),
    cap: new THREE.MeshStandardMaterial({ color: 0x141414, roughness: 0.6 }),
  };
}

/* A small photo-studio environment for reflections: dark room, two tall softboxes and a
   top light. Gives the clear plastic and label the vertical highlights of a product shot. */
function studioEnvironment(THREE, renderer) {
  const room = new THREE.Scene();
  room.background = new THREE.Color(0x050505);
  const softbox = (width, height, brightness, x, y, z) => {
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(width, height),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(brightness, brightness, brightness), side: THREE.DoubleSide })
    );
    mesh.position.set(x, y, z);
    mesh.lookAt(0, 0, 0);
    room.add(mesh);
  };
  softbox(3, 14, 2.5, -6, 1, 3);
  softbox(2.5, 14, 2, 6, 1, 2);
  softbox(10, 3, 1, 0, 8, 2);

  const generator = new THREE.PMREMGenerator(renderer);
  const texture = generator.fromScene(room, 0.02).texture;
  generator.dispose();
  room.traverse((object) => {
    object.geometry?.dispose();
    object.material?.dispose();
  });
  return texture;
}

if (!customElements.get('pb-hero-bottle')) customElements.define('pb-hero-bottle', PBHeroBottle);
