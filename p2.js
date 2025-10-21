var renderer, scene, camera, cameraControls;
let started = false;
let assetsLoaded = false;
let userRequestedStart = false;
let startOverlayEl = null;
let startButtonEl = null;
let startButtonLabel = '';

let gameOver = false;
let gameOverOverlay = null;
const GAME_OVER_RESTART_MS = 2600;
const SUN_DESTRUCTION_MARGIN = 40;

let roverSpawnPoint = null;
let roverDesiredHeight = 20;
let audioListener, thruster = null, thrusterLoaded = false;
let _thrusterVol = 0;

const THRUSTER_SOUND_URL = new URL('./audio/propulsor.mp3', import.meta.url).href;
const THRUSTER_MAX_VOL = 0.8;
const THRUSTER_FADE_HZ = 8.0;
const THRUSTER_MIN_RATE = 0.90;
const THRUSTER_MAX_RATE = 1.30;
let player = null, mixer = null;
const clock = new THREE.Clock();
let applyRoverTextures = null;

let roverWheelInfos = [];
let roverSteerAngle = 0;
const ROVER_MAX_STEER = THREE.MathUtils.degToRad(45);
const ROVER_STEER_HZ = 7.5;
const ROVER_STEER_RETURN_HZ = 10.0;
const ROVER_MIN_STEER_SPEED = 0.2;
const ROVER_GROUND_BRAKE_HZ = 16.0;
const ROVER_VISUAL_OFFSET = -8;
let TURN_SPEED = 1.0;
let THRUST = 5000;
let UP_THRUST_MULT = 1500.0;
const DOWN_THRUST_MULT = 1800.0;
const TAKEOFF_RAMP_S = 1.2;
const ASCENT_V_STD = 300;
const CLIMB_GAIN = 3.0;
let climb = { active: false, t: 0 };
function updateSteer(dt, allowSteer = true) {

  let target = 0;
  if (allowSteer) {
    if (keys.a && !keys.d) target = +ROVER_MAX_STEER;
    if (keys.d && !keys.a) target = -ROVER_MAX_STEER;
  }

  const hz = (target === 0 ? ROVER_STEER_RETURN_HZ : ROVER_STEER_HZ);
  const a = 1 - Math.exp(-hz * dt);
  roverSteerAngle += (target - roverSteerAngle) * a;
}

const VIEW_BIAS = {
  yaw:  THREE.MathUtils.degToRad(-20),
  pitch: 0,
  roll:  0
};

let roverHeading = new THREE.Vector3(1, 0, 0);

let starMesh;
const STAR_RADIUS = 1200;
let sunDirLight = null;
const SUN_DIR_LIGHT_OFFSET = 9000;

let world, roverBody;
let planetMat, roverMat;

const planets = [];
let currentPlanet = null;
let previousPlanet = null;
let planetTransitionT = 1.0;
const PLANET_TRANSITION_SPEED = 0.2;

function getPlanetByName(name) {
  return planets.find((p) => p && p.name === name) || null;
}

const collectibles = [];
const collectibleSpawns = [];
let collectibleTemplate = null;
let collectiblesCollected = 0;
let collectibleUI = null;

const COLLECTIBLE_TARGET_SIZE = 90;
const COLLECTIBLE_DEFAULTS = {
  altitudeFactor: 0.12,
  spinSpeed: THREE.MathUtils.degToRad(45),
  bobAmplitude: 45,
  bobHz: 0.35,
  pickupRadius: 150
};
const POWERMOON_LIGHT_COLOR = 0xfff6c9;
const POWERMOON_LIGHT_INTENSITY = 20;
const POWERMOON_LIGHT_DISTANCE = 2000;
const POWERMOON_LIGHT_DECAY = 2.2;

const WORLD_UP = new THREE.Vector3(0, 1, 0);
const TMP_VEC_A = new THREE.Vector3();
const TMP_VEC_C = new THREE.Vector3();
const TMP_VEC_D = new THREE.Vector3();
const TMP_VEC_E = new THREE.Vector3();
const TMP_VEC_F = new THREE.Vector3();
const TMP_VEC_G = new THREE.Vector3();
const TMP_VEC_H = new THREE.Vector3();
const TMP_VEC_I = new THREE.Vector3();
const TMP_BOX = new THREE.Box3();
const TMP_SIZE = new THREE.Vector3();
const TMP_QUAT_A = new THREE.Quaternion();
const TMP_COLOR = new THREE.Color();

function tryBeginExperience() {
  if (started || !assetsLoaded || !userRequestedStart) return;
  if (startOverlayEl) startOverlayEl.classList.add('hidden');
  started = true;
  render();
}

const keys = { w: false, a: false, s: false, d: false, space: false, c: false };

let minimapCam;
let minimapOverlayScene = null;
let minimapOverlayCamera = null;
let minimapCrosshair = null;

let minimapHUD = null;
let minimapHUDHeader = null;
let minimapHUDPlanet = null;
let minimapHUDAlt = null;
let minimapHUDVel = null;
let minimapHUDStatus = null;
const minimapHUDLayoutCache = { ratio: -1, w: -1, h: -1, pad: -1, border: -1 };

const MINIMAP = {
  w: 260,
  h: 260,
  pad: 28,
  border: 16,
  worldHalf: 420,
  frameColor: 0x091320,
  frameAlpha: 0.94,
  innerColor: 0x03070d,
  innerAlpha: 0.88,
  crosshairColor: 0x66d2ff,
  crosshairOpacity: 0.68,
  label: 'ROVER CAM',
  statusPrefix: 'LINK'
};

const camState = {
  pos: new THREE.Vector3(),
  target: new THREE.Vector3(),
  up: new THREE.Vector3(0, 1, 0),
  heading: new THREE.Vector3(0, 0, 1),
  q: new THREE.Quaternion()
};

const FOLLOW = {
  back: 250,
  up: 40,
  postLookLift: 0,
  postLookNudge: 80,
  lerpPosHz: 1000,
  lerpRotHz: 1000,
  lerpTargetHz: 1000
};

let camUserYaw = 0;
let camUserPitch = 0;
let camDragging = false;

const ORBIT = {
  sensitivity: 0.003,
  pitchMin: -1.5,
  pitchMax: 1.5,
  returnHz: 1.0
};

function renderMinimapUp() {
  updateMinimapHUDLayout();

  if (!(roverBody && currentPlanet)) {
    updateMinimapHUDTelemetry(null, null, null);
    return;
  }


  const roverPos = new THREE.Vector3(roverBody.position.x, roverBody.position.y, roverBody.position.z);
  const planetCenter = new THREE.Vector3(
    currentPlanet.body.position.x, currentPlanet.body.position.y, currentPlanet.body.position.z
  );
  const up = roverPos.clone().sub(planetCenter).normalize();


  let fwd = roverHeading.clone().addScaledVector(up, -roverHeading.dot(up));
  if (fwd.lengthSq() < 1e-8) fwd = new THREE.Vector3(1, 0, 0).cross(up).normalize();
  else fwd.normalize();


  const camPos = roverPos.clone().addScaledVector(up, -5);
  const camLook = roverPos.clone().addScaledVector(up, 1000);

  minimapCam.position.copy(camPos);
  minimapCam.lookAt(camLook);
  minimapCam.up.copy(fwd);
  minimapCam.updateMatrixWorld();


  const half = MINIMAP.worldHalf;
  minimapCam.left = -half;
  minimapCam.right = half;
  minimapCam.top = half;
  minimapCam.bottom = -half;
  minimapCam.near = 0.1;
  minimapCam.far = 1e6;
  minimapCam.updateProjectionMatrix();

  const frameColor = MINIMAP.frameColor ?? 0x000000;
  const frameAlpha = MINIMAP.frameAlpha ?? 1;
  const innerColor = MINIMAP.innerColor ?? 0x000000;
  const innerAlpha = MINIMAP.innerAlpha ?? 1;
  const border = MINIMAP.border ?? 0;
  const pad = MINIMAP.pad ?? 0;
  const w = MINIMAP.w ?? 200;
  const h = MINIMAP.h ?? 200;

  const outerW = w + border * 2;
  const outerH = h + border * 2;
  const W = renderer.domElement.width;
  const H = renderer.domElement.height;
  const vxOuter = W - outerW - pad;
  const vyOuter = pad;

  const prevColor = renderer.getClearColor(TMP_COLOR);
  const prevColorHex = prevColor.getHex();
  const prevAlpha = renderer.getClearAlpha();

  renderer.setScissorTest(true);

  renderer.setViewport(vxOuter, vyOuter, outerW, outerH);
  renderer.setScissor(vxOuter, vyOuter, outerW, outerH);
  renderer.setClearColor(frameColor, frameAlpha);
  renderer.clear(true, true, false);

  const innerX = vxOuter + border;
  const innerY = vyOuter + border;
  renderer.setViewport(innerX, innerY, w, h);
  renderer.setScissor(innerX, innerY, w, h);
  renderer.setClearColor(innerColor, innerAlpha);
  renderer.clear(true, true, false);

  renderer.render(scene, minimapCam);

  if (minimapOverlayScene && minimapOverlayCamera && minimapCrosshair && MINIMAP.crosshairOpacity > 0) {
    const mat = minimapCrosshair.material;
    if (mat) {
      if (mat.color && mat.color.getHex() !== MINIMAP.crosshairColor) {
        mat.color.setHex(MINIMAP.crosshairColor);
      }
      if (mat.opacity !== MINIMAP.crosshairOpacity) {
        mat.opacity = MINIMAP.crosshairOpacity;
      }
    }
    renderer.clearDepth();
    renderer.render(minimapOverlayScene, minimapOverlayCamera);
  }

  renderer.setScissorTest(false);
  renderer.setViewport(0, 0, W, H);
  renderer.setClearColor(prevColorHex, prevAlpha);

  const altitude = altitudeToPlanet(roverBody, currentPlanet);
  const vel = roverBody.velocity;
  const speed = vel ? Math.sqrt(vel.x * vel.x + vel.y * vel.y + vel.z * vel.z) : NaN;
  updateMinimapHUDTelemetry(currentPlanet, altitude, speed);
}

