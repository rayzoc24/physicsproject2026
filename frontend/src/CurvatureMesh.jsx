import * as THREE from "three";

function normalizeField(field) {
  let min = Infinity;
  let max = -Infinity;

  for (let row = 0; row < field.length; row += 1) {
    for (let col = 0; col < field[row].length; col += 1) {
      const value = field[row][col];
      if (value < min) min = value;
      if (value > max) max = value;
    }
  }

  const range = Math.max(max - min, 1e-6);
  return field.map((row) => row.map((value) => (value - min) / range));
}

function lerpColor(a, b, t) {
  const color = new THREE.Color();
  color.r = a.r + (b.r - a.r) * t;
  color.g = a.g + (b.g - a.g) * t;
  color.b = a.b + (b.b - a.b) * t;
  return color;
}

function sampleGradient(stops, t) {
  const clamped = Math.max(0, Math.min(1, t));
  for (let i = 0; i < stops.length - 1; i += 1) {
    const [p0, c0] = stops[i];
    const [p1, c1] = stops[i + 1];
    if (clamped >= p0 && clamped <= p1) {
      const local = (clamped - p0) / Math.max(p1 - p0, 1e-6);
      return lerpColor(new THREE.Color(c0), new THREE.Color(c1), local);
    }
  }
  return new THREE.Color(stops[stops.length - 1][1]);
}

function buildColorBuffer(field, colorMode = "curvature") {
  const rows = field.length;
  const cols = field[0].length;
  const colors = new Float32Array(rows * cols * 3);

  const maxAbs = Math.max(...field.flat().map((value) => Math.abs(value)), 1e-6);
  const palettes = {
    curvature: [
      [0.0, "#1557d5"],
      [0.5, "#2fd26f"],
      [1.0, "#e03131"],
    ],
    wavelength: [
      [0.0, "#ff2a2a"],
      [0.18, "#ff7f11"],
      [0.36, "#ffe14f"],
      [0.54, "#33d06d"],
      [0.72, "#2d83ff"],
      [0.88, "#5d4bff"],
      [1.0, "#8f2cff"],
    ],
  };
  const selected = palettes[colorMode] ?? palettes.curvature;

  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      const index = row * cols + col;
      const colorT = Math.abs(field[row][col]) / maxAbs;
      const color = sampleGradient(selected, colorT);
      colors[index * 3 + 0] = color.r;
      colors[index * 3 + 1] = color.g;
      colors[index * 3 + 2] = color.b;
    }
  }

  return colors;
}

function applyDisplacement(geometry, field, heightScale) {
  const positions = geometry.attributes.position;
  const rows = field.length;
  const cols = field[0].length;

  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      const index = row * cols + col;
      const normalizedHeight = field[row][col];
      const centeredHeight = (normalizedHeight - 0.5) * heightScale;
      positions.setZ(index, centeredHeight);
    }
  }

  positions.needsUpdate = true;
  geometry.computeVertexNormals();
}

export function createCurvatureMesh(field, wireframe = true, colorMode = "curvature") {
  const rows = field.length;
  const cols = field[0].length;
  const normalizedField = normalizeField(field);

  const geometry = new THREE.PlaneGeometry(16, 16, cols - 1, rows - 1);
  applyDisplacement(geometry, normalizedField, 6.0);
  geometry.setAttribute(
    "color",
    new THREE.BufferAttribute(buildColorBuffer(field, colorMode), 3)
  );

  const material = new THREE.MeshStandardMaterial({
    color: "#ffffff",
    metalness: 0.18,
    roughness: 0.42,
    vertexColors: true,
    wireframe,
    side: THREE.DoubleSide,
  });

  const mesh = new THREE.Mesh(geometry, material);
  mesh.rotation.x = -Math.PI / 2.8;
  return mesh;
}

export function updateCurvatureMesh(mesh, field, wireframe = true, colorMode = "curvature") {
  const rows = field.length;
  const cols = field[0].length;
  const expectedVertices = rows * cols;
  const currentVertices = mesh.geometry.attributes.position.count;

  if (currentVertices !== expectedVertices) {
    mesh.geometry.dispose();
    mesh.geometry = new THREE.PlaneGeometry(16, 16, cols - 1, rows - 1);
  }

  const normalizedField = normalizeField(field);
  applyDisplacement(mesh.geometry, normalizedField, 6.0);
  mesh.geometry.setAttribute(
    "color",
    new THREE.BufferAttribute(buildColorBuffer(field, colorMode), 3)
  );
  mesh.material.wireframe = wireframe;
}