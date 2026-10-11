/*
  Protection Brands 3D hero bottle: <pb-hero-bottle>, rendered by sections/pb-hero-bottle.liquid.

  One or two bottles spin slowly and float, tilt towards the mouse (moving the mouse spins
  them faster for a moment), and turn further as the hero scrolls away. The bottle is built
  in code from a profile traced from the 500 ml product photo; the label artwork wraps all
  the way round, front panel facing out.

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

/* Bottle geometry, in units of the body radius. Heights measured from the base. */
const SHELL = [
  [0, 0], [0.85, 0], [0.96, 0.03], [1, 0.15], [1, 7.02], [0.98, 7.16],
  [0.9, 7.3], [0.72, 7.44], [0.52, 7.52], [0.46, 7.56], [0.46, 7.66],
];
const LIQUID = [
  [0, 0.04], [0.83, 0.04], [0.94, 0.08], [0.97, 0.18], [0.97, 7.0],
  [0.95, 7.12], [0.88, 7.22], [0, 7.22],
];
const CAP = [[0, 7.64], [0.5, 7.64], [0.5, 8.17], [0.47, 8.22], [0, 8.22]];
const LABEL = { bottom: 0.7, top: 7.0 };
const HEIGHT = 8.22;

/* Layout of the bottles: position, resting tilt, and float phase. */
const LAYOUTS = {
  1: [{ position: [0, 0, 0], tilt: [0.08, 0, 0.16], phase: 0 }],
  2: [
    { position: [-1.35, 1.2, 0], tilt: [0.1, 0, 0.22], phase: 0 },
    { position: [1.35, -1.7, 0.6], tilt: [0.06, 0, 0.14], phase: 1.9 },
  ],
};