function initThrusterAudio() {
  const loader = new THREE.AudioLoader();
  thruster = new THREE.PositionalAudio(audioListener);


  thruster.setRefDistance(100);
  thruster.setMaxDistance(2000);
  thruster.setRolloffFactor(0.5);
  try { thruster.setDistanceModel('linear'); } catch { }


  thruster.setLoop(true);
  thruster.setVolume(0);

  loader.load(THRUSTER_SOUND_URL, (buffer) => {
    thruster.setBuffer(buffer);
    thrusterLoaded = true;
    try { thruster.play(); } catch (e) { }

    if (player) player.add(thruster);
  });
}

function init() {
  renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setClearColor(0x000000);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.autoClear = false;
  document.getElementById('container').appendChild(renderer.domElement);

  startOverlayEl = document.getElementById('startOverlay');
  startButtonEl = document.getElementById('startButton');
  if (startButtonEl) {
    startButtonLabel = (startButtonEl.textContent || 'Iniciar viaje').trim();
    startButtonEl.textContent = 'Cargando...';
    startButtonEl.disabled = true;
    startButtonEl.addEventListener('click', () => {
      if (startButtonEl.disabled) return;
      startButtonEl.disabled = true;
      userRequestedStart = true;
      tryBeginExperience();
    });
  }

  window.addEventListener('keydown', (ev) => {
    if (started || !assetsLoaded) return;
    if (ev.code === 'Enter' || ev.code === 'Space') {
      if (startButtonEl && startButtonEl.disabled) return;
      if (startButtonEl) startButtonEl.disabled = true;
      userRequestedStart = true;
      tryBeginExperience();
    }
  });
  initCollectibleUI();
  initMinimapHUD();
  initGameOverOverlay();

  scene = new THREE.Scene();

  const aspectRatio = window.innerWidth / window.innerHeight;
  camera = new THREE.PerspectiveCamera(50, aspectRatio, 1, 60000);
  camera.position.set(300, 300, 300);

  cameraControls = new THREE.OrbitControls(camera, renderer.domElement);
  cameraControls.enabled = false;
  cameraControls.enableDamping = true;
  cameraControls.dampingFactor = 0.06;



  minimapCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 1e7);

  minimapCam.up.set(0, 1, 0);

  minimapOverlayScene = new THREE.Scene();
  minimapOverlayCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  minimapOverlayCamera.position.set(0, 0, 0.5);
  minimapOverlayCamera.lookAt(new THREE.Vector3(0, 0, 0));
  minimapOverlayCamera.updateProjectionMatrix();

  const crossSize = 0.9;
  const cornerInset = 0.16;
  const centerSize = 0.12;
  const crosshairPositions = new Float32Array([
    -crossSize,  crossSize, 0,  -(crossSize - cornerInset),  crossSize, 0,
    -crossSize,  crossSize, 0,  -crossSize,  crossSize - cornerInset, 0,
     crossSize,  crossSize, 0,   crossSize - cornerInset,   crossSize, 0,
     crossSize,  crossSize, 0,   crossSize,  crossSize - cornerInset, 0,
    -crossSize, -crossSize, 0,  -(crossSize - cornerInset), -crossSize, 0,
    -crossSize, -crossSize, 0,  -crossSize, -(crossSize - cornerInset), 0,
     crossSize, -crossSize, 0,   crossSize - cornerInset,  -crossSize, 0,
     crossSize, -crossSize, 0,   crossSize, -(crossSize - cornerInset), 0,
    -centerSize, 0, 0, centerSize, 0, 0,
    0, -centerSize, 0, 0, centerSize, 0
  ]);
  const crosshairGeometry = new THREE.BufferGeometry();
  crosshairGeometry.setAttribute('position', new THREE.BufferAttribute(crosshairPositions, 3));
  const crosshairMaterial = new THREE.LineBasicMaterial({
    color: MINIMAP.crosshairColor,
    transparent: true,
    opacity: MINIMAP.crosshairOpacity,
    depthTest: false,
    depthWrite: false,
    toneMapped: false
  });
  minimapCrosshair = new THREE.LineSegments(crosshairGeometry, crosshairMaterial);
  minimapCrosshair.frustumCulled = false;
  minimapOverlayScene.add(minimapCrosshair);

  initPhysics();
  initKeyboard();
  initCamInput();


  audioListener = new THREE.AudioListener();
  camera.add(audioListener);
  initThrusterAudio();

  window.addEventListener('resize', updateAspectRatio);
}

function initCollectibleUI() {
  const container = document.getElementById('container');
  if (!container) return;

  collectibleUI = document.createElement('div');
  collectibleUI.id = 'collectible-counter';
  Object.assign(collectibleUI.style, {
    position: 'fixed',
    top: '18px',
    right: '24px',
    padding: '10px 14px',
    borderRadius: '12px',
    background: 'rgba(0, 0, 0, 0.55)',
    color: '#ffe27a',
    fontFamily: 'system-ui, sans-serif',
    fontSize: '17px',
    letterSpacing: '0.4px',
    pointerEvents: 'none',
    userSelect: 'none',
    textShadow: '0 0 6px rgba(0,0,0,0.75)'
  });
  collectibleUI.textContent = 'Lunas restantes: --';
  container.appendChild(collectibleUI);
  updateCollectibleCounter();
}

function initGameOverOverlay() {
  if (gameOverOverlay) return;

  const container = document.getElementById('container');
  if (!container) return;

  const overlay = document.createElement('div');
  overlay.id = 'gameover-overlay';
  Object.assign(overlay.style, {
    position: 'fixed',
    inset: '0',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    pointerEvents: 'none',
    color: '#f4fbff',
    fontFamily: '"Segoe UI", system-ui, sans-serif',
    letterSpacing: '0.28em',
    textTransform: 'uppercase',
    fontSize: '26px',
    textShadow: '0 0 28px rgba(0,0,0,0.85)',
    background: 'radial-gradient(circle at 50% 50%, rgba(10, 32, 60, 0.52), rgba(2, 5, 12, 0.72))',
    opacity: '0',
    transition: 'opacity 0.45s ease',
    zIndex: '14'
  });
  overlay.textContent = '';
  container.appendChild(overlay);
  gameOverOverlay = overlay;
}

function initMinimapHUD() {
  if (minimapHUD) {
    updateMinimapHUDLayout();
    return;
  }

  const container = document.getElementById('container');
  if (!container) return;

  minimapHUD = document.createElement('div');
  minimapHUD.id = 'minimap-hud';
  Object.assign(minimapHUD.style, {
    position: 'fixed',
    pointerEvents: 'none',
    zIndex: '6',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
    overflow: 'hidden',
    color: '#c8e8ff',
    fontFamily: '"Segoe UI", system-ui, sans-serif',
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    fontSize: '11px',
    background: 'linear-gradient(180deg, rgba(8, 15, 25, 0.55) 0%, rgba(5, 8, 14, 0.22) 100%)',
    border: '1px solid rgba(102, 210, 255, 0.45)',
    borderRadius: '16px',
    boxShadow: '0 18px 36px rgba(0,0,0,0.45)',
    backdropFilter: 'blur(6px)',
    opacity: '0',
    transition: 'opacity 0.3s ease'
  });

  minimapHUDHeader = document.createElement('div');
  Object.assign(minimapHUDHeader.style, {
    padding: '6px 12px',
    fontSize: '11px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    background: 'linear-gradient(90deg, rgba(38, 104, 168, 0.66) 0%, rgba(76, 196, 255, 0.35) 100%)',
    borderBottom: '1px solid rgba(86, 178, 255, 0.35)',
    color: '#e4f5ff'
  });

  const title = document.createElement('span');
  title.textContent = MINIMAP.label || 'ROVER CAM';
  title.style.fontWeight = '600';

  minimapHUDStatus = document.createElement('span');
  minimapHUDStatus.textContent = (MINIMAP.statusPrefix || 'LINK') + ' :: OFFLINE';
  minimapHUDStatus.style.fontWeight = '600';
  minimapHUDStatus.style.fontSize = '10px';
  minimapHUDStatus.style.color = '#ff8c8c';

  minimapHUDHeader.appendChild(title);
  minimapHUDHeader.appendChild(minimapHUDStatus);
  minimapHUD.appendChild(minimapHUDHeader);

  minimapHUDPlanet = document.createElement('div');
  Object.assign(minimapHUDPlanet.style, {
    padding: '6px 12px 4px',
    fontSize: '10px',
    color: '#98cfff'
  });
  minimapHUDPlanet.textContent = 'PLANETA :: ---';
  minimapHUD.appendChild(minimapHUDPlanet);

  const telemetryRow = document.createElement('div');
  Object.assign(telemetryRow.style, {
    padding: '0 12px 10px',
    fontSize: '10px',
    display: 'flex',
    justifyContent: 'space-between',
    gap: '12px',
    color: '#a6dbff'
  });

  minimapHUDAlt = document.createElement('span');
  minimapHUDAlt.textContent = 'ALT ---';
  minimapHUDVel = document.createElement('span');
  minimapHUDVel.textContent = 'VEL ---';
  telemetryRow.appendChild(minimapHUDAlt);
  telemetryRow.appendChild(minimapHUDVel);
  minimapHUD.appendChild(telemetryRow);

  container.appendChild(minimapHUD);
  updateMinimapHUDLayout();
}

