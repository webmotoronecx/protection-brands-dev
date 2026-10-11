/*
  Protection Brands 3D hero bottle: <pb-hero-bottle>, rendered by sections/pb-hero-bottle.liquid.

  One or two bottles float with their labels facing out. They turn and tilt a little towards
  the mouse, and lift as the hero scrolls away; they don't spin on their own. The bottle is
  built in code from a profile measured from the 500 ml product photo; the label artwork
  wraps all the way round, front facing out.

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
const HEIGHT = 6.27;

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

/* Reflections & lighting. These defaults are the designed look; each one can be changed in
   the theme editor (Hero bottle (3D) → Reflections & lighting), which passes it in as a
   data attribute on <pb-hero-bottle>. */
const LOOK = {
  highlights: 1, // white studio reflections on the plastic and label
  gloss: 1, // clear-coat shine on the plastic, liquid and label
  keyLight: 1, // main light from the upper right
  rimLight: 0.25, // coloured light from behind, along the left edges
  rimColor: '#c62b23',
  shadow: 0.35, // darkness of the shadow behind the bottles
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
  #pointer = { x: 0, y: 0, targetX: 0, targetY: 0 };
  #marquee;
  #last = 0;

  async #init() {
    if (this.#disposed) return;

    let THREE;
    try {
      THREE = await import(this.dataset.three);
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

    this.#scene = new THREE.Scene();
    this.#environment = studioEnvironment(THREE, renderer);
    this.#scene.environment = this.#environment;
    this.#scene.environmentIntensity = look.highlights;

    this.#camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
    this.#addLights(THREE, look);

    const label = await loadTexture(THREE, this.dataset.label).catch(() => null);
    if (this.#disposed) return;
    if (label) label.anisotropy = renderer.capabilities.getMaxAnisotropy();

    // Each bottle can have its own liquid colour (the second is the car care bottle).
    const liquids = [this.dataset.liquid || '#b5650e', this.dataset.liquidSecond || this.dataset.liquid || '#b5650e'];
    const geometries = bottleGeometries(THREE);
    const layout = LAYOUTS[this.dataset.bottles] || LAYOUTS[2];

    layout.forEach((spec, index) => {
      const materials = bottleMaterials(THREE, label, liquids[index], look.gloss);
      const group = new THREE.Group();
      for (const [name, geometry] of Object.entries(geometries)) {
        const mesh = new THREE.Mesh(geometry, materials[name]);
        mesh.renderOrder = name === 'shell' ? 2 : name === 'label' ? 1 : 0;
        mesh.castShadow = true;
        mesh.receiveShadow = name !== 'shell';
        mesh.position.y = -HEIGHT / 2;
        group.add(mesh);
      }
      group.position.set(...spec.position);
      group.rotation.set(...spec.tilt);
      this.#scene.add(group);
      this.#bottles.push({ group, spec });
    });

    this.#resize();
    this.#resizer = new ResizeObserver(() => this.#resize());
    this.#resizer.observe(this);

    if (reducedMotion.matches) {
      this.#render(0);
      this.classList.add('is-ready');
      return;
    }

    this.#listen();
    this.#render(0);
    this.classList.add('is-ready');
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

    if (strength > 0 && !coarsePointer.matches) {
      window.addEventListener(
        'pointermove',
        (event) => {
          pointer.targetX = (event.clientX / window.innerWidth) * 2 - 1;
          pointer.targetY = (event.clientY / window.innerHeight) * 2 - 1;
        },
        { passive: true, signal }
      );
    }

    // Run frames only while the hero is on screen and the tab is visible.
    let onScreen = false;
    const update = () => (onScreen && !document.hidden ? this.#start() : this.#stop?.());
    this.#observer = new IntersectionObserver(([entry]) => {
      onScreen = entry.isIntersecting;
      update();
    });
    this.#observer.observe(this);
    document.addEventListener('visibilitychange', update, { signal });

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

    const pointer = this.#pointer;
    const strength = Number(this.dataset.strength ?? 0.6);
    const ease = 1 - Math.exp(-dt * 4);
    pointer.x += (pointer.targetX - pointer.x) * ease;
    pointer.y += (pointer.targetY - pointer.y) * ease;

    // 0 when the hero's top is at the top of the screen, 1 when it has scrolled fully away.
    const rect = this.getBoundingClientRect();
    const scrolled = Math.min(Math.max(-rect.top / rect.height, 0), 1);

    for (const { group, spec } of this.#bottles) {
      group.rotation.x = spec.tilt[0] + pointer.y * 0.35 * strength;
      group.rotation.y = spec.tilt[1] + pointer.x * 0.6 * strength;
      group.rotation.z = spec.tilt[2] - pointer.x * 0.2 * strength;
      // Drift towards the mouse; the front bottle moves further than the one behind.
      group.position.x = spec.position[0] + pointer.x * 0.9 * spec.depth * strength;
      group.position.y =
        spec.position[1] -
        pointer.y * 0.6 * spec.depth * strength +
        Math.sin(time * 1.1 + spec.phase) * FLOAT +
        scrolled * 3;
    }

    // The scrolling wordmark drifts the other way, so it reads as a layer further back.
    if (this.#marquee) {
      const x = -pointer.x * 40 * strength;
      const y = -pointer.y * 14 * strength;
      this.#marquee.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`;
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

function bottleGeometries(THREE) {
  const shell = lathe(THREE, SHELL, 96);
  const liquid = lathe(THREE, LIQUID, 96);

  // Cap with vertical grip ribs: push the side wall in and out around the circumference.
  const cap = lathe(THREE, CAP, 180);
  const position = cap.attributes.position;
  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i);
    const y = position.getY(i);
    const z = position.getZ(i);
    if (y > CAP_RIBS.bottom && y < CAP_RIBS.top && Math.hypot(x, z) > CAP_RIBS.radius) {
      const scale = 1 + 0.025 * Math.sign(Math.cos(Math.atan2(x, z) * 45));
      position.setXYZ(i, x * scale, y, z * scale);
    }
  }
  cap.computeVertexNormals();

  // Label: open cylinder just outside the shell, the artwork wrapped once around it.
  // thetaStart = PI puts the middle of the artwork (the front) facing the camera.
  const labelHeight = LABEL.top - LABEL.bottom;
  const label = new THREE.CylinderGeometry(1.006, 1.006, labelHeight, 128, 1, true, Math.PI);
  label.translate(0, LABEL.bottom + labelHeight / 2, 0);

  return { liquid, label, cap, shell };
}

function bottleMaterials(THREE, labelTexture, liquidColour, gloss) {
  const liquid = new THREE.Color(liquidColour);
  return {
    // Glossy amber: a little self-glow so it reads as lit-through liquid, not paint.
    liquid: new THREE.MeshPhysicalMaterial({
      color: liquid,
      emissive: liquid,
      emissiveIntensity: 0.28,
      roughness: 0.08,
      clearcoat: gloss,
      clearcoatRoughness: 0.04,
      transparent: true,
      opacity: 0.92,
    }),
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
