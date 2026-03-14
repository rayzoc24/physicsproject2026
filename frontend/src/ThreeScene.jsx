import { useEffect, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { createCurvatureMesh, updateCurvatureMesh } from "./CurvatureMesh";

function makeTextSprite(label, color = "#ffe6a0") {
  const canvas = document.createElement("canvas");
  canvas.width = 420;
  canvas.height = 120;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "rgba(5, 14, 22, 0.72)";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.strokeStyle = color;
  ctx.lineWidth = 3;
  ctx.strokeRect(3, 3, canvas.width - 6, canvas.height - 6);
  ctx.font = "bold 44px Segoe UI";
  ctx.fillStyle = color;
  ctx.fillText(label, 20, 74);

  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  const material = new THREE.SpriteMaterial({ map: texture, transparent: true });
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(2.2, 0.65, 1);
  return sprite;
}

function ring(radius, color) {
  const geom = new THREE.RingGeometry(Math.max(radius - 0.04, 0.02), radius + 0.04, 96);
  const mat = new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide, transparent: true, opacity: 0.96 });
  const mesh = new THREE.Mesh(geom, mat);
  mesh.rotation.x = -Math.PI / 2.8;
  return mesh;
}

function mapRadiusToScene(radius, extent) {
  return (radius / Math.max(extent, 1e-6)) * 8.0;
}

function makeLensingRays(paths, extent = 12) {
  const scale = 8 / Math.max(extent, 1e-6);
  const group = new THREE.Group();
  paths.forEach((path) => {
    if (!Array.isArray(path) || path.length < 2) return;
    const points = path.map((p) => new THREE.Vector3(p[0] * scale, p[1] * scale, p[2]));
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const material = new THREE.LineBasicMaterial({ color: "#ffe585", transparent: true, opacity: 0.95 });
    group.add(new THREE.Line(geometry, material));
  });
  return group;
}

function makeStarField(stars, extent = 12) {
  if (!Array.isArray(stars) || stars.length === 0) return null;
  const scale = 8 / Math.max(extent, 1e-6);
  const positions = new Float32Array(stars.length * 3);
  stars.forEach((star, idx) => {
    positions[idx * 3 + 0] = star[0] * scale;
    positions[idx * 3 + 1] = star[1] * scale;
    positions[idx * 3 + 2] = star[2];
  });
  const geom = new THREE.BufferGeometry();
  geom.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  const mat = new THREE.PointsMaterial({ color: "#ffffff", size: 0.09, sizeAttenuation: true });
  return new THREE.Points(geom, mat);
}

function clearGroup(group) {
  if (!group) return;
  group.traverse((obj) => {
    if (obj.geometry) obj.geometry.dispose();
    if (obj.material) {
      if (Array.isArray(obj.material)) {
        obj.material.forEach((m) => m.dispose());
      } else {
        obj.material.dispose();
      }
    }
  });
}

function addPhysicalObjectSpheres(overlay, objectName, extent) {
  const addSphere = (x, y, z, radius, color, emissive = "#000000") => {
    const sphere = new THREE.Mesh(
      new THREE.SphereGeometry(radius, 32, 32),
      new THREE.MeshStandardMaterial({
        color,
        emissive,
        emissiveIntensity: 0.28,
        metalness: 0.35,
        roughness: 0.45,
      })
    );
    sphere.position.set(mapRadiusToScene(x, extent), mapRadiusToScene(y, extent), z);
    overlay.add(sphere);
  };

  if (objectName === "blackhole") {
    addSphere(0, 0, 0.45, 0.42, "#121212", "#2a1a1a");
  } else if (objectName === "wormhole") {
    addSphere(0, 0, 0.42, 0.23, "#f0c46d", "#6d4f17");
  } else if (objectName === "neutron_star") {
    addSphere(0, 0, 0.5, 0.35, "#8ad3ff", "#2f8fd1");
  } else if (objectName === "lensing") {
    addSphere(0, 0, 0.52, 0.28, "#ffd56e", "#8f6410");
  }
}

function buildOverlay({ objectName, labels, metadata, rays }) {
  const overlay = new THREE.Group();
  const extent = metadata?.extent ?? 12;

  addPhysicalObjectSpheres(overlay, objectName, extent);

  if (Array.isArray(labels)) {
    labels.forEach((entry) => {
      if (entry.type === "ring" && typeof entry.radius === "number") {
        const radius = mapRadiusToScene(entry.radius, extent);
        const ringMesh = ring(radius, entry.color || "#ffd966");
        overlay.add(ringMesh);

        const text = makeTextSprite(entry.name, entry.color || "#ffd966");
        text.position.set(radius + 0.8, 0, 0.85);
        overlay.add(text);
      }
      if (entry.type === "point" && Array.isArray(entry.position)) {
        const [x, y] = entry.position;
        const px = mapRadiusToScene(x, extent);
        const py = mapRadiusToScene(y, extent);
        const marker = new THREE.Mesh(
          new THREE.SphereGeometry(0.2, 24, 24),
          new THREE.MeshStandardMaterial({
            color: entry.color || "#ffe487",
            emissive: entry.color || "#775f1d",
            emissiveIntensity: 0.25,
            metalness: 0.28,
            roughness: 0.42,
          })
        );
        marker.position.set(px, py, 0.6);
        overlay.add(marker);

        const text = makeTextSprite(entry.name, entry.color || "#ffe487");
        text.position.set(px + 0.65, py + 0.25, 0.9);
        overlay.add(text);
      }
    });
  }

  if (objectName === "lensing" && Array.isArray(rays) && rays.length > 0) {
    const rayGroup = makeLensingRays(rays, extent);
    overlay.add(rayGroup);
  }

  const stars = makeStarField(metadata?.stars ?? [], extent);
  if (stars) overlay.add(stars);

  return overlay;
}