function updateMinimapHUDLayout() {
  if (!minimapHUD || !renderer) return;

  const ratio = typeof renderer.getPixelRatio === 'function'
    ? renderer.getPixelRatio()
    : (window.devicePixelRatio || 1);

  const border = MINIMAP.border ?? 0;
  const pad = MINIMAP.pad ?? 0;
  const w = MINIMAP.w ?? 200;
  const h = MINIMAP.h ?? 200;
  const outerW = w + border * 2;
  const outerH = h + border * 2;

  if (
    minimapHUDLayoutCache.ratio === ratio &&
    minimapHUDLayoutCache.w === outerW &&
    minimapHUDLayoutCache.h === outerH &&
    minimapHUDLayoutCache.pad === pad &&
    minimapHUDLayoutCache.border === border
  ) {
    return;
  }

  minimapHUDLayoutCache.ratio = ratio;
  minimapHUDLayoutCache.w = outerW;
  minimapHUDLayoutCache.h = outerH;
  minimapHUDLayoutCache.pad = pad;
  minimapHUDLayoutCache.border = border;

  const cssW = outerW / ratio;
  const cssH = outerH / ratio;
  const cssPad = pad / ratio;
  const cssRadius = Math.max(12, (border / ratio) * 1.1);

  minimapHUD.style.width = cssW + 'px';
  minimapHUD.style.height = cssH + 'px';
  minimapHUD.style.right = cssPad + 'px';
  minimapHUD.style.bottom = cssPad + 'px';
  minimapHUD.style.borderRadius = cssRadius + 'px';
}

function updateMinimapHUDTelemetry(planet, altitude, speed) {
  if (!minimapHUD) return;

  const prefix = MINIMAP.statusPrefix || 'LINK';

  if (!planet) {
    minimapHUD.style.opacity = '0';
    if (minimapHUDStatus) {
      minimapHUDStatus.textContent = prefix + ' :: OFFLINE';
      minimapHUDStatus.style.color = '#ff8c8c';
    }
    if (minimapHUDPlanet) minimapHUDPlanet.textContent = 'PLANETA :: ---';
    if (minimapHUDAlt) minimapHUDAlt.textContent = 'ALT ---';
    if (minimapHUDVel) minimapHUDVel.textContent = 'VEL ---';
    return;
  }

  minimapHUD.style.opacity = '1';

  if (minimapHUDStatus) {
    minimapHUDStatus.textContent = prefix + ' :: ONLINE';
    minimapHUDStatus.style.color = '#7ceefe';
  }

  if (minimapHUDPlanet) {
    const planetName = planet.name ? planet.name.toUpperCase() : '---';
    minimapHUDPlanet.textContent = 'PLANETA :: ' + planetName;
  }

  if (minimapHUDAlt) {
    const altText = Number.isFinite(altitude) ? Math.round(altitude) + ' m' : '---';
    minimapHUDAlt.textContent = 'ALT ' + altText;
  }

  if (minimapHUDVel) {
    const speedText = Number.isFinite(speed) ? speed.toFixed(1) + ' m/s' : '---';
    minimapHUDVel.textContent = 'VEL ' + speedText;
  }
}

function triggerGameOver(message = 'ROVER DESTRUIDO') {
  if (gameOver) return;

  gameOver = true;

  Object.keys(keys).forEach((key) => { keys[key] = false; });

  if (thruster && typeof thruster.stop === 'function') {
    try { thruster.stop(); } catch (e) { }
    try { thruster.setVolume(0); } catch (e) { }
  }
  _thrusterVol = 0;
  climb.active = false;

  if (thrusterFX && thrusterFX.group) {
    thrusterFX.group.visible = false;
  }

  initGameOverOverlay();
  if (gameOverOverlay) {
    gameOverOverlay.textContent = message;
    gameOverOverlay.style.opacity = '1';
  }

  updateMinimapHUDTelemetry(null, null, null);

  setTimeout(() => {
    if (typeof window !== 'undefined' && window?.location?.reload) {
      try {
        window.location.reload();
      } catch (err) {
        console.warn('No se pudo recargar la página automáticamente:', err);
      }
    }
  }, GAME_OVER_RESTART_MS);
}

function updateCollectibleCounter() {
  if (!collectibleUI) return;
  const total = collectibleSpawns.length;
  const remaining = Math.max(0, total - collectiblesCollected);

  if (!total) {
    collectibleUI.textContent = 'Lunas restantes: --';
  } else if (remaining === 0) {
    collectibleUI.textContent = 'Todas las lunas recolectadas!';
  } else {
    collectibleUI.textContent = `Lunas restantes: ${remaining}`;
  }
}

function initKeyboard() {
  window.addEventListener('keydown', (e) => {
    if (e.code === 'KeyW' || e.code === 'ArrowUp') keys.w = true;
    if (e.code === 'KeyS' || e.code === 'ArrowDown') keys.s = true;
    if (e.code === 'KeyA' || e.code === 'ArrowLeft') keys.a = true;
    if (e.code === 'KeyD' || e.code === 'ArrowRight') keys.d = true;
    if (audioListener?.context?.state === 'suspended') {
      audioListener.context.resume();
    }

    if (e.code === 'Space') {
      keys.space = true;


      if (!climb.active && isGrounded(roverBody, currentPlanet)) {
        climb.active = true;
        climb.t = 0;
      }
    }


    if (e.code === 'KeyC') {
      keys.c = true;
      climb.active = false;
    }


    if (e.code === 'KeyV') {
      cameraControls.enabled = !cameraControls.enabled;
    }
  });

  window.addEventListener('keyup', (e) => {
    if (e.code === 'KeyW' || e.code === 'ArrowUp') keys.w = false;
    if (e.code === 'KeyS' || e.code === 'ArrowDown') keys.s = false;
    if (e.code === 'KeyA' || e.code === 'ArrowLeft') keys.a = false;
    if (e.code === 'KeyD' || e.code === 'ArrowRight') keys.d = false;
    if (e.code === 'Space') keys.space = false;
    if (e.code === 'KeyC') keys.c = false;
  });
}

function setupRoverWheels(root) {
  roverWheelInfos = [];
  if (!root) return;

  root.updateMatrixWorld(true);

  const wheelConfig = [
    { name: 'Cylinder021', sideSign:  1, steer: true, offset: new THREE.Vector3(7, 1.1, 6.5) },
    { name: 'Cylinder022', sideSign:  1, steer: false, offset: new THREE.Vector3(7, 1.1, 0.75) },
    { name: 'Cylinder023', sideSign:  1, steer: false, offset: new THREE.Vector3(7, 1.1, -8.5) },

    { name: 'Cylinder012', sideSign: -1, steer: true, offset: new THREE.Vector3(-7, 1.1, 6.5) },
    { name: 'Cylinder011', sideSign: -1, steer: false, offset: new THREE.Vector3(-7, 1.1, 0.75) },
    { name: 'Cylinder020', sideSign: -1, steer: false, offset: new THREE.Vector3(-7, 1.1, -8.5) }
  ];

  const geometryCache = new Map();
  const getWheelGeometry = (radius, width) => {
    const key = radius.toFixed(3) + '_' + width.toFixed(3);
    if (!geometryCache.has(key)) {
      const geom = new THREE.CylinderGeometry(radius, radius, width, 32, 1, false);
      geom.rotateZ(Math.PI / 2);
      geometryCache.set(key, geom);
    }
    return geometryCache.get(key);
  };

  const infos = [];
  for (const cfg of wheelConfig) {
    const original = root.getObjectByName(cfg.name);
    if (!original) {
      console.warn('No se encontro la malla de rueda ' + cfg.name + ' en el rover.');
      continue;
    }

    original.updateWorldMatrix(true, false);

    TMP_BOX.setFromObject(original);
    TMP_BOX.getSize(TMP_SIZE);
    const radius = Math.max(1, Math.max(TMP_SIZE.y, TMP_SIZE.z) * 0.3);
    const width = Math.max(1, 2);

    const worldPos = new THREE.Vector3();
    original.getWorldPosition(worldPos);
    const localPos = worldPos.clone();
    root.worldToLocal(localPos);


    const finalPos = cfg.offset ? cfg.offset.clone() : localPos;

    original.removeFromParent();

    const pivot = new THREE.Object3D();
    pivot.name = cfg.name + '_pivot';
    pivot.position.copy(finalPos);
    root.add(pivot);

    const rollPivot = new THREE.Object3D();
    rollPivot.name = cfg.name + '_roll';
    pivot.add(rollPivot);


    const wheelMesh = new THREE.Mesh(getWheelGeometry(radius, width), new THREE.MeshStandardMaterial({
      color: 0x000000,
      metalness: 0.5,
      roughness: 0.5
    }));
    if (cfg.sideSign < 0) wheelMesh.rotation.y = Math.PI;
    wheelMesh.castShadow = true;
    wheelMesh.receiveShadow = true;
    rollPivot.add(wheelMesh);

    infos.push({
      pivot,
      roll: rollPivot,
      mesh: wheelMesh,
      radius,
      localPos: finalPos.clone(),
      spinAngle: 0,
      steerAngle: 0,
      isSteer: cfg.steer,
      sideSign: cfg.sideSign
    });
  }

  if (!infos.length) {
    console.warn('No fue posible reconstruir las ruedas del rover.');
  }

  roverWheelInfos = infos;
}

