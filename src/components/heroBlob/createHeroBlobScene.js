import * as THREE from 'three';

const MOBILE_BREAKPOINT = 768;
const DESKTOP_SEGMENTS = { width: 132, height: 96 };
const MOBILE_SEGMENTS = { width: 76, height: 56 };

function createRadialTexture({
  innerColor,
  outerColor,
  size = 256,
  innerStop = 0,
  midStop = 0.45,
  outerStop = 1,
}) {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;

  const context = canvas.getContext('2d');
  const center = size / 2;
  const gradient = context.createRadialGradient(center, center, size * innerStop * 0.5, center, center, center);

  gradient.addColorStop(innerStop, innerColor);
  gradient.addColorStop(midStop, innerColor);
  gradient.addColorStop(outerStop, outerColor);

  context.fillStyle = gradient;
  context.fillRect(0, 0, size, size);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function createBlobMaterial(uniforms) {
  const material = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color('#effff7'),
    transmission: 0.96,
    thickness: 1.25,
    roughness: 0.08,
    metalness: 0.02,
    clearcoat: 1,
    clearcoatRoughness: 0.05,
    ior: 1.18,
    reflectivity: 0.48,
    transparent: true,
    opacity: 0.5,
    attenuationColor: new THREE.Color('#2ad77d'),
    attenuationDistance: 2.8,
    envMapIntensity: 0.55,
  });

  material.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = uniforms.time;
    shader.uniforms.uBreath = uniforms.breath;
    shader.uniforms.uMotionMix = uniforms.motionMix;
    shader.uniforms.uGlowStrength = uniforms.glowStrength;
    shader.uniforms.uHoverPoint = uniforms.hoverPoint;
    shader.uniforms.uHoverStrength = uniforms.hoverStrength;
    shader.uniforms.uDragAnchor = uniforms.dragAnchor;
    shader.uniforms.uDragOffset = uniforms.dragOffset;
    shader.uniforms.uDragStrength = uniforms.dragStrength;

    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
uniform float uTime;
uniform float uBreath;
uniform float uMotionMix;
uniform vec3 uHoverPoint;
uniform float uHoverStrength;
uniform vec3 uDragAnchor;
uniform vec3 uDragOffset;
uniform float uDragStrength;
varying vec3 vBlobPosition;
varying vec3 vBlobNormal;

vec4 permute(vec4 x) {
  return mod(((x * 34.0) + 1.0) * x, 289.0);
}

vec4 taylorInvSqrt(vec4 r) {
  return 1.79284291400159 - 0.85373472095314 * r;
}