function ThreeScene({ field, wireframe, colorMode, rays, labels, metadata, objectName }) {
  const containerRef = useRef(null);
  const sceneStateRef = useRef(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return undefined;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#05111e");

    const camera = new THREE.PerspectiveCamera(54, 1, 0.1, 1200);
    camera.position.set(0, -16.5, 12.4);
    camera.lookAt(0, 0, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.06;
    controls.zoomSpeed = 1.25;
    controls.rotateSpeed = 0.7;
    controls.panSpeed = 0.85;
    controls.minDistance = 3.8;
    controls.maxDistance = 70;
    controls.maxPolarAngle = Math.PI;

    const ambient = new THREE.AmbientLight("#ffffff", 0.56);
    const key = new THREE.DirectionalLight("#d6ebff", 1.25);
    key.position.set(7.6, -8.3, 13.6);
    const fill = new THREE.PointLight("#6ca2ff", 0.82, 70);
    fill.position.set(-9.5, 11.0, 8.5);
    scene.add(ambient, key, fill);

    const resize = () => {
      const width = container.clientWidth;
      const height = container.clientHeight;
      if (width <= 0 || height <= 0) return;
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
    };

    let interacting = false;
    let resumeTimer = null;
    const onStart = () => {
      interacting = true;
      clearTimeout(resumeTimer);
    };
    const onEnd = () => {
      resumeTimer = setTimeout(() => {
        interacting = false;
      }, 900);
    };
    controls.addEventListener("start", onStart);
    controls.addEventListener("end", onEnd);

    let frameId;
    let pulsarPhase = 0;
    const animate = () => {
      frameId = window.requestAnimationFrame(animate);

      const state = sceneStateRef.current;
      if (state?.mesh && !interacting) {
        state.mesh.rotation.z += 0.0028;
      }

      // Pulsar-beam educational cue for neutron star mode.
      if (state?.beam) {
        pulsarPhase += 0.05;
        state.beam.rotation.z = pulsarPhase;
      }

      controls.update();
      renderer.render(scene, camera);
    };

    const resizeObserver = new ResizeObserver(() => resize());
    resizeObserver.observe(container);

    sceneStateRef.current = {
      scene,
      camera,
      renderer,
      controls,
      mesh: null,
      overlay: null,
      beam: null,
      frameId,
    };

    resize();
    animate();

    return () => {
      clearTimeout(resumeTimer);
      controls.removeEventListener("start", onStart);
      controls.removeEventListener("end", onEnd);
      controls.dispose();
      resizeObserver.disconnect();
      window.cancelAnimationFrame(frameId);

      if (sceneStateRef.current?.mesh) {
        sceneStateRef.current.mesh.geometry.dispose();
        sceneStateRef.current.mesh.material.dispose();
      }
      if (sceneStateRef.current?.overlay) {
        clearGroup(sceneStateRef.current.overlay);
        scene.remove(sceneStateRef.current.overlay);
      }
      if (sceneStateRef.current?.beam) {
        clearGroup(sceneStateRef.current.beam);
        scene.remove(sceneStateRef.current.beam);
      }

      renderer.dispose();
      if (container.contains(renderer.domElement)) container.removeChild(renderer.domElement);
      sceneStateRef.current = null;
    };
  }, []);

  useEffect(() => {
    const state = sceneStateRef.current;
    if (!state || !Array.isArray(field) || field.length === 0) return;

    if (!state.mesh) {
      const mesh = createCurvatureMesh(field, wireframe, colorMode);
      state.scene.add(mesh);
      state.mesh = mesh;
    } else {
      updateCurvatureMesh(state.mesh, field, wireframe, colorMode);
    }

    if (state.overlay) {
      clearGroup(state.overlay);
      state.scene.remove(state.overlay);
      state.overlay = null;
    }

    const overlay = buildOverlay({ objectName, labels, metadata, rays });
    state.scene.add(overlay);
    state.overlay = overlay;

    if (state.beam) {
      clearGroup(state.beam);
      state.scene.remove(state.beam);
      state.beam = null;
    }

    if (objectName === "neutron_star" && metadata?.pulsar_beam) {
      const beam = new THREE.Group();
      const geom = new THREE.ConeGeometry(0.25, 5.6, 22, 1, true);
      const mat = new THREE.MeshBasicMaterial({
        color: "#7cf2ff",
        transparent: true,
        opacity: 0.28,
        side: THREE.DoubleSide,
      });
      const coneA = new THREE.Mesh(geom, mat);
      coneA.position.set(0, 0, 3.2);
      coneA.rotation.x = Math.PI / 2;
      const coneB = new THREE.Mesh(geom, mat.clone());
      coneB.position.set(0, 0, -3.2);
      coneB.rotation.x = -Math.PI / 2;
      beam.add(coneA, coneB);
      state.scene.add(beam);
      state.beam = beam;
    }
  }, [field, wireframe, colorMode, rays, labels, metadata, objectName]);

  return <div className="three-container" ref={containerRef} />;
}

export default ThreeScene;