function updateRoverWheels(dt, up) {
  if (!player || !roverBody || !roverWheelInfos.length) return;

  const bodyVelocity = TMP_VEC_A.set(
    roverBody.velocity.x,
    roverBody.velocity.y,
    roverBody.velocity.z
  );

  const fwd = roverHeading.clone().addScaledVector(up, -roverHeading.dot(up));
  if (fwd.lengthSq() < 1e-10) return;
  fwd.normalize();

  const angular = TMP_VEC_C.set(
    roverBody.angularVelocity.x,
    roverBody.angularVelocity.y,
    roverBody.angularVelocity.z
  );

  const bodyPos = TMP_VEC_D.set(
    roverBody.position.x,
    roverBody.position.y,
    roverBody.position.z
  );

  const steerSmooth = Math.min(1, dt * 12);

  for (const wheel of roverWheelInfos) {
    const targetSteer = wheel.isSteer ? roverSteerAngle : 0;
    wheel.steerAngle += (targetSteer - wheel.steerAngle) * steerSmooth;
    wheel.pivot.rotation.set(0, wheel.steerAngle, 0);

    wheel.pivot.getWorldPosition(TMP_VEC_E);
    const rel = TMP_VEC_F.copy(TMP_VEC_E).sub(bodyPos);
    const wheelVelocity = TMP_VEC_G.copy(angular).cross(rel).add(bodyVelocity);
    const forwardSpeed = wheelVelocity.dot(fwd);

    const spinDelta = (forwardSpeed * dt) / wheel.radius;
    wheel.spinAngle -= spinDelta;
    wheel.roll.rotation.set(wheel.spinAngle, 0, 0);
  }
}
function initPhysics() {
  world = new CANNON.World();
  world.gravity.set(0, 0, 0);
  world.broadphase = new CANNON.NaiveBroadphase();
  world.solver.iterations = 10;

  planetMat = new CANNON.Material('planet');
  roverMat = new CANNON.Material('rover');

  const contact = new CANNON.ContactMaterial(planetMat, roverMat, {
    friction: 300,
    restitution: 0.0
  });
  world.addContactMaterial(contact);
}

function spawnRoverOnPlanet({
  planetName = 'Nivalis',
  latDeg = 8,
  lonDeg = 120,
  heightMeters = 1.6,
  altitudeOffset = 12
} = {}) {
  const planet = getPlanetByName(planetName);
  if (!planet || !planet.body) {
    console.warn('No se encontró el planeta para spawnear el rover:', planetName);
    return;
  }

  gameOver = false;
  if (gameOverOverlay) {
    gameOverOverlay.style.opacity = '0';
    gameOverOverlay.textContent = '';
  }

  const lat = THREE.MathUtils.degToRad(latDeg);
  const lon = THREE.MathUtils.degToRad(lonDeg);
  const localUp = new THREE.Vector3(
    Math.cos(lat) * Math.cos(lon),
    Math.sin(lat),
    Math.cos(lat) * Math.sin(lon)
  ).normalize();

  const planetCenter = new THREE.Vector3(
    planet.body.position.x,
    planet.body.position.y,
    planet.body.position.z
  );
  const surfacePoint = planetCenter.clone().addScaledVector(localUp, planet.radius);
  const spawn = surfacePoint.clone().addScaledVector(localUp, altitudeOffset);

  roverSpawnPoint  = spawn.clone();
  roverDesiredHeight = heightMeters;


  if (player) finalizeRoverMeshPlacement();

  if (roverBody) {
    try { world.removeBody(roverBody); } catch { }
  }

  roverBody = new CANNON.Body({
    mass: 100,
    material: roverMat,
    shape: new CANNON.Box(new CANNON.Vec3(13, 8, 16)),
    linearDamping: 0.55,
    angularDamping: 0.85
  });
  roverBody.position.set(spawn.x, spawn.y, spawn.z);
  world.addBody(roverBody);

  currentPlanet = planet;
  previousPlanet = planet;
  planetTransitionT = 1.0;

  const any = Math.abs(localUp.y) < 0.99 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0);
  roverHeading.copy(any.cross(localUp)).normalize();

  const camUp = localUp.clone();
  const extraLift = (FOLLOW?.postLookLift ?? 0);
  const camPos = spawn.clone()
    .add(roverHeading.clone().negate().multiplyScalar(FOLLOW.back))
    .add(camUp.clone().multiplyScalar(FOLLOW.up + extraLift));

  camState.pos.copy(camPos);
  camState.up.copy(camUp);
  camState.heading.copy(roverHeading);
  camState.target.copy(spawn).addScaledVector(camUp, ROVER_VISUAL_OFFSET);

  camera.position.copy(camState.pos);
  const lookM = new THREE.Matrix4().lookAt(camState.pos, camState.target, camUp);
  camera.quaternion.setFromRotationMatrix(lookM);

  climb.active = false;
  climb.t = 0;
}



const fbxLoader = new THREE.FBXLoader();
fbxLoader.load('models/mars_explorer.fbx', (obj) => {
  player = obj;
  player.userData = player.userData || {};

  if (typeof applyRoverTextures === 'function') {
    applyRoverTextures(player);
  }


  player.traverse((child) => {
    if (child.isMesh) { child.castShadow = true; child.receiveShadow = true; }
  });


  const fx = makeThrusterFlame();
  thrusterFX = fx;
  fx.group.position.set(0, 5, 0);
  player.add(fx.group);


  if (thruster && thrusterLoaded) player.add(thruster);


  finalizeRoverMeshPlacement();


  setupRoverWheels(player);


  if (!player.parent) scene.add(player);


  tryUpdateCamTargetFromPlayer();

}, undefined, (err) => {
  console.error('No se pudo cargar el FBX del rover:', err);
});
;

function finalizeRoverMeshPlacement() {
  if (!player || !roverSpawnPoint) return;


  const bbox = new THREE.Box3().setFromObject(player);
  const sz = new THREE.Vector3(); bbox.getSize(sz);
  const s = sz.y > 1e-4 ? (roverDesiredHeight / sz.y) : 1;
  player.scale.set(s, s, s);
  player.updateMatrixWorld(true);


  player.position.copy(roverSpawnPoint);
  player.updateMatrixWorld(true);
}

function tryUpdateCamTargetFromPlayer() {
  if (!player) return;
  const bboxScaled = new THREE.Box3().setFromObject(player);
  const camTargetLocal = new THREE.Vector3();
  bboxScaled.getCenter(camTargetLocal);
  player.worldToLocal(camTargetLocal);
  player.userData.camTargetOffset = camTargetLocal.clone();

  if (camState?.target) {
    const worldCamTarget = camTargetLocal.clone();
    player.localToWorld(worldCamTarget);
    camState.target.copy(worldCamTarget);
  }
}