float snoise(vec3 v) {
  const vec2 c = vec2(1.0 / 6.0, 1.0 / 3.0);
  const vec4 d = vec4(0.0, 0.5, 1.0, 2.0);

  vec3 i = floor(v + dot(v, c.yyy));
  vec3 x0 = v - i + dot(i, c.xxx);
  vec3 g = step(x0.yzx, x0.xyz);
  vec3 l = 1.0 - g;
  vec3 i1 = min(g.xyz, l.zxy);
  vec3 i2 = max(g.xyz, l.zxy);
  vec3 x1 = x0 - i1 + c.xxx;
  vec3 x2 = x0 - i2 + c.yyy;
  vec3 x3 = x0 - d.yyy;

  i = mod(i, 289.0);
  vec4 p = permute(permute(permute(
    i.z + vec4(0.0, i1.z, i2.z, 1.0))
    + i.y + vec4(0.0, i1.y, i2.y, 1.0))
    + i.x + vec4(0.0, i1.x, i2.x, 1.0));

  float n_ = 1.0 / 7.0;
  vec3 ns = n_ * d.wyz - d.xzx;

  vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
  vec4 x_ = floor(j * ns.z);
  vec4 y_ = floor(j - 7.0 * x_);

  vec4 x = x_ * ns.x + ns.yyyy;
  vec4 y = y_ * ns.x + ns.yyyy;
  vec4 h = 1.0 - abs(x) - abs(y);

  vec4 b0 = vec4(x.xy, y.xy);
  vec4 b1 = vec4(x.zw, y.zw);
  vec4 s0 = floor(b0) * 2.0 + 1.0;
  vec4 s1 = floor(b1) * 2.0 + 1.0;
  vec4 sh = -step(h, vec4(0.0));

  vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
  vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;

  vec3 p0 = vec3(a0.xy, h.x);
  vec3 p1 = vec3(a0.zw, h.y);
  vec3 p2 = vec3(a1.xy, h.z);
  vec3 p3 = vec3(a1.zw, h.w);

  vec4 norm = taylorInvSqrt(vec4(dot(p0, p0), dot(p1, p1), dot(p2, p2), dot(p3, p3)));
  p0 *= norm.x;
  p1 *= norm.y;
  p2 *= norm.z;
  p3 *= norm.w;

  vec4 m = max(0.6 - vec4(dot(x0, x0), dot(x1, x1), dot(x2, x2), dot(x3, x3)), 0.0);
  m = m * m;

  return 42.0 * dot(m * m, vec4(dot(p0, x0), dot(p1, x1), dot(p2, x2), dot(p3, x3)));
}
`
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
vec3 animatedPosition = position;
vec3 animatedNormal = normal;
float time = uTime * (0.14 + 0.1 * uMotionMix);
float wobbleA = snoise(normalize(position) * 1.75 + vec3(0.0, time, time * 0.55));
float wobbleB = snoise(position * 2.4 - vec3(time * 0.38, 0.0, time * 0.24));
float wobble = (wobbleA * 0.042 + wobbleB * 0.018) * uMotionMix;
float pulse = sin(uTime * 0.7 + position.y * 2.6 + position.z * 1.6) * 0.008 * uMotionMix;
animatedPosition += animatedNormal * (wobble + pulse);

vec3 hoverDirection = normalize(uHoverPoint + vec3(0.0001));
float hoverDistance = distance(position, uHoverPoint);
float hoverFalloff = exp(-8.0 * hoverDistance);
animatedPosition += hoverDirection * hoverFalloff * 0.035 * uHoverStrength;

float dragDistance = distance(position, uDragAnchor);
float dragFalloff = exp(-9.0 * dragDistance);
animatedPosition += uDragOffset * dragFalloff * (0.46 * uDragStrength);

animatedPosition.x *= 0.94 + uBreath * 0.01;
animatedPosition.y *= 1.02 - uBreath * 0.008;
animatedPosition.z *= 0.98 + uBreath * 0.006;

transformed = animatedPosition;
vBlobPosition = animatedPosition;
vBlobNormal = normalMatrix * animatedNormal;
`
      );

    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
uniform float uTime;
uniform float uGlowStrength;
varying vec3 vBlobPosition;
varying vec3 vBlobNormal;
`
      )
      .replace(
        '#include <output_fragment>',
        `vec3 viewDirection = normalize(vViewPosition);
