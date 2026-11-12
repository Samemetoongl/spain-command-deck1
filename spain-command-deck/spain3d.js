import * as THREE from "./three.module.min.js";

const container = document.getElementById("three-container");

if (!container) {
  throw new Error("SPAIN 3D container not found");
}

const scene = new THREE.Scene();

const camera = new THREE.PerspectiveCamera(
  42, 1, 0.1, 100
);
camera.position.z = 12;

const renderer = new THREE.WebGLRenderer({
  alpha: true,
  antialias: true,
  powerPreference: "high-performance"
});

renderer.setPixelRatio(
  Math.min(window.devicePixelRatio, 1.5)
);

renderer.setClearColor(0x000000, 0);
renderer.outputColorSpace = THREE.SRGBColorSpace;

container.appendChild(renderer.domElement);

const brain = new THREE.Group();
scene.add(brain);

// COLORS
const CYAN = 0x52dcff;
const BLUE = 0x147cff;
const ICE = 0xe5fbff;

// NEURAL NETWORK STRUCTURE
const NODE_COUNT = 260;

const nodes = [];
const positions = new Float32Array(NODE_COUNT * 3);

for (let i = 0; i < NODE_COUNT; i++) {
  const theta = Math.random() * Math.PI * 2;
  const phi = Math.acos(2 * Math.random() - 1);
  const radius = 1.6 + Math.random() * 1.1;

  const x = radius * Math.sin(phi) * Math.cos(theta);
  const y = radius * Math.sin(phi) * Math.sin(theta);
  const z = radius * Math.cos(phi);

  nodes.push(new THREE.Vector3(x, y, z));

  positions[i * 3] = x;
  positions[i * 3 + 1] = y;
  positions[i * 3 + 2] = z;
}

const nodeGeometry = new THREE.BufferGeometry();

nodeGeometry.setAttribute(
  "position",
  new THREE.BufferAttribute(positions, 3)
);

const nodeMaterial = new THREE.PointsMaterial({
  color: CYAN,
  size: 0.045,
  transparent: true,
  opacity: 0.85,
  sizeAttenuation: true
});

const nodeCloud = new THREE.Points(
  nodeGeometry,
  nodeMaterial
);

brain.add(nodeCloud);

// NEURAL CONNECTIONS
const connectionPoints = [];

for (let i = 0; i < NODE_COUNT; i++) {
  let connections = 0;

  for (let j = i + 1; j < NODE_COUNT; j++) {
    if (nodes[i].distanceTo(nodes[j]) < 0.75) {
      connectionPoints.push(
        nodes[i].x, nodes[i].y, nodes[i].z,
        nodes[j].x, nodes[j].y, nodes[j].z
      );

      connections++;

      if (connections >= 4) break;
    }
  }
}

const connectionGeometry = new THREE.BufferGeometry();

connectionGeometry.setAttribute(
  "position",
  new THREE.Float32BufferAttribute(
    connectionPoints, 3
  )
);

const connections = new THREE.LineSegments(
  connectionGeometry,
  new THREE.LineBasicMaterial({
    color: BLUE,
    transparent: true,
    opacity: 0.22
  })
);

brain.add(connections);

// INNER ENERGY CORE
const nucleus = new THREE.Mesh(
  new THREE.IcosahedronGeometry(0.9, 4),
  new THREE.MeshBasicMaterial({
    color: CYAN,
    transparent: true,
    opacity: 0.18,
    wireframe: true
  })
);

brain.add(nucleus);

// BRIGHT CENTRAL POINT
const center = new THREE.Mesh(
  new THREE.SphereGeometry(0.35, 32, 32),
  new THREE.MeshBasicMaterial({
    color: ICE,
    transparent: true,
    opacity: 0.9
  })
);

brain.add(center);

// ENERGY GLOW
const glowCanvas = document.createElement("canvas");
glowCanvas.width = 256;
glowCanvas.height = 256;

const ctx = glowCanvas.getContext("2d");

const gradient = ctx.createRadialGradient(
  128, 128, 0,
  128, 128, 128
);

gradient.addColorStop(
  0, "rgba(210,250,255,0.85)"
);
gradient.addColorStop(
  0.12, "rgba(60,210,255,0.38)"
);
gradient.addColorStop(
  0.45, "rgba(0,100,255,0.10)"
);
gradient.addColorStop(
  1, "rgba(0,100,255,0)"
);

ctx.fillStyle = gradient;
ctx.fillRect(0, 0, 256, 256);

const glow = new THREE.Sprite(
  new THREE.SpriteMaterial({
    map: new THREE.CanvasTexture(glowCanvas),
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  })
);

glow.scale.set(6.5, 6.5, 1);
glow.position.z = -0.5;

brain.add(glow);

// ENERGY PULSES
const pulseCount = 35;
const pulsePositions = new Float32Array(
  pulseCount * 3
);

for (let i = 0; i < pulseCount; i++) {
  const node = nodes[
    Math.floor(Math.random() * nodes.length)
  ];

  pulsePositions[i * 3] = node.x;
  pulsePositions[i * 3 + 1] = node.y;
  pulsePositions[i * 3 + 2] = node.z;
}

const pulseGeometry = new THREE.BufferGeometry();

pulseGeometry.setAttribute(
  "position",
  new THREE.BufferAttribute(
    pulsePositions, 3
  )
);

const pulses = new THREE.Points(
  pulseGeometry,
  new THREE.PointsMaterial({
    color: ICE,
    size: 0.08,
    transparent: true,
    opacity: 0.95
  })
);

brain.add(pulses);

// RESPONSIVE SIZING
let needsRender = true;
function resize() {
  needsRender = true;
  const width = container.clientWidth;
  const height = container.clientHeight;

  if (!width || !height) return;

  renderer.setSize(width, height, false);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
}

new ResizeObserver(resize).observe(container);
resize();

const reducedMotion = window.matchMedia(
  "(prefers-reduced-motion: reduce)"
).matches;

let previous = performance.now();

function animate(now) {
  requestAnimationFrame(animate);
  if (document.hidden || !container.clientWidth) return;
  if (reducedMotion && !needsRender) return;
  if (!reducedMotion && now - previous < 1000 / 30) return;
  needsRender = false;

  const dt = Math.min(
    (now - previous) / 1000, 0.05
  );

  previous = now;

  const processing =
    document.getElementById("mode")
      ?.textContent === "PROCESSING";

  if (!reducedMotion) {
    const speed = processing ? 3 : 1;

    brain.rotation.y += dt * 0.075 * speed;
    brain.rotation.x += dt * 0.025;

    nucleus.rotation.y -= dt * 0.12 * speed;
    nucleus.rotation.z += dt * 0.05;

    const pulse =
      1 + Math.sin(now * 0.002 * speed) * 0.06;

    center.scale.setScalar(pulse);

    pulses.material.opacity =
      0.45 + Math.sin(now * 0.004 * speed) * 0.35;

    connections.material.opacity =
      processing ? 0.45 : 0.22;

    glow.material.opacity =
      processing ? 1 : 0.65;
  }

  renderer.render(scene, camera);
  container.classList.add("ready");
}

requestAnimationFrame(animate);