function loadScene() {
  scene.add(new THREE.AmbientLight(0xffffff, 0.25));
  const starLight = new THREE.PointLight(0xffffff, 0.6, 0);
  starLight.position.set(0, 0, 0);
  scene.add(starLight);

  sunDirLight = new THREE.DirectionalLight(0xffffff, 1.35);
  sunDirLight.position.set(4500, 6200, 2800);
  sunDirLight.target.position.set(0, 0, 0);
  sunDirLight.castShadow = true;
  sunDirLight.shadow.mapSize.set(4096, 4096);
  sunDirLight.shadow.camera.near = 500;
  sunDirLight.shadow.camera.far = 20000;
  sunDirLight.shadow.camera.left = -6000;
  sunDirLight.shadow.camera.right = 6000;
  sunDirLight.shadow.camera.top = 6000;
  sunDirLight.shadow.camera.bottom = -6000;
  sunDirLight.shadow.bias = -0.0004;
  scene.add(sunDirLight);
  scene.add(sunDirLight.target);

  const manager = new THREE.LoadingManager(() => {
    assetsLoaded = true;
    if (startButtonEl) {
      startButtonEl.disabled = false;
      startButtonEl.classList.remove('loading');
      startButtonEl.textContent = startButtonLabel || 'Iniciar viaje';
      startButtonEl.focus();
    }
    tryBeginExperience();
  });

  const textureCache = new Map();
  const loader = new THREE.TextureLoader(manager);
  const colladaLoader = new THREE.ColladaLoader(manager);

  const MAX_ANISO = Math.min(renderer.capabilities.getMaxAnisotropy?.() || 4, 8);

  const loadSRGB = (path) => {
    if (!textureCache.has(path)) {
      const t = loader.load(path);
      t.encoding = THREE.sRGBEncoding;
      t.anisotropy = MAX_ANISO;
      textureCache.set(path, t);
    }
    return textureCache.get(path);
  };
  const loadLinear = (path) => {
    if (!textureCache.has(path)) {
      const t = loader.load(path);
      t.encoding = THREE.LinearEncoding;
      t.anisotropy = MAX_ANISO;
      textureCache.set(path, t);
    }
    return textureCache.get(path);
  };

  const duplicatedUvCache = new WeakSet();

  applyRoverTextures = (root) => {
    if (!root) return;

    const baseTex = loadSRGB('textures/rover/DefaultMaterial_Base_color.png');
    const normalTex = loadLinear('textures/rover/DefaultMaterial_Normal.png');
    const roughTex = loadLinear('textures/rover/DefaultMaterial_Roughness.png');
    const metalTex = loadLinear('textures/rover/DefaultMaterial_Metallic.png');
    const aoTex = loadLinear('textures/rover/DefaultMaterial_Mixed_AO.png');

    const makeMaterial = () => {
      const mat = new THREE.MeshPhysicalMaterial({
        map: baseTex,
        normalMap: normalTex,
        roughnessMap: roughTex,
        metalnessMap: metalTex,
        aoMap: aoTex,
        metalness: 0.5,
        roughness: 0.3,
        clearcoat: 0.6,
        clearcoatRoughness: 0.1
      });
      mat.envMapIntensity = 2.0;


      mat.envMapIntensity = 2.0;


      if (mat.normalMap) mat.normalScale.set(1.15, 1.15);

      return mat;
    };

    const baseMaterial = makeMaterial();

    root.traverse((child) => {
      if (!child.isMesh) return;

      if (child.geometry && child.geometry.attributes?.uv && !child.geometry.attributes.uv2) {
        if (!duplicatedUvCache.has(child.geometry)) {
          child.geometry.setAttribute('uv2', child.geometry.attributes.uv.clone());
          duplicatedUvCache.add(child.geometry);
        }
      }

      const assignMaterial = () => {
        const mat = baseMaterial.clone();
        mat.needsUpdate = true;
        return mat;
      };

      if (Array.isArray(child.material)) {
        child.material = child.material.map(() => assignMaterial());
      } else {
        child.material = assignMaterial();
      }

      child.castShadow = true;
      child.receiveShadow = true;
    });
  };

  const applyCollectibleTextures = (root) => {
    if (!root) return;

    const materialFactory = () => {
      const mat = new THREE.MeshStandardMaterial({
        map: loadSRGB('textures/powermoon/DefaultMaterial_albedo.jpg'),
        normalMap: loadLinear('textures/powermoon/DefaultMaterial_normal.jpg'),
        roughnessMap: loadLinear('textures/powermoon/DefaultMaterial_roughness.jpg'),
        metalnessMap: loadLinear('textures/powermoon/DefaultMaterial_metallic.jpg'),
        aoMap: loadLinear('textures/powermoon/DefaultMaterial_AO.jpg'),
        emissiveMap: loadSRGB('textures/powermoon/DefaultMaterial_emissive.jpg'),
        emissive: new THREE.Color(0xfff6c9),
        emissiveIntensity: 3.5,
        metalness: 1.0,
        roughness: 1.0
      });
      mat.toneMapped = false;
      mat.envMapIntensity = 1.0;
      return mat;
    };

    root.traverse((child) => {
      if (child.isMesh) {
        if (child.geometry && child.geometry.attributes?.uv && !child.geometry.attributes.uv2) {
          if (!duplicatedUvCache.has(child.geometry)) {
            child.geometry.setAttribute('uv2', child.geometry.attributes.uv.clone());
            duplicatedUvCache.add(child.geometry);
          }
        }
        child.material = materialFactory();
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });
  };

  const addRingAlpha = (planetMesh, { inner, outer, alphaPath, color = 0xDDD6C5, tilt = 0 }) => {
    const g = new THREE.RingGeometry(inner, outer, 96);
    const pos = g.attributes.position;
    const uvs = [];
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), y = pos.getY(i);
      const r = Math.hypot(x, y);
      uvs.push((r - inner) / (outer - inner), 0.5);
    }
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    const mat = new THREE.MeshBasicMaterial({
      color, alphaMap: loadLinear(alphaPath),
      transparent: true, depthWrite: false, side: THREE.DoubleSide
    });
    const ring = new THREE.Mesh(g, mat);
    ring.rotation.x = Math.PI / 2;
    ring.rotation.z = tilt;
    planetMesh.add(ring);
  };



  const PLANET_ORBIT_RADIUS = 5200;
  const PLANET_ORBIT_DIAGONAL = PLANET_ORBIT_RADIUS * Math.SQRT1_2;

  const createPlanet = ({ name, radius, position, mapPath, ringAlpha, brightness = false, surfaceG = 10, collectibles: spawnConfigs = [] }) => {
    const lod = new THREE.LOD();

    const mat = brightness
      ? new THREE.MeshBasicMaterial({ map: loadSRGB(mapPath) })
      : new THREE.MeshStandardMaterial({ map: loadSRGB(mapPath), roughness: 1.0, metalness: 0.0 });

    const hi = new THREE.Mesh(new THREE.SphereGeometry(radius, 192, 192), mat);
    const md = new THREE.Mesh(new THREE.SphereGeometry(radius, 96, 96), mat);
    const lo = new THREE.Mesh(new THREE.SphereGeometry(radius, 48, 48), mat);

    lod.addLevel(hi, 0);
    lod.addLevel(md, radius * 6);
    lod.addLevel(lo, radius * 12);

    lod.position.copy(position);
    scene.add(lod);
    if (ringAlpha) addRingAlpha(hi, ringAlpha);


    const body = new CANNON.Body({
      mass: 0,
      material: planetMat,
      shape: new CANNON.Sphere(radius)
    });
    body.position.set(position.x, position.y, position.z);
    world.addBody(body);



    const mu = surfaceG * radius * radius;

    const planet = { name, radius, mesh: lod, body, surfaceG, mu };
    planets.push(planet);
    if (name === 'Sol') { starMesh = lod; currentPlanet = planet; }

    lod.userData = { type: 'planet', name, radius, landingRadius: radius };

    for (const spawn of spawnConfigs) {
      registerCollectibleSpawn({ planetName: name, ...spawn });
    }

    return lod;
  };

  createPlanet({
    name: 'Aresis',
    radius: 900,
    position: new THREE.Vector3(PLANET_ORBIT_RADIUS, 0, 0),
    mapPath: 'textures/5672_mars_12k_color.jpg',
    surfaceG: 80,
    collectibles: [
      { latDeg: 18, lonDeg: 42, altitudeFactor: 0.14, spinSpeed: THREE.MathUtils.degToRad(70) },
      { latDeg: -26, lonDeg: 210, altitudeFactor: 0.12, bobHz: 0.42 }
    ]
  });
  createPlanet({
    name: 'Nivalis',
    radius: 880,
    position: new THREE.Vector3(PLANET_ORBIT_DIAGONAL, 0, PLANET_ORBIT_DIAGONAL),
    mapPath: 'textures/8k_moon.jpg',
    surfaceG: 55,
    collectibles: [
      { latDeg: 62, lonDeg: 118, altitudeFactor: 0.1, bobAmplitude: 35 }
    ]
  });
  createPlanet({
    name: 'Zephyria',
    radius: 940,
    position: new THREE.Vector3(0, 0, PLANET_ORBIT_RADIUS),
    mapPath: 'textures/8k_venus_surface.jpg',
    surfaceG: 87,
    collectibles: [
      { latDeg: -8, lonDeg: 300, altitudeFactor: 0.11 },
      { latDeg: 24, lonDeg: 140, altitudeFactor: 0.16, pickupRadius: 180 }
    ]
  });
  createPlanet({
    name: 'Volturn',
    radius: 870,
    position: new THREE.Vector3(-PLANET_ORBIT_DIAGONAL, 0, PLANET_ORBIT_DIAGONAL),
    mapPath: 'textures/8k_mercury.jpg',
    surfaceG: 110,
    collectibles: [
      { latDeg: 12, lonDeg: 60, altitudeFactor: 0.18, spinSpeed: THREE.MathUtils.degToRad(90) }
    ]
  });
  {
    const borealisRadius = 950;
    createPlanet({
      name: 'Borealis',
      radius: borealisRadius,
      position: new THREE.Vector3(-PLANET_ORBIT_RADIUS, 0, 0),
      mapPath: 'textures/8k_saturn.jpg',
      ringAlpha: {
        inner: borealisRadius * 1.3,
        outer: borealisRadius * 2.0,
        alphaPath: 'textures/8k_saturn_ring_alpha.png',
        color: 0xDED7C2,
        tilt: 0.2
      },
      surfaceG: 100,
      collectibles: [
        { latDeg: 8, lonDeg: 32, altitudeFactor: 0.1, bobAmplitude: 60 },
        { latDeg: -32, lonDeg: 250, altitudeFactor: 0.09, spinSpeed: THREE.MathUtils.degToRad(55) }
      ]
    });
  }
  createPlanet({
    name: 'Xanth',
    radius: 980,
    position: new THREE.Vector3(-PLANET_ORBIT_DIAGONAL, 0, -PLANET_ORBIT_DIAGONAL),
    mapPath: 'textures/8k_jupiter.jpg',
    surfaceG: 90,
    collectibles: [
      { latDeg: 30, lonDeg: 12, altitudeFactor: 0.13 },
      { latDeg: -18, lonDeg: 188, altitudeFactor: 0.15, bobHz: 0.28 }
    ]
  });
  createPlanet({
    name: 'Azure',
    radius: 920,
    position: new THREE.Vector3(0, 0, -PLANET_ORBIT_RADIUS),
    mapPath: 'textures/2k_neptune.jpg',
    surfaceG: 60,
    collectibles: [
      { latDeg: -35, lonDeg: 80, altitudeFactor: 0.11, pickupRadius: 190 }
    ]
  });
  createPlanet({
    name: 'Cyanis',
    radius: 910,
    position: new THREE.Vector3(PLANET_ORBIT_DIAGONAL, 0, -PLANET_ORBIT_DIAGONAL),
    mapPath: 'textures/2k_uranus.jpg',
    surfaceG: 70,
    collectibles: [
      { latDeg: 42, lonDeg: 300, altitudeFactor: 0.09 }
    ]
  });
  createPlanet({
    name: 'Sol',
    radius: STAR_RADIUS,
    position: new THREE.Vector3(0, 0, 0),
    mapPath: 'textures/8k_sun.jpg',
    brightness: true,
    surfaceG: 100
  });

  colladaLoader.load(
    'models/model.dae',
    (collada) => {
      collectibleTemplate = collada.scene;
      applyCollectibleTextures(collectibleTemplate);
      prepareCollectibleTemplate(collectibleTemplate);
      spawnQueuedCollectibles();
    },
    undefined,
    (err) => console.error('No se pudo cargar models/model.dae:', err)
  );


  spawnRoverOnPlanet({ planetName: 'Nivalis', latDeg: 8, lonDeg: 120, heightMeters: 20, altitudeOffset: 14 });

  const tex = new THREE.TextureLoader().load('image.png');
  tex.encoding = THREE.sRGBEncoding;
  tex.mapping = THREE.EquirectangularReflectionMapping;
  scene.background = tex;
}