float fresnel = pow(1.0 - clamp(dot(normalize(normal), viewDirection), 0.0, 1.0), 2.25);
float edgeFresnel = pow(1.0 - clamp(dot(normalize(vBlobNormal), viewDirection), 0.0, 1.0), 3.2);
float verticalGlow = smoothstep(-1.0, 0.7, vBlobPosition.y);
float radialCenter = 1.0 - smoothstep(0.0, 1.12, length(vBlobPosition * vec3(0.95, 0.82, 1.0)));
float corePulse = 0.55 + 0.45 * sin(uTime * 0.55);
vec3 innerGlow = vec3(0.05, 0.34, 0.2) * verticalGlow * (0.12 + 0.05 * corePulse) * uGlowStrength;
vec3 edgeGlow = vec3(0.14, 0.92, 0.54) * (fresnel * 0.14 + edgeFresnel * 0.1) * uGlowStrength;
vec3 edgeHighlight = vec3(0.96, 1.0, 0.98) * (fresnel * 0.18 + edgeFresnel * 0.06);
vec3 coreTint = mix(vec3(0.015, 0.03, 0.026), vec3(0.028, 0.09, 0.062), verticalGlow);
outgoingLight = mix(outgoingLight, outgoingLight * (0.72 + coreTint * 2.2), 0.14);
outgoingLight = mix(outgoingLight, coreTint, radialCenter * 0.28);
outgoingLight += innerGlow + edgeGlow + edgeHighlight;
diffuseColor.a = clamp(diffuseColor.a * (0.3 + fresnel * 0.16 + edgeFresnel * 0.08), 0.18, 0.54);
#include <output_fragment>`
      );
  };

  material.customProgramCacheKey = () => 'hero-glass-blob-v1';
  return material;
}

function updateRendererSize({ mount, renderer, camera, coarsePointer }) {
  const width = mount.clientWidth || 1;
  const height = mount.clientHeight || 1;
  const aspect = width / height;

  camera.aspect = aspect;
  camera.position.z = aspect > 1.15 ? 4.8 : 5.2;
  camera.updateProjectionMatrix();

  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, coarsePointer ? 1.25 : 1.8));
  renderer.setSize(width, height, false);
}