const SPIN_SPEED = 0.35; // radians per second at rest
const FLOAT = 0.18; // float height
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
  #pointer = { x: 0, y: 0, targetX: 0, targetY: 0, boost: 0 };
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

    this.#scene = new THREE.Scene();
    this.#environment = studioEnvironment(THREE, renderer);
    this.#scene.environment = this.#environment;

    this.#camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
    this.#addLights(THREE);

    const label = await loadTexture(THREE, this.dataset.label).catch(() => null);
    if (this.#disposed) return;
    if (label) label.anisotropy = renderer.capabilities.getMaxAnisotropy();

    // Each bottle can have its own liquid colour (the second is the car care bottle).
    const liquids = [this.dataset.liquid || '#b5650e', this.dataset.liquidSecond || this.dataset.liquid || '#b5650e'];
    const geometries = bottleGeometries(THREE);
    const layout = LAYOUTS[this.dataset.bottles] || LAYOUTS[2];

    layout.forEach((spec, index) => {
      const materials = bottleMaterials(THREE, label, liquids[index]);
      // group: position and tilt. spinner: turns around the bottle's own axis.
      const group = new THREE.Group();
      const spinner = new THREE.Group();
      for (const [name, geometry] of Object.entries(geometries)) {
        const mesh = new THREE.Mesh(geometry, materials[name]);
        mesh.renderOrder = name === 'shell' ? 2 : name === 'label' ? 1 : 0;
        mesh.position.y = -HEIGHT / 2;
        spinner.add(mesh);
      }
      group.add(spinner);
      group.position.set(...spec.position);
      group.rotation.set(...spec.tilt);
      this.#scene.add(group);
      this.#bottles.push({ group, spinner, spec, spin: spec.phase });
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

  #addLights(THREE) {
    const key = new THREE.DirectionalLight(0xffffff, 1.4);
    key.position.set(4, 6, 8);
    // Brand-red rim from behind, picks out the edges against the dark background.
    const rim = new THREE.DirectionalLight(0xc62b23, 2.2);
    rim.position.set(-6, 3, -6);
    const fill = new THREE.DirectionalLight(0xffffff, 0.5);
    fill.position.set(-5, -2, 6);
    this.#scene.add(key, rim, fill);
  }

  #resize() {
    const width = this.clientWidth;
    const height = this.clientHeight;
    if (!width || !height) return;
    this.#renderer.setSize(width, height, false);

    // Fit the bottles: by height on wide screens, by width on narrow ones.
    const camera = this.#camera;
    const two = this.#bottles.length > 1;
    const needHeight = two ? 17.5 : 13;
    const needWidth = two ? 8 : 5;
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
          pointer.boost = Math.min(pointer.boost + Math.abs(event.movementX) * 0.004 * strength, 3);
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
    pointer.boost *= Math.exp(-dt * 1.5);

    // 0 when the hero's top is at the top of the screen, 1 when it has scrolled fully away.
    const rect = this.getBoundingClientRect();
    const scrolled = Math.min(Math.max(-rect.top / rect.height, 0), 1);

    for (const bottle of this.#bottles) {
      const { group, spinner, spec } = bottle;
      bottle.spin += dt * (SPIN_SPEED + pointer.boost);
      spinner.rotation.y = bottle.spin + scrolled * Math.PI;

      group.rotation.x = spec.tilt[0] + pointer.y * 0.35 * strength;
      group.rotation.y = spec.tilt[1] + pointer.x * 0.6 * strength;
      group.rotation.z = spec.tilt[2] - pointer.x * 0.2 * strength;
      group.position.y = spec.position[1] + Math.sin(time * 1.1 + spec.phase) * FLOAT + scrolled * 3;
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
    if (y > 7.68 && y < 8.15 && Math.hypot(x, z) > 0.45) {
      const scale = 1 + 0.025 * Math.sign(Math.cos(Math.atan2(x, z) * 45));
      position.setXYZ(i, x * scale, y, z * scale);
    }
  }
  cap.computeVertexNormals();

  // Label: open cylinder just outside the shell. thetaStart = PI puts the middle of the
  // artwork (the front panel) facing the camera.
  const labelHeight = LABEL.top - LABEL.bottom;
  const label = new THREE.CylinderGeometry(1.006, 1.006, labelHeight, 128, 1, true, Math.PI);
  label.translate(0, LABEL.bottom + labelHeight / 2, 0);

  // The flat artwork is three equal panels, but on the real bottle the front panel fills the
  // whole visible face. Give the middle third of the artwork the front half of the bottle,
  // and the side panels a quarter each.
  const uv = label.attributes.uv;
  for (let i = 0; i < uv.count; i++) {
    const around = uv.getX(i); // 0..1 around the bottle, 0.5 = front
    const art =
      around < 0.25 ? (around / 0.25) * (1 / 3)
      : around > 0.75 ? 2 / 3 + ((around - 0.75) / 0.25) * (1 / 3)
      : 1 / 3 + ((around - 0.25) / 0.5) * (1 / 3);
    uv.setX(i, art);
  }

  return { liquid, label, cap, shell };
}

function bottleMaterials(THREE, labelTexture, liquidColour) {
  const liquid = new THREE.Color(liquidColour);
  return {
    // Glossy amber: a little self-glow so it reads as lit-through liquid, not paint.
    liquid: new THREE.MeshPhysicalMaterial({
      color: liquid,
      emissive: liquid,
      emissiveIntensity: 0.28,
      roughness: 0.08,
      clearcoat: 1,
      clearcoatRoughness: 0.04,
      transparent: true,
      opacity: 0.92,
    }),
    label: new THREE.MeshPhysicalMaterial({
      color: labelTexture ? 0xffffff : 0x111111,
      map: labelTexture,
      roughness: 0.42,
      clearcoat: 0.4,
      clearcoatRoughness: 0.3,
    }),
    cap: new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.55 }),
    shell: new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      roughness: 0.06,
      transparent: true,
      opacity: 0.16,
      clearcoat: 1,
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
  softbox(3, 14, 6, -6, 1, 3);
  softbox(2.5, 14, 4, 6, 1, 2);
  softbox(10, 3, 2, 0, 8, 2);

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