function prepareCollectibleTemplate(root) {
  if (!root) return;

  TMP_BOX.setFromObject(root);
  TMP_BOX.getSize(TMP_SIZE);
  const maxDim = Math.max(TMP_SIZE.x, TMP_SIZE.y, TMP_SIZE.z);
  if (maxDim > 0 && Number.isFinite(maxDim)) {
    const scale = COLLECTIBLE_TARGET_SIZE / maxDim;
    root.scale.multiplyScalar(scale);
  }

  root.traverse((child) => {
    if (child.isMesh) {
      child.castShadow = true;
      child.receiveShadow = true;
    }
  });

  root.updateMatrixWorld(true);
}

function registerCollectibleSpawn(spawn) {
  if (!spawn || !spawn.planetName) return;
  const entry = { ...spawn, spawned: false };
  collectibleSpawns.push(entry);
  trySpawnCollectible(entry);
  updateCollectibleCounter();
}

function spawnQueuedCollectibles() {
  for (const entry of collectibleSpawns) {
    trySpawnCollectible(entry);
  }
}

function trySpawnCollectible(entry) {
  if (!collectibleTemplate || entry.spawned) return;
  if (spawnCollectible(entry)) {
    entry.spawned = true;
  }
}

function spawnCollectible(entry) {
  const planet = planets.find((p) => p.name === entry.planetName);
  if (!planet) return null;

  const lat = THREE.MathUtils.degToRad(entry.latDeg ?? 0);
  const lon = THREE.MathUtils.degToRad(entry.lonDeg ?? 0);
  const up = new THREE.Vector3(
    Math.cos(lat) * Math.cos(lon),
    Math.sin(lat),
    Math.cos(lat) * Math.sin(lon)
  ).normalize();

  const altitude =
    entry.altitude != null
      ? entry.altitude
      : planet.radius * (entry.altitudeFactor ?? COLLECTIBLE_DEFAULTS.altitudeFactor);

  const center = getVec3From(planet.body.position);
  const basePos = center.addScaledVector(up, planet.radius + altitude);

  const instance = collectibleTemplate.clone(true);
  instance.traverse((child) => {
    if (child.isMesh) {
      if (Array.isArray(child.material)) {
        child.material = child.material.map((mat) => mat.clone());
      } else if (child.material) {
        child.material = child.material.clone();
      }
      child.castShadow = true;
      child.receiveShadow = true;
    }
  });

  const light = new THREE.PointLight(
    POWERMOON_LIGHT_COLOR,
    POWERMOON_LIGHT_INTENSITY,
    POWERMOON_LIGHT_DISTANCE,
    POWERMOON_LIGHT_DECAY
  );
  light.castShadow = false;
  light.name = `powermoonLight-${entry.planetName}-${collectibles.length}`;
  instance.add(light);

  instance.position.copy(basePos);
  instance.quaternion.setFromUnitVectors(WORLD_UP, up);
  instance.updateMatrixWorld(true);
  instance.name = `collectible-${entry.planetName}`;
  const baseQuaternion = instance.quaternion.clone();
  const initialSpin = entry.initialSpin ?? Math.random() * Math.PI * 2;

  scene.add(instance);

  collectibles.push({
    mesh: instance,
    planetName: entry.planetName,
    light,
    up,
    basePosition: basePos.clone(),
    spinSpeed: entry.spinSpeed ?? COLLECTIBLE_DEFAULTS.spinSpeed,
    bobAmplitude: entry.bobAmplitude ?? COLLECTIBLE_DEFAULTS.bobAmplitude,
    bobHz: entry.bobHz ?? COLLECTIBLE_DEFAULTS.bobHz,
    pickupRadius: entry.pickupRadius ?? COLLECTIBLE_DEFAULTS.pickupRadius,
    time: Math.random() * Math.PI * 2,
    spinAngle: initialSpin,
    baseQuaternion,
    collected: false
  });

  updateCollectibleCounter();
  return instance;
}

function updateCollectibles(dt) {
  if (!collectibles.length) return;

  let roverPos = null;
  if (roverBody) {
    roverPos = TMP_VEC_A.set(roverBody.position.x, roverBody.position.y, roverBody.position.z);
  }

  for (const item of collectibles) {
    if (item.collected) continue;

    item.time += dt;

    const bobOffset = Math.sin(item.time * item.bobHz * Math.PI * 2) * item.bobAmplitude;
    item.mesh.position.copy(item.basePosition);
    item.mesh.position.addScaledVector(item.up, bobOffset);

    item.spinAngle += item.spinSpeed * dt;
    TMP_QUAT_A.setFromAxisAngle(item.up, item.spinAngle);
    item.mesh.quaternion.copy(item.baseQuaternion);
    item.mesh.quaternion.multiply(TMP_QUAT_A);
    item.mesh.updateMatrixWorld(true);

    if (roverPos) {
      const dist = item.mesh.position.distanceTo(roverPos);
      if (dist <= item.pickupRadius) {
        item.collected = true;
        collectiblesCollected += 1;
        if (item.light && item.light.parent) {
          item.light.parent.remove(item.light);
        }
        scene.remove(item.mesh);
        console.log(
          `Collectible recogido (${collectiblesCollected}/${collectibleSpawns.length}) cerca de ${item.planetName}`
        );
        updateCollectibleCounter();
      }
    }
  }
}

function getVec3From(v) {
  return new THREE.Vector3(v.x, v.y, v.z);
}

const GROUND_EPS = 8;

function altitudeToPlanet(body, planet) {
  if (!body || !planet) return Infinity;
  const p = new THREE.Vector3(body.position.x, body.position.y, body.position.z);
  const c = new THREE.Vector3(
    planet.body.position.x, planet.body.position.y, planet.body.position.z
  );
  return p.distanceTo(c) - planet.radius;
}

function isGrounded(body, planet, eps = GROUND_EPS) {
  const alt = altitudeToPlanet(body, planet);
  return alt <= eps;
}

function gravityFromPlanetAt(planet, posW) {
  const c = getVec3From(planet.body.position);
  const rVec = c.sub(posW);
  const r2 = Math.max(rVec.lengthSq(), 1e-6);
  const acc = planet.mu / r2;
  return rVec.normalize().multiplyScalar(acc);
}

function totalGravityAt(posW) {
  const a = new THREE.Vector3();
  for (const p of planets) a.add(gravityFromPlanetAt(p, posW.clone()));
  return a;
}

function dominantPlanetAt(posW) {
  let best = null, bestAcc = -Infinity;
  for (const p of planets) {
    const a = gravityFromPlanetAt(p, posW.clone()).lengthSq();
    if (a > bestAcc) { bestAcc = a; best = p; }
  }
  return best;
}

function applyPlanetaryGravity(body) {
  const pos = new THREE.Vector3(body.position.x, body.position.y, body.position.z);



  let acc;
  if (currentPlanet) {
    acc = gravityFromPlanetAt(currentPlanet, pos);
  } else {

    acc = totalGravityAt(pos);
  }

  const F = acc.multiplyScalar(body.mass);
  body.applyForce(new CANNON.Vec3(F.x, F.y, F.z), body.position);
}