export function createHeroBlobScene({ mount, reducedMotion = false }) {
  const mediaQuery = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT}px)`);
  const coarsePointer = window.matchMedia('(pointer: coarse)').matches || mediaQuery.matches;
  const prefersReducedMotion = { current: reducedMotion };
  const motionMix = { current: reducedMotion ? 0.3 : 1 };

  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: true,
    powerPreference: 'high-performance',
  });
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.96;
  renderer.setClearColor(0x000000, 0);
  renderer.domElement.className = 'hero-blob-canvas';
  renderer.domElement.setAttribute('aria-hidden', 'true');
  mount.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 20);
  camera.position.set(0, 0, 4.8);

  const clock = new THREE.Clock();
  const uniforms = {
    time: { value: 0 },
    breath: { value: 0.5 },
    motionMix: { value: motionMix.current },
    glowStrength: { value: 1 },
    hoverPoint: { value: new THREE.Vector3(0, 0, 0.95) },
    hoverStrength: { value: 0 },
    dragAnchor: { value: new THREE.Vector3(0, 0, 0.9) },
    dragOffset: { value: new THREE.Vector3() },
    dragStrength: { value: 0 },
  };

  const blobGroup = new THREE.Group();
  blobGroup.position.set(0, -0.02, -0.16);
  scene.add(blobGroup);

  const segments = coarsePointer ? MOBILE_SEGMENTS : DESKTOP_SEGMENTS;
  const blobGeometry = new THREE.SphereGeometry(1.08, segments.width, segments.height);
  const blobMaterial = createBlobMaterial(uniforms);
  const blobMesh = new THREE.Mesh(blobGeometry, blobMaterial);
  blobMesh.scale.set(0.9, 1.08, 0.98);
  blobGroup.add(blobMesh);

  const haloMaterial = new THREE.MeshBasicMaterial({
    color: new THREE.Color('#36ff88'),
    transparent: true,
    opacity: 0.04,
    blending: THREE.AdditiveBlending,
    side: THREE.BackSide,
    depthWrite: false,
  });
  const haloMesh = new THREE.Mesh(blobGeometry, haloMaterial);
  haloMesh.scale.set(1.03, 1.18, 1.08);
  blobGroup.add(haloMesh);

  const coreGlowTexture = createRadialTexture({
    innerColor: 'rgba(90, 255, 162, 0.72)',
    outerColor: 'rgba(108, 255, 168, 0)',
    midStop: 0.14,
  });
  const highlightTexture = createRadialTexture({
    innerColor: 'rgba(255, 255, 255, 0.8)',
    outerColor: 'rgba(255, 255, 255, 0)',
    midStop: 0.08,
  });
  const ambientGlowTexture = createRadialTexture({
    innerColor: 'rgba(41, 163, 104, 0.58)',
    outerColor: 'rgba(41, 163, 104, 0)',
    size: 384,
    midStop: 0.3,
  });

  const coreGlow = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: coreGlowTexture,
      color: new THREE.Color('#48de8a'),
      transparent: true,
      opacity: 0.11,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    })
  );
  coreGlow.scale.set(4.1, 4.8, 1);
  coreGlow.position.set(0, -0.1, -1.45);
  scene.add(coreGlow);

  const ambientGlow = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: ambientGlowTexture,
      color: new THREE.Color('#1f7d54'),
      transparent: true,
      opacity: 0.16,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    })
  );
  ambientGlow.scale.set(7.4, 6.8, 1);
  ambientGlow.position.set(0, 0.18, -2.1);
  scene.add(ambientGlow);

  const topHighlight = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: highlightTexture,
      color: new THREE.Color('#f4fff8'),
      transparent: true,
      opacity: 0.1,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    })
  );
  topHighlight.scale.set(1.8, 1.2, 1);
  topHighlight.position.set(-0.46, 0.86, 0.18);
  blobGroup.add(topHighlight);

  const backgroundPlate = new THREE.Mesh(
    new THREE.PlaneGeometry(7.2, 5.4),
    new THREE.MeshBasicMaterial({
      color: new THREE.Color('#04110a'),
      transparent: true,
      opacity: 0.12,
      depthWrite: false,
    })
  );
  backgroundPlate.position.z = -2.4;
  scene.add(backgroundPlate);

  const ambientLight = new THREE.HemisphereLight('#d9fff2', '#020705', 1.1);
  scene.add(ambientLight);

  const keyLight = new THREE.DirectionalLight('#f4fff9', 1.5);
  keyLight.position.set(2.7, 2.9, 5.2);
  scene.add(keyLight);

  const fillLight = new THREE.PointLight('#4de891', 4.5, 10, 2);
  fillLight.position.set(-1.5, -0.1, 2.4);
  scene.add(fillLight);

  const rimLight = new THREE.PointLight('#effff7', 2.6, 7, 2);
  rimLight.position.set(1.8, 2.1, 2.5);
  scene.add(rimLight);

  const resizeObserver = new ResizeObserver(() =>
    updateRendererSize({ mount, renderer, camera, coarsePointer })
  );
  resizeObserver.observe(mount);
  updateRendererSize({ mount, renderer, camera, coarsePointer });

  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2(10, 10);
  const cameraDirection = new THREE.Vector3();
  const dragPlane = new THREE.Plane();
  const worldTarget = new THREE.Vector3();
  const localTarget = new THREE.Vector3();

  const interaction = {
    coarsePointer,
    dragging: false,
    dragPointerId: null,
    hoverTargetStrength: 0,
    hoverStrength: 0,
    hoverPointTarget: uniforms.hoverPoint.value.clone(),
    dragTargetStrength: 0,
    dragStrength: 0,
    dragAnchor: uniforms.dragAnchor.value.clone(),
    dragOffsetTarget: new THREE.Vector3(),
    tiltTarget: new THREE.Vector2(),
    tiltCurrent: new THREE.Vector2(),
  };

  const canDrag = () => !coarsePointer && !prefersReducedMotion.current;

  function setPointerFromEvent(event) {
    const rect = renderer.domElement.getBoundingClientRect();
    pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -(((event.clientY - rect.top) / rect.height) * 2 - 1);

    const normalizedX = (event.clientX - rect.left) / rect.width - 0.5;
    const normalizedY = (event.clientY - rect.top) / rect.height - 0.5;
    interaction.tiltTarget.set(normalizedX, normalizedY);
  }

  function intersectBlob() {
    raycaster.setFromCamera(pointer, camera);
    const [hit] = raycaster.intersectObject(blobMesh, false);
    return hit || null;
  }

  function handlePointerMove(event) {
    if (interaction.coarsePointer) {
      return;
    }

    setPointerFromEvent(event);

    if (interaction.dragging) {
      raycaster.setFromCamera(pointer, camera);
      if (raycaster.ray.intersectPlane(dragPlane, worldTarget)) {
        localTarget.copy(blobMesh.worldToLocal(worldTarget.clone()));
        interaction.dragOffsetTarget
          .copy(localTarget.sub(interaction.dragAnchor))
          .clampLength(0, 0.22);
      }
      return;
    }

    const hit = intersectBlob();
    if (!hit) {
      interaction.hoverTargetStrength = 0;
      return;
    }

    const hitPoint = blobMesh.worldToLocal(hit.point.clone());
    interaction.hoverPointTarget.copy(hitPoint);
    interaction.hoverTargetStrength = 1;
  }

  function handlePointerDown(event) {
    if (!canDrag()) {
      return;
    }

    setPointerFromEvent(event);
    const hit = intersectBlob();
    if (!hit) {
      return;
    }

    event.preventDefault();
    interaction.dragging = true;
    interaction.dragPointerId = event.pointerId;
    interaction.hoverTargetStrength = 1;

    const hitPoint = blobMesh.worldToLocal(hit.point.clone());
    interaction.dragAnchor.copy(hitPoint);
    interaction.hoverPointTarget.copy(hitPoint);
    interaction.dragOffsetTarget.set(0, 0, 0);
    interaction.dragTargetStrength = 1;

    camera.getWorldDirection(cameraDirection);
    dragPlane.setFromNormalAndCoplanarPoint(cameraDirection, hit.point);
    renderer.domElement.setPointerCapture(event.pointerId);
  }

  function releaseInteraction(pointerId) {
    const capturedPointerId = interaction.dragPointerId;

    if (!interaction.dragging) {
      interaction.hoverTargetStrength = 0;
      interaction.dragTargetStrength = 0;
      return;
    }

    if (pointerId !== undefined && interaction.dragPointerId !== pointerId) {
      return;
    }

    interaction.dragging = false;
    interaction.dragPointerId = null;
    interaction.dragTargetStrength = 0;
    interaction.hoverTargetStrength = 0;
    interaction.tiltTarget.set(0, 0);

    if (capturedPointerId !== null && domElement.hasPointerCapture(capturedPointerId)) {
      domElement.releasePointerCapture(capturedPointerId);
    }
  }

  function handlePointerLeave() {
    if (!interaction.dragging) {
      interaction.hoverTargetStrength = 0;
      interaction.tiltTarget.set(0, 0);
    }
  }

  function handlePointerUp(event) {
    releaseInteraction(event.pointerId);
  }

  function handlePointerCancel(event) {
    releaseInteraction(event.pointerId);
  }

  const domElement = renderer.domElement;
  domElement.addEventListener('pointermove', handlePointerMove);
  domElement.addEventListener('pointerdown', handlePointerDown);
  domElement.addEventListener('pointerleave', handlePointerLeave);
  domElement.addEventListener('pointerup', handlePointerUp);
  domElement.addEventListener('pointercancel', handlePointerCancel);

  let animationFrame = 0;

  function renderFrame() {
    animationFrame = window.requestAnimationFrame(renderFrame);

    const elapsed = clock.getElapsedTime();
    const targetMotionMix = prefersReducedMotion.current ? 0.28 : 1;
    motionMix.current += (targetMotionMix - motionMix.current) * 0.06;

    uniforms.time.value = elapsed;
    uniforms.motionMix.value = motionMix.current;
    uniforms.breath.value = 0.5 + 0.5 * Math.sin(elapsed * 0.9);
    uniforms.glowStrength.value = 0.84 + 0.05 * Math.sin(elapsed * 0.42);

    interaction.hoverStrength += (interaction.hoverTargetStrength - interaction.hoverStrength) * 0.055;
    interaction.dragStrength += (interaction.dragTargetStrength - interaction.dragStrength) * (interaction.dragging ? 0.11 : 0.08);
    uniforms.hoverStrength.value = interaction.hoverStrength * (prefersReducedMotion.current ? 0.22 : 0.34);
    uniforms.dragStrength.value = interaction.dragStrength;
    uniforms.hoverPoint.value.lerp(interaction.hoverPointTarget, 0.08);
    uniforms.dragAnchor.value.copy(interaction.dragAnchor);

    if (!interaction.dragging) {
      interaction.dragOffsetTarget.multiplyScalar(0.82);
    }
    uniforms.dragOffset.value.lerp(interaction.dragOffsetTarget, interaction.dragging ? 0.12 : 0.07);

    interaction.tiltCurrent.lerp(interaction.tiltTarget, 0.045);

    const floatMotion = motionMix.current;
    blobGroup.rotation.y = Math.sin(elapsed * 0.14) * 0.035 * floatMotion + interaction.tiltCurrent.x * 0.08;
    blobGroup.rotation.x = -0.03 + Math.cos(elapsed * 0.12) * 0.02 * floatMotion + interaction.tiltCurrent.y * 0.06;
    blobGroup.position.x = Math.sin(elapsed * 0.22) * 0.028 * floatMotion;
    blobGroup.position.y = -0.02 + Math.cos(elapsed * 0.26) * 0.03 * floatMotion;

    const breathingScale = 1 + Math.sin(elapsed * 0.5) * 0.012 * floatMotion;
    blobMesh.scale.set(0.9 * breathingScale, 1.08 - (breathingScale - 1) * 0.4, 0.98 + (breathingScale - 1) * 0.2);
    haloMesh.scale.set(
      1.03 * breathingScale,
      1.18 - (breathingScale - 1) * 0.25,
      1.08 + (breathingScale - 1) * 0.18
    );

    coreGlow.material.opacity = 0.09 + 0.025 * Math.sin(elapsed * 0.35);
    coreGlow.scale.x = 4.1 + Math.sin(elapsed * 0.24) * 0.18 * floatMotion;
    coreGlow.scale.y = 4.8 + Math.cos(elapsed * 0.22) * 0.16 * floatMotion;
    ambientGlow.material.opacity = 0.13 + 0.025 * Math.sin(elapsed * 0.18);
    topHighlight.material.opacity = 0.08 + interaction.hoverStrength * 0.03;

    renderer.render(scene, camera);
  }

  renderFrame();

  return {
    setReducedMotion(nextValue) {
      prefersReducedMotion.current = nextValue;
      if (nextValue) {
        releaseInteraction();
      }
    },
    dispose() {
      window.cancelAnimationFrame(animationFrame);
      resizeObserver.disconnect();

      domElement.removeEventListener('pointermove', handlePointerMove);
      domElement.removeEventListener('pointerdown', handlePointerDown);
      domElement.removeEventListener('pointerleave', handlePointerLeave);
      domElement.removeEventListener('pointerup', handlePointerUp);
      domElement.removeEventListener('pointercancel', handlePointerCancel);

      blobGeometry.dispose();
      blobMaterial.dispose();
      haloMaterial.dispose();
      coreGlow.material.map.dispose();
      coreGlow.material.dispose();
      ambientGlow.material.map.dispose();
      ambientGlow.material.dispose();
      topHighlight.material.map.dispose();
      topHighlight.material.dispose();
      backgroundPlate.geometry.dispose();
      backgroundPlate.material.dispose();
      renderer.dispose();
      if (mount.contains(domElement)) {
        mount.removeChild(domElement);
      }
    },
  };
}