function applyRoverControls(body, dt, planetCenter, thrust = THRUST, turnSpeed = TURN_SPEED, gHere = 10, { allowYaw = true, grounded = false } = {}) {
  const p = new THREE.Vector3(body.position.x, body.position.y, body.position.z);
  const up = p.clone().sub(planetCenter).normalize();
  const vel = new THREE.Vector3(body.velocity.x, body.velocity.y, body.velocity.z);


  roverHeading.addScaledVector(up, -roverHeading.dot(up));
  if (roverHeading.lengthSq() < 1e-10) {
    const any = Math.abs(up.y) < 0.99 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0);
    roverHeading.copy(any.cross(up));
  }
  roverHeading.normalize();


  let yawDelta = 0;
  if (allowYaw) {
    if (keys.a) yawDelta += turnSpeed * dt;
    if (keys.d) yawDelta -= turnSpeed * dt;
  }
  if (yawDelta !== 0) roverHeading.applyAxisAngle(up, yawDelta).normalize();


  let input = 0;
  if (keys.w) input += 1;
  if (keys.s) input -= 1;
  if (input !== 0) {
    const fwd = roverHeading;
    const F = new CANNON.Vec3(fwd.x * thrust * input, fwd.y * thrust * input, fwd.z * thrust * input);
    body.applyForce(F, body.position);
  }




  if (keys.c) {
    climb.active = false;
    const FdownMag = gHere * DOWN_THRUST_MULT;
    const Fdown = up.clone().multiplyScalar(-FdownMag);
    body.applyForce(new CANNON.Vec3(Fdown.x, Fdown.y, Fdown.z), body.position);


  } else if (climb.active) {
    const t01 = Math.min(1, climb.t / TAKEOFF_RAMP_S);
    const smooth = t01 * t01 * (3 - 2 * t01);
    const vTarget = ASCENT_V_STD * smooth;

    vel.set(body.velocity.x, body.velocity.y, body.velocity.z);
    const vUp = vel.dot(up);

    const aCmd = gHere + CLIMB_GAIN * (vTarget - vUp);
    const F = up.clone().multiplyScalar(body.mass * aCmd);
    body.applyForce(new CANNON.Vec3(F.x, F.y, F.z), body.position);

    if (!keys.space && t01 >= 1) climb.active = false;


  } else if (keys.space) {
    const FupMag = gHere * UP_THRUST_MULT;
    const Fup = up.clone().multiplyScalar(FupMag);
    body.applyForce(new CANNON.Vec3(Fup.x, Fup.y, Fup.z), body.position);
  }

  if (grounded && input === 0 && !keys.space && !climb.active) {
    vel.set(body.velocity.x, body.velocity.y, body.velocity.z);
    const tangential = vel.clone().addScaledVector(up, -vel.dot(up));
    const tangentialSpeed = tangential.length();
    if (tangentialSpeed > 1e-4) {
      const brake = 1 - Math.exp(-ROVER_GROUND_BRAKE_HZ * dt);
      body.velocity.x -= tangential.x * brake;
      body.velocity.y -= tangential.y * brake;
      body.velocity.z -= tangential.z * brake;
      if (tangentialSpeed < 0.5) {
        const remainder = 1 - brake;
        body.velocity.x -= tangential.x * remainder;
        body.velocity.y -= tangential.y * remainder;
        body.velocity.z -= tangential.z * remainder;
      }
    }

    vel.set(body.velocity.x, body.velocity.y, body.velocity.z);
    const residual = vel.clone().addScaledVector(up, -vel.dot(up));
    if (residual.lengthSq() < 0.01) {
      body.velocity.x -= residual.x;
      body.velocity.y -= residual.y;
      body.velocity.z -= residual.z;
    }

    const ang = body.angularVelocity;
    const angDamp = Math.exp(-ROVER_GROUND_BRAKE_HZ * 0.5 * dt);
    ang.x *= angDamp;
    ang.y *= angDamp;
    ang.z *= angDamp;
    if (Math.abs(ang.x) < 0.01) ang.x = 0;
    if (Math.abs(ang.y) < 0.01) ang.y = 0;
    if (Math.abs(ang.z) < 0.01) ang.z = 0;
  }



}

function syncRoverMeshToBody(planetCenter) {
  if (!player || !roverBody) return;

  const bodyPos = new THREE.Vector3(roverBody.position.x, roverBody.position.y, roverBody.position.z);


  let up;
  if (previousPlanet && planetTransitionT < 1.0) {

    const prevCenter = new THREE.Vector3(
      previousPlanet.body.position.x,
      previousPlanet.body.position.y,
      previousPlanet.body.position.z
    );
    const upPrev = bodyPos.clone().sub(prevCenter).normalize();


    const upCurrent = bodyPos.clone().sub(planetCenter).normalize();


    up = new THREE.Vector3().lerpVectors(upPrev, upCurrent, planetTransitionT).normalize();
  } else {

    up = bodyPos.clone().sub(planetCenter).normalize();
  }

  const visualPos = bodyPos.clone().addScaledVector(up, ROVER_VISUAL_OFFSET);
  player.position.copy(visualPos);


  const fwd = roverHeading.clone().addScaledVector(up, -roverHeading.dot(up)).normalize();
  const right = up.clone().cross(fwd).normalize();
  fwd.copy(right.clone().cross(up)).normalize();

  player.up.copy(up);
  player.lookAt(player.position.clone().add(fwd));

  roverBody.quaternion.copy(player.quaternion);
}

function initCamInput() {
  const el = renderer.domElement;
  el.style.touchAction = 'none';

  el.addEventListener('pointerdown', onCamPointerDown);
  el.addEventListener('pointermove', onCamPointerMove);
  el.addEventListener('pointerup', onCamPointerUp);
  el.addEventListener('pointerleave', onCamPointerUp);
  el.addEventListener('wheel', onCamWheel, { passive: true });
}

let _lastX = 0, _lastY = 0;
function onCamPointerDown(e) {
  camDragging = true;
  _lastX = e.clientX;
  _lastY = e.clientY;
  try { renderer.domElement.setPointerCapture(e.pointerId); } catch { }
}
function onCamPointerMove(e) {
  if (!camDragging) return;
  const dx = e.clientX - _lastX;
  const dy = e.clientY - _lastY;
  _lastX = e.clientX;
  _lastY = e.clientY;


  camUserYaw += dx * ORBIT.sensitivity;
  camUserPitch += dy * ORBIT.sensitivity;


  camUserPitch = Math.max(ORBIT.pitchMin, Math.min(ORBIT.pitchMax, camUserPitch));
}
function onCamPointerUp(e) {
  camDragging = false;
  try { renderer.domElement.releasePointerCapture(e.pointerId); } catch { }
}
function onCamWheel(e) {

  FOLLOW.back = THREE.MathUtils.clamp(FOLLOW.back + e.deltaY * 0.25, 10, 2000);
}

function updateChaseCamera(dt) {

  if (cameraControls && cameraControls.enabled) {
    cameraControls.update();
    return;
  }
  if (!(roverBody && currentPlanet)) return;


  const roverPos = new THREE.Vector3(
    roverBody.position.x, roverBody.position.y, roverBody.position.z
  );
  const planetCenter = new THREE.Vector3(
    currentPlanet.body.position.x, currentPlanet.body.position.y, currentPlanet.body.position.z
  );


  let upDesired;
  if (previousPlanet && planetTransitionT < 1.0) {

    const prevCenter = new THREE.Vector3(
      previousPlanet.body.position.x,
      previousPlanet.body.position.y,
      previousPlanet.body.position.z
    );
    const upPrev = roverPos.clone().sub(prevCenter).normalize();


    const upCurrent = roverPos.clone().sub(planetCenter).normalize();


    upDesired = new THREE.Vector3().lerpVectors(upPrev, upCurrent, planetTransitionT).normalize();
  } else {

    upDesired = roverPos.clone().sub(planetCenter).normalize();
  }


  let headingDesired = roverHeading.clone().addScaledVector(upDesired, -roverHeading.dot(upDesired));
  if (headingDesired.lengthSq() < 1e-8) {
    headingDesired = new THREE.Vector3(1, 0, 0).cross(upDesired).normalize();
  } else {
    headingDesired.normalize();
  }


  const aPos = 1 - Math.exp(- (FOLLOW?.lerpPosHz ?? 6) * dt);
  const aRot = 1 - Math.exp(- (FOLLOW?.lerpRotHz ?? 8) * dt);
  const aTarget = 1 - Math.exp(- (FOLLOW?.lerpTargetHz ?? 10) * dt);


  camState.up.lerp(upDesired, aRot).normalize();
  camState.heading.lerp(headingDesired, aRot).normalize();


  if (!camDragging) {
    const aRet = 1 - Math.exp(- ORBIT.returnHz * dt);
    camUserYaw += (0 - camUserYaw) * aRet;
    camUserPitch += (0 - camUserPitch) * aRet;
  }


  const back = (FOLLOW?.back ?? 20);
  const height = (FOLLOW?.up ?? 200);


  const behindDir = camState.heading.clone().negate().normalize();


  const yaw = VIEW_BIAS.yaw + camUserYaw;
  const offsetDir = behindDir.clone().applyAxisAngle(camState.up, yaw);

  const right = camState.up.clone().cross(offsetDir).normalize();


  offsetDir.applyAxisAngle(right, camUserPitch).normalize();


  const extraLift = (FOLLOW?.postLookLift ?? 0);
  const desiredPos = roverPos.clone()
    .addScaledVector(offsetDir, back)
    .addScaledVector(camState.up, height + extraLift);

  let targetDesired;
  if (player && player.userData?.camTargetOffset) {
    player.updateMatrixWorld();
    targetDesired = player.localToWorld(TMP_VEC_H.copy(player.userData.camTargetOffset));
  } else {
    targetDesired = TMP_VEC_H.copy(roverPos).addScaledVector(camState.up, ROVER_VISUAL_OFFSET);
  }


  camState.pos.lerp(desiredPos, aPos);
  if (camState.target.lengthSq() === 0) camState.target.copy(targetDesired);
  camState.target.lerp(targetDesired, aTarget);


  const lookM = new THREE.Matrix4().lookAt(camState.pos, camState.target, camState.up);
  const qDesired = new THREE.Quaternion().setFromRotationMatrix(lookM);
  camera.quaternion.slerp(qDesired, aRot);

  camera.position.copy(camState.pos);

  camera.position.addScaledVector(camState.up, FOLLOW.postLookNudge);
}

function updateAspectRatio() {
  renderer.setSize(window.innerWidth, window.innerHeight);
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  updateMinimapHUDLayout();
}

function updateThrusterAudio(dt, upVec) {
  if (!thruster || !thrusterLoaded || !thruster.isPlaying) return;


  const targetVol = (keys.space || climb.active) ? THRUSTER_MAX_VOL : 0.0;


  const a = 1 - Math.exp(-THRUSTER_FADE_HZ * dt);
  _thrusterVol += (targetVol - _thrusterVol) * a;
  thruster.setVolume(Math.max(0, Math.min(1, _thrusterVol)));


  if (roverBody && upVec) {
    const vel = new THREE.Vector3(roverBody.velocity.x, roverBody.velocity.y, roverBody.velocity.z);
    const vUp = vel.dot(upVec);

    const t = THREE.MathUtils.clamp((vUp + ASCENT_V_STD) / (2 * ASCENT_V_STD), 0, 1);
    const rate = THREE.MathUtils.lerp(THRUSTER_MIN_RATE, THRUSTER_MAX_RATE, t);

    thruster.setPlaybackRate(rate);
  }
}

function update() {
  const dt = clock.getDelta();
  if (gameOver) return;
  if (climb.active) climb.t += dt;

  if (mixer) mixer.update(dt);

  if (roverBody && planets.length) {
    const pos = new THREE.Vector3(roverBody.position.x, roverBody.position.y, roverBody.position.z);

    const sun = getPlanetByName('Sol');
    if (sun && sun.body) {
      const sunCenter = TMP_VEC_I.set(sun.body.position.x, sun.body.position.y, sun.body.position.z);
      const killRadius = (sun.radius ?? STAR_RADIUS) + SUN_DESTRUCTION_MARGIN;
      if (pos.distanceTo(sunCenter) <= killRadius) {
        triggerGameOver('ROVER DESINTEGRADO');
        return;
      }
    }


    const dom = dominantPlanetAt(pos);
    if (dom && dom !== currentPlanet) {
      previousPlanet = currentPlanet;
      currentPlanet = dom;
      planetTransitionT = 0.0;
    }
    if (planetTransitionT < 1.0) {
      planetTransitionT = Math.min(1.0, planetTransitionT + PLANET_TRANSITION_SPEED * dt);
    }


    applyPlanetaryGravity(roverBody);


    const aDom = gravityFromPlanetAt(currentPlanet, pos);
    const gHere = aDom.length();


    const c = new THREE.Vector3(currentPlanet.body.position.x, currentPlanet.body.position.y, currentPlanet.body.position.z);
    const up = pos.clone().sub(c).normalize();
    const grounded = isGrounded(roverBody, currentPlanet);
    const velocity = new THREE.Vector3(
      roverBody.velocity.x,
      roverBody.velocity.y,
      roverBody.velocity.z
    );
    const tangentialVelocity = velocity.clone().addScaledVector(up, -velocity.dot(up));
    const movingTangentially = tangentialVelocity.length() > ROVER_MIN_STEER_SPEED;

    const allowYaw = !grounded || movingTangentially;
    const allowVisualSteer = grounded;

    applyRoverControls(roverBody, dt, c, THRUST, TURN_SPEED, gHere, { allowYaw, grounded });

    if (sunDirLight) {
      const targetPos = pos;
      sunDirLight.target.position.copy(targetPos);
      const dir = TMP_VEC_E.copy(targetPos);
      if (starMesh) dir.sub(starMesh.position);
      let dist = dir.length();
      if (dist < 1e-3) {
        dir.set(0, 1, 0);
        dist = SUN_DIR_LIGHT_OFFSET;
      } else {
        dir.multiplyScalar(1 / dist);
      }
      const offset = Math.max(600, Math.min(SUN_DIR_LIGHT_OFFSET, dist - 200));
      sunDirLight.position.copy(targetPos).addScaledVector(dir, -offset);
      sunDirLight.target.updateMatrixWorld();
      sunDirLight.shadow.camera.updateMatrixWorld();
    }


    updateSteer(dt, allowVisualSteer);


    updateRoverWheels(dt, up);
    updateThrusterAudio(dt, up);


    world.step(1 / 60, dt, 3);


    syncRoverMeshToBody(c);
    updateThrusterFX(dt );

  } else {
    if (world) world.step(1 / 60, dt, 3);
  }

  updateCollectibles(dt);
  updateChaseCamera(dt);
}

function updateThrusterFX(dt ) {
  if (!thrusterFX || !thrusterFX.group) return;


  let target = (keys.space || climb.active) ? 1.0 : 0.0;


  if (typeof _thrusterVol === 'number') {
    const v = THREE.MathUtils.clamp(_thrusterVol / (THRUSTER_MAX_VOL || 1), 0, 1);
    target = Math.max(target, v);
  }


  const ud = thrusterFX.group.userData;
  const a = 1 - Math.exp(-8.0 * dt);
  ud.intensity += (target - ud.intensity) * a;

  ud.flickerT += dt * 10.0;
  const flicker = 0.90 + 0.10 * Math.sin(ud.flickerT*3.1) * Math.sin(ud.flickerT*2.3);
  const k = ud.intensity * flicker;


  const coreH = 12 + 40*k, coreR = 3 + 7*k;
  const glowH = 20 + 80*k, glowR = 7 + 24*k;

  thrusterFX.core.scale.set(coreR, coreH, coreR);
  thrusterFX.glow.scale.set(glowR, glowH, glowR);


  thrusterFX.core.material.opacity = 0.35 + 0.65*k;
  thrusterFX.glow.material.opacity = 0.20 + 0.60*k;


  thrusterFX.group.visible = (ud.intensity > 0.02);
}

function render() {
  requestAnimationFrame(render);
  update();



  renderer.setViewport(0, 0, renderer.domElement.width, renderer.domElement.height);
  renderer.clear(true, true, true);
  renderer.render(scene, camera);


  renderMinimapUp();
}

let thrusterFX = null;

function createVerticalGradientTexture({
  size = 256,
  stops = [
    { r:255,g:255,b:255,a:1.00, t:0.00 },
    { r:255,g:170,b: 50,a:0.80, t:0.25 },
    { r:255,g: 90,b:  0,a:0.35, t:0.65 },
    { r:255,g:  0,b:  0,a:0.00, t:1.00 }
  ]
} = {}) {
  const cvs = document.createElement('canvas');
  cvs.width = 1; cvs.height = size;
  const ctx = cvs.getContext('2d');
  const grd = ctx.createLinearGradient(0,0,0,size);
  for (const s of stops) grd.addColorStop(s.t, `rgba(${s.r},${s.g},${s.b},${s.a})`);
  ctx.fillStyle = grd;
  ctx.fillRect(0,0,1,size);
  const tex = new THREE.CanvasTexture(cvs);
  tex.encoding = THREE.sRGBEncoding;
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.needsUpdate = true;
  return tex;
}

function makeThrusterFlame() {
  const group = new THREE.Group();
  group.name = 'thrusterFX';


  const coreTex = createVerticalGradientTexture();
  const glowTex = createVerticalGradientTexture({
    stops: [
      { r:255,g:255,b:255,a:0.65, t:0.00 },
      { r:255,g:170,b: 50,a:0.35, t:0.35 },
      { r:255,g: 80,b:  0,a:0.12, t:0.80 },
      { r:255,g:  0,b:  0,a:0.00, t:1.00 }
    ]
  });


  const unitCone = new THREE.ConeGeometry(1, 1, 24, 1, true);
  unitCone.translate(0, -0.5, 0);

  const commonMat = {
    map: null,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide
  };

  const core = new THREE.Mesh(
    unitCone.clone(),
    new THREE.MeshBasicMaterial({ ...commonMat, map: coreTex, opacity: 0.8 })
  );
  const glow = new THREE.Mesh(
    unitCone.clone(),
    new THREE.MeshBasicMaterial({ ...commonMat, map: glowTex, opacity: 0.6 })
  );


  glow.renderOrder = 1;
  core.renderOrder = 2;

  group.add(glow);
  group.add(core);

  group.userData = { intensity: 0, flickerT: Math.random()*10 };

  return { group, core, glow };
}

init();
loadScene();

