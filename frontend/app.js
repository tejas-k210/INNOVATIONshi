/**
 * CellPulse — Physics-Informed Battery Intelligence & Second-Life Assessment
 * Complete Client-Side Application Logic:
 * - View & Modal State Management
 * - Live Mini dQ/dV Canvas Preview
 * - Interactive 3D Virtual Battery Pack (Three.js with OrbitControls & Raycasting)
 * - Synchronized Diagnostic Charts (Chart.js) with Signal Smoothing Toggle
 * - Second-Life Application Matcher & Dynamic Valuation Calculator
 * - CSV Ingestion & Traceable Assessment Report Generator
 */

// Global Application State
const state = {
  currentView: 'overview',
  activePreset: 'battery_a',
  analysisData: null,
  selectedCellId: 1,
  smoothingEnabled: true,
  filterFlaggedOnly: false,
  valuationCurrency: 'INR',
  comparisonPresets: null,
  uploadedFile: null,
  charts: {
    dqdv: null,
    rul: null
  },
  three: {
    scene: null,
    camera: null,
    renderer: null,
    controls: null,
    cellsMeshes: [],
    highlightMesh: null,
    hoveredMesh: null,
    raycaster: new THREE.Raycaster(),
    mouse: new THREE.Vector2(),
    isInitialized: false,
    animFrameId: null
  }
};

// Innovation Tab Descriptions (View 1)
const INNOVATION_PILLARS = [
  {
    title: "1. Battery Health & Signal Integrity Checks",
    desc: "Automated verification of constant-current (CC) and constant-voltage (CV) charge profiles. Detects sudden voltage spikes, series string capacity divergence, step timing anomalies, and thermal hotspots that reveal deteriorating internal components.",
    features: [
      "Series string voltage divergence tracking",
      "Thermal hotspot & gradient detection",
      "Sensor noise filtering & validation",
      "Early warning weak-link identification"
    ]
  },
  {
    title: "2. Physics-Informed Incremental Capacity Analysis (dQ/dV)",
    desc: "Transforms raw charging voltage and cumulative capacity into differential dQ/dV phase-transition curves. Measures the shift in the primary peak (ΔV_peak) caused by internal overpotential (ΔV = I·ΔR) and peak amplitude loss directly indicating Loss of Lithium Inventory (LLI) and Loss of Active Material (LAM).",
    features: [
      "Lithium intercalation phase transition tracking",
      "Savitzky-Golay signal smoothing to eliminate noise",
      "Direct measurement of internal resistance rise (ΔV_peak)",
      "Comparison against fresh-cell reference baselines"
    ]
  },
  {
    title: "3. Degradation Trajectory & RUL Projection",
    desc: "Physics-guided empirical power-law modeling predicts historical capacity fade and forecasts remaining useful life (RUL) under standardized 0.5C daily cycling before hitting stationary second-life retirement thresholds (70% and 60% SOH).",
    features: [
      "Remaining useful cycle count estimation",
      "Non-linear knee point degradation forecasting",
      "Ambient temperature & C-rate normalization",
      "Multi-year second-life service life projection"
    ]
  },
  {
    title: "4. Interactive 3D Pack & Cell-Level Digital Twin",
    desc: "An intuitive 3D spatial model of the 24-cell EV module (4x6 matrix). Visualizes cell-by-cell temperature gradients, individual internal resistance, and estimated health states. Clicking any cell immediately inspects its distinct diagnostic curves.",
    features: [
      "24 individual cell digital twins (4x6 matrix)",
      "Interactive 3D hover HUD and click inspection",
      "Color-coded health triage (Healthy, Moderate, Flagged)",
      "One-click anomaly filtering to isolate weak links"
    ]
  },
  {
    title: "5. Second-Life Matching & Indicative Valuation",
    desc: "Multi-criteria decision engine matching packs to Stationary Solar Energy Storage, Telecom Standby Backup, or Direct Material Recycling. Includes an interactive cost-benefit calculator comparing repurposing net value against immediate scrap recovery.",
    features: [
      "Suitability scoring for 4 second-life pathways",
      "Interactive economic assumptions (INR ₹ / USD $)",
      "Transparent net value advantage calculation",
      "Avoided manufacturing CO₂e environmental accounting"
    ]
  }
];

// Document Initialization
document.addEventListener('DOMContentLoaded', () => {
  initHeroMiniCanvas();
  selectInnoTab(0);
  initValuationSliders();
  fetchInitialData();
});

/* ==========================================================================
   VIEW NAVIGATION & ROUTING
   ========================================================================== */
function switchView(viewName) {
  state.currentView = viewName;
  const overviewView = document.getElementById('viewOverview');
  const workspaceView = document.getElementById('viewWorkspace');
  const btnNavOverview = document.getElementById('btnNavOverview');
  const btnLaunchWorkspace = document.getElementById('btnLaunchWorkspace');

  if (viewName === 'workspace') {
    overviewView.classList.remove('active');
    workspaceView.classList.add('active');
    btnNavOverview.classList.remove('active');
    btnLaunchWorkspace.classList.add('active');

    // Initialize 3D canvas and Chart.js if first time opening workspace
    window.scrollTo({ top: 0, behavior: 'smooth' });
    setTimeout(() => {
      if (!state.three.isInitialized) {
        initThreeDCanvas();
      } else {
        handle3DResize();
      }
      renderCharts();
    }, 100);
  } else {
    workspaceView.classList.remove('active');
    overviewView.classList.add('active');
    btnNavOverview.classList.add('active');
    btnLaunchWorkspace.classList.remove('active');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
}

function scrollToSection(sectionId) {
  if (state.currentView !== 'overview') {
    switchView('overview');
    setTimeout(() => {
      const el = document.getElementById(sectionId);
      if (el) el.scrollIntoView({ behavior: 'smooth' });
    }, 200);
  } else {
    const el = document.getElementById(sectionId);
    if (el) el.scrollIntoView({ behavior: 'smooth' });
  }
}

function runDemoStoryMode() {
  switchView('workspace');
  setTimeout(() => {
    openComparisonDrawer();
  }, 250);
}

function openUploadModalFromHome() {
  switchView('workspace');
  setTimeout(() => {
    openUploadModal();
  }, 250);
}

function jumpToStep(stepNum) {
  switchView('workspace');
  setTimeout(() => {
    if (stepNum === 1) {
      openUploadModal();
    } else if (stepNum === 2) {
      switchChartTab('dqdv');
      document.getElementById('panelDiagnostics')?.scrollIntoView({ behavior: 'smooth' });
    } else if (stepNum === 3) {
      reset3DCamera();
      document.getElementById('panel3D')?.scrollIntoView({ behavior: 'smooth' });
    } else if (stepNum === 4) {
      document.getElementById('secondLifePanel')?.scrollIntoView({ behavior: 'smooth' });
    }
  }, 250);
}

/* ==========================================================================
   VIEW 1: HERO MINI dQ/dV CANVAS PREVIEW
   ========================================================================== */
function initHeroMiniCanvas() {
  const canvas = document.getElementById('miniDqdvCanvas');
  if (!canvas) return;
  updateMiniDqdv(100);
}

function updateMiniDqdv(sohVal) {
  const canvas = document.getElementById('miniDqdvCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const w = canvas.width;
  const h = canvas.height;
  const soh = parseFloat(sohVal);

  // Update slider labels
  const label = document.getElementById('demoAgeLabel');
  const desc = document.getElementById('demoAgeDesc');
  if (label) {
    if (soh >= 95) label.textContent = `Fresh (${soh}% SOH)`;
    else if (soh >= 80) label.textContent = `Moderate Ageing (${soh}% SOH)`;
    else label.textContent = `High Degradation (${soh}% SOH)`;
  }

  if (desc) {
    const shift = Math.round((1.0 - (soh / 100.0)) * 165);
    if (soh >= 85) {
      desc.textContent = `At ${soh}% SOH: Minimal shift (+${shift} mV). Healthy active material with high phase transition peak.`;
    } else if (soh >= 75) {
      desc.textContent = `At ${soh}% SOH: Noticeable shift (+${shift} mV). Peak height declines due to Loss of Lithium Inventory.`;
    } else {
      desc.textContent = `At ${soh}% SOH: Severe shift (+${shift} mV). Resistance rise creates heavy polarization and peak collapse.`;
    }
  }

  // Draw background & axes
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = '#FAFCFA';
  ctx.fillRect(0, 0, w, h);

  // Grid lines
  ctx.strokeStyle = '#E3EBE6';
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let x = 40; x < w - 20; x += 60) {
    ctx.moveTo(x, 15);
    ctx.lineTo(x, h - 30);
  }
  for (let y = 30; y < h - 30; y += 40) {
    ctx.moveTo(40, y);
    ctx.lineTo(w - 20, y);
  }
  ctx.stroke();

  // Axis Labels
  ctx.fillStyle = '#8BA199';
  ctx.font = '10px JetBrains Mono, monospace';
  ctx.fillText('3.2V', 40, h - 14);
  ctx.fillText('3.6V', 150, h - 14);
  ctx.fillText('3.9V', 270, h - 14);
  ctx.fillText('4.2V', 380, h - 14);
  ctx.fillText('dQ/dV (Ah/V)', 10, 18);

  const getX = (v) => 40 + ((v - 3.20) / 1.0) * (w - 70);
  const getY = (yVal) => (h - 32) - (yVal / 20.0) * (h - 55);

  // 1. Fresh baseline curve (dashed sage line)
  ctx.beginPath();
  ctx.setLineDash([4, 4]);
  ctx.strokeStyle = '#74A857';
  ctx.lineWidth = 1.8;
  for (let i = 0; i <= 80; i++) {
    const v = 3.20 + (i / 80) * 1.0;
    const p1 = 18.2 * Math.exp(-0.5 * Math.pow((v - 3.885) / 0.075, 2));
    const p2 = 7.5 * Math.exp(-0.5 * Math.pow((v - 3.65) / 0.11, 2));
    const tail = 1.2 + 0.8 * (v - 3.2);
    const dQdV = p1 + p2 + tail;
    const x = getX(v);
    const y = getY(dQdV);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();
  ctx.setLineDash([]);

  // 2. Simulated Aged Curve
  const sohRatio = soh / 100.0;
  const peakShift = (1.0 - sohRatio) * 0.165;
  const peakV = 3.885 + peakShift;
  const peakH = 18.2 * Math.pow(sohRatio, 1.35);
  const peak2H = 7.5 * Math.pow(sohRatio, 1.2);
  const peak2V = 3.65 + (1.0 - sohRatio) * 0.08;

  ctx.beginPath();
  ctx.strokeStyle = soh >= 80 ? '#2D6A4F' : (soh >= 70 ? '#E9C46A' : '#E76F51');
  ctx.lineWidth = 2.8;
  for (let i = 0; i <= 80; i++) {
    const v = 3.20 + (i / 80) * 1.0;
    const p1 = peakH * Math.exp(-0.5 * Math.pow((v - peakV) / 0.08, 2));
    const p2 = peak2H * Math.exp(-0.5 * Math.pow((v - peak2V) / 0.11, 2));
    const tail = (1.2 + 0.6 * (v - 3.2)) * sohRatio;
    const dQdV = p1 + p2 + tail;
    const x = getX(v);
    const y = getY(dQdV);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();

  // Peak marker dot
  const peakX = getX(peakV);
  const peakY = getY(peakH);
  ctx.beginPath();
  ctx.fillStyle = ctx.strokeStyle;
  ctx.arc(peakX, peakY, 5, 0, Math.PI * 2);
  ctx.fill();

  // Peak label
  ctx.fillStyle = '#132A22';
  ctx.font = 'bold 11px Plus Jakarta Sans';
  ctx.fillText(`Peak: ${peakV.toFixed(3)}V`, Math.min(peakX + 8, w - 90), peakY - 8);
}

/* ==========================================================================
   VIEW 1: INNOVATION TABS
   ========================================================================== */
function selectInnoTab(index) {
  const tabs = document.querySelectorAll('.inno-tab');
  tabs.forEach((t, i) => {
    if (i === index) t.classList.add('active');
    else t.classList.remove('active');
  });

  const p = INNOVATION_PILLARS[index];
  const box = document.getElementById('innoContentBox');
  if (!box || !p) return;

  box.innerHTML = `
    <h4 class="inno-content-title">
      <span>${p.title}</span>
    </h4>
    <p class="inno-content-desc">${p.desc}</p>
    <div class="inno-feature-list">
      ${p.features.map(f => `
        <div class="inno-feature-item">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#52B788" stroke-width="3"><polyline points="20 6 9 17 4 12"></polyline></svg>
          <span>${f}</span>
        </div>
      `).join('')}
    </div>
  `;
}

/* ==========================================================================
   BACKEND API INTEGRATION & DATA INITIALIZATION
   ========================================================================== */
async function fetchInitialData() {
  try {
    // 1. Fetch presets metadata
    const presetsRes = await fetch('/api/presets');
    if (presetsRes.ok) {
      const presetsData = await presetsRes.json();
      state.comparisonPresets = presetsData.presets;
    }

    // 2. Fetch default Battery A diagnostics
    await loadBatteryPreset('battery_a');
  } catch (err) {
    console.error('Failed to load initial data:', err);
  }
}

async function loadBatteryPreset(presetId) {
  state.activePreset = presetId;

  // Update preset buttons in control strip
  const btnA = document.getElementById('btnPresetA');
  const btnB = document.getElementById('btnPresetB');
  if (btnA && btnB) {
    if (presetId === 'battery_a') {
      btnA.classList.add('active');
      btnB.classList.remove('active');
    } else {
      btnB.classList.add('active');
      btnA.classList.remove('active');
    }
  }

  try {
    const res = await fetch(`/api/analyze/preset/${presetId}`, { method: 'POST' });
    if (!res.ok) throw new Error(`HTTP error ${res.status}`);
    const data = await res.json();
    state.analysisData = data;
    renderAllDiagnosticViews();
  } catch (err) {
    console.error(`Error loading preset ${presetId}:`, err);
  }
}

function renderAllDiagnosticViews() {
  if (!state.analysisData) return;
  const d = state.analysisData;

  // 1. Update Provenance Pill
  const provText = document.getElementById('provenanceText');
  if (provText) provText.textContent = d.provenance_pill || d.data_source_label;

  // 2. Update KPI Summary Ribbon
  const p = d.pack_summary;
  document.getElementById('kpiSohVal').textContent = `${p.soh_pct}%`;
  document.getElementById('kpiSohConf').textContent = p.soh_confidence_interval;
  document.getElementById('kpiCapacityVal').textContent = `${p.estimated_current_capacity_ah} Ah / ${p.nominal_capacity_ah} Ah`;
  document.getElementById('kpiSohBar').style.width = `${Math.min(100, Math.max(10, p.soh_pct))}%`;

  const rul = d.rul_trajectory;
  document.getElementById('kpiRulVal').textContent = rul.remaining_cycles_to_70_pct.toLocaleString();
  document.getElementById('kpiCurrentCycle').textContent = `Cycle #${p.current_cycle}`;

  const ica = d.ica_diagnostics;
  document.getElementById('kpiPeakShiftVal').textContent = `${ica.peak_shift_mv > 0 ? '+' : ''}${ica.peak_shift_mv} mV`;
  document.getElementById('kpiPeakVolt').textContent = `${ica.v_peak.toFixed(3)} V (Ref: ${ica.fresh_peak_v.toFixed(3)} V)`;
  const peakDesc = document.getElementById('kpiPeakShiftDesc');
  if (peakDesc) {
    if (ica.peak_shift_mv > 80) peakDesc.textContent = "High overpotential; severe polarization";
    else if (ica.peak_shift_mv > 40) peakDesc.textContent = "Moderate overpotential & impedance rise";
    else peakDesc.textContent = "Low overpotential; minimal resistance rise";
  }

  // Cells breakdown
  document.getElementById('pillHealthyCount').textContent = `${p.healthy_cells_count} Healthy`;
  document.getElementById('pillModerateCount').textContent = `${p.moderate_cells_count} Moderate`;
  document.getElementById('pillFlaggedCount').textContent = `${p.flagged_cells_count} Flagged`;
  const imbDesc = document.getElementById('cellImbalanceDesc');
  if (imbDesc) {
    if (p.has_flagged_cells) imbDesc.textContent = `Anomaly detected in Cell #${p.flagged_cell_ids.join(', #')}!`;
    else imbDesc.textContent = "Uniform cell voltage & thermal distribution";
  }

  // Recommended next step badge
  const recBadge = document.getElementById('kpiRecBadge');
  const recDesc = document.getElementById('kpiRecRationale');
  if (recBadge) {
    recBadge.textContent = p.recommended_next_step;
    recBadge.className = `kpi-rec-badge ${p.recommendation_badge_type}-rec`;
  }
  if (recDesc) {
    recDesc.textContent = d.second_life_decision.top_recommendation;
  }

  // 3. Update 3D Pack Cell Colors & State
  update3DCellsMeshColors();

  // 4. Update Selected Cell Inspector (default to Cell #14 if flagged, else Cell #1)
  const defaultCellId = p.has_flagged_cells ? (p.flagged_cell_ids[0] || 1) : 1;
  selectCell(defaultCellId);

  // 5. Update Synchronized Charts
  renderCharts();

  // 6. Update Second-Life Suitability Cards
  renderSecondLifePathways();

  // 7. Update Valuation Visuals
  renderValuation();
}

/* ==========================================================================
   VIEW 2: THREE.JS 3D VIRTUAL BATTERY PACK (4x6 GRID = 24 CELLS)
   ========================================================================== */
function initThreeDCanvas() {
  const container = document.getElementById('canvas3DWrapper');
  const canvas = document.getElementById('threeCanvas');
  if (!container || !canvas) return;

  const width = container.clientWidth || 600;
  const height = container.clientHeight || 480;

  // Scene
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xF5FBF8);
  state.three.scene = scene;

  // Camera
  const camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 1000);
  camera.position.set(0, 8.5, 9.5);
  state.three.camera = camera;

  // Renderer
  const renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, alpha: true });
  renderer.setSize(width, height);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  state.three.renderer = renderer;

  // Controls
  const controls = new THREE.OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.maxPolarAngle = Math.PI / 2.05; // Prevent flipping under ground
  controls.minDistance = 4.0;
  controls.maxDistance = 16.0;
  controls.target.set(0, 0, 0);
  state.three.controls = controls;

  // Lighting
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.82);
  scene.add(ambientLight);

  const keyLight = new THREE.DirectionalLight(0xffffff, 0.75);
  keyLight.position.set(5, 12, 8);
  keyLight.castShadow = true;
  keyLight.shadow.mapSize.width = 1024;
  keyLight.shadow.mapSize.height = 1024;
  scene.add(keyLight);

  const fillLight = new THREE.DirectionalLight(0xA8E6CF, 0.4);
  fillLight.position.set(-6, 6, -4);
  scene.add(fillLight);

  // Studio Ground Disc
  const groundGeo = new THREE.CylinderGeometry(8.5, 8.5, 0.1, 48);
  const groundMat = new THREE.MeshStandardMaterial({
    color: 0xE8F5EE,
    roughness: 0.85,
    metalness: 0.05
  });
  const ground = new THREE.Mesh(groundGeo, groundMat);
  ground.position.y = -0.55;
  ground.receiveShadow = true;
  scene.add(ground);

  // Module Metal Casing / Enclosure
  buildBatteryPackCasing(scene);

  // Build 24 Prismatic Cells (4 rows x 6 cols)
  build24Cells(scene);

  // Highlight Box / Outline for Selected Cell
  const highlightGeo = new THREE.BoxGeometry(0.72, 1.25, 0.72);
  const highlightMat = new THREE.MeshBasicMaterial({
    color: 0x1B4332,
    wireframe: true,
    transparent: true,
    opacity: 0.95
  });
  const highlightMesh = new THREE.Mesh(highlightGeo, highlightMat);
  highlightMesh.visible = false;
  scene.add(highlightMesh);
  state.three.highlightMesh = highlightMesh;

  // Event Listeners for Raycasting
  canvas.addEventListener('mousemove', onCanvasMouseMove);
  canvas.addEventListener('click', onCanvasMouseClick);
  canvas.addEventListener('mouseleave', onCanvasMouseLeave);

  // ResizeObserver for clean dynamic resizing
  const resizeObserver = new ResizeObserver(() => {
    handle3DResize();
  });
  resizeObserver.observe(container);

  state.three.isInitialized = true;

  // Animation Loop
  function animate() {
    state.three.animFrameId = requestAnimationFrame(animate);
    controls.update();

    // Subtle gentle hover float for hovered cell
    if (state.three.hoveredMesh) {
      state.three.hoveredMesh.position.y = THREE.MathUtils.lerp(
        state.three.hoveredMesh.position.y,
        0.18,
        0.15
      );
    }
    // Return non-hovered cells to base Y = 0
    state.three.cellsMeshes.forEach(mesh => {
      if (mesh !== state.three.hoveredMesh) {
        mesh.position.y = THREE.MathUtils.lerp(mesh.position.y, 0, 0.15);
      }
    });

    // Update highlight box position to match selected cell
    const selectedMesh = state.three.cellsMeshes.find(m => m.userData.cellId === state.selectedCellId);
    if (selectedMesh) {
      highlightMesh.visible = true;
      highlightMesh.position.copy(selectedMesh.position);
    }

    renderer.render(scene, camera);
  }
  animate();
}

function buildBatteryPackCasing(scene) {
  // Main Module Tray (dimensions to house 4x6 cells with spacing)
  const trayGeo = new THREE.BoxGeometry(5.2, 0.4, 3.6);
  const trayMat = new THREE.MeshStandardMaterial({
    color: 0x2A3B34, // Dark industrial metallic finish
    roughness: 0.35,
    metalness: 0.75
  });
  const tray = new THREE.Mesh(trayGeo, trayMat);
  tray.position.y = -0.3;
  tray.receiveShadow = true;
  scene.add(tray);

  // Side Rails & End Brackets
  const railGeo = new THREE.BoxGeometry(5.3, 0.5, 0.15);
  const railMat = new THREE.MeshStandardMaterial({ color: 0x3E5249, roughness: 0.4, metalness: 0.6 });
  const rail1 = new THREE.Mesh(railGeo, railMat);
  rail1.position.set(0, -0.1, 1.85);
  scene.add(rail1);

  const rail2 = new THREE.Mesh(railGeo, railMat);
  rail2.position.set(0, -0.1, -1.85);
  scene.add(rail2);

  // Orange HV Warning Decal Strip
  const hvGeo = new THREE.BoxGeometry(1.2, 0.08, 0.02);
  const hvMat = new THREE.MeshBasicMaterial({ color: 0xF4A261 });
  const hvStrip = new THREE.Mesh(hvGeo, hvMat);
  hvStrip.position.set(0, -0.05, 1.93);
  scene.add(hvStrip);
}

function build24Cells(scene) {
  state.three.cellsMeshes = [];
  const cellGeo = new THREE.BoxGeometry(0.65, 1.15, 0.65);
  const terminalGeo = new THREE.CylinderGeometry(0.06, 0.06, 0.12, 12);
  const posTerminalMat = new THREE.MeshStandardMaterial({ color: 0xE76F51, metalness: 0.8 });
  const negTerminalMat = new THREE.MeshStandardMaterial({ color: 0x457B9D, metalness: 0.8 });

  // Grid offsets: 6 columns (X axis: -1.85 to +1.85), 4 rows (Z axis: -1.15 to +1.15)
  const xSpacing = 0.74;
  const zSpacing = 0.78;
  const startX = -((6 - 1) * xSpacing) / 2;
  const startZ = -((4 - 1) * zSpacing) / 2;

  for (let idx = 1; idx <= 24; idx++) {
    const row = Math.floor((idx - 1) / 6);
    const col = (idx - 1) % 6;
    const posX = startX + col * xSpacing;
    const posZ = startZ + row * zSpacing;

    // Default material: Mint Green
    const cellMat = new THREE.MeshStandardMaterial({
      color: 0x52B788,
      roughness: 0.35,
      metalness: 0.25,
      transparent: true,
      opacity: 1.0
    });

    const cellMesh = new THREE.Mesh(cellGeo, cellMat);
    cellMesh.position.set(posX, 0, posZ);
    cellMesh.castShadow = true;
    cellMesh.receiveShadow = true;
    cellMesh.userData = {
      cellId: idx,
      row: row,
      col: col,
      baseColor: 0x52B788,
      status: 'Healthy'
    };

    // Add cell terminals on top
    const termPos = new THREE.Mesh(terminalGeo, posTerminalMat);
    termPos.position.set(-0.16, 0.6, 0);
    cellMesh.add(termPos);

    const termNeg = new THREE.Mesh(terminalGeo, negTerminalMat);
    termNeg.position.set(0.16, 0.6, 0);
    cellMesh.add(termNeg);

    scene.add(cellMesh);
    state.three.cellsMeshes.push(cellMesh);
  }
}

function update3DCellsMeshColors() {
  if (!state.analysisData || !state.three.cellsMeshes.length) return;
  const cellsData = state.analysisData.cells;

  state.three.cellsMeshes.forEach(mesh => {
    const cell = cellsData.find(c => c.cell_id === mesh.userData.cellId);
    if (!cell) return;

    mesh.userData.status = cell.status;
    mesh.userData.cellData = cell;

    let hexColor = 0x52B788; // Mint
    if (cell.status === 'Flagged Anomaly') {
      hexColor = 0xE76F51; // Coral Red
    } else if (cell.status === 'Moderate Ageing') {
      hexColor = 0xE9C46A; // Warm Amber
    }

    mesh.userData.baseColor = hexColor;
    mesh.material.color.setHex(hexColor);

    // Apply filtering if active
    if (state.filterFlaggedOnly) {
      if (cell.status === 'Flagged Anomaly') {
        mesh.material.opacity = 1.0;
      } else {
        mesh.material.opacity = 0.18;
      }
    } else {
      mesh.material.opacity = 1.0;
    }
  });
}

function handle3DResize() {
  const container = document.getElementById('canvas3DWrapper');
  const camera = state.three.camera;
  const renderer = state.three.renderer;
  if (!container || !camera || !renderer) return;

  const w = container.clientWidth;
  const h = container.clientHeight;
  if (w === 0 || h === 0) return;

  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h);
}

function reset3DCamera() {
  const camera = state.three.camera;
  const controls = state.three.controls;
  if (!camera || !controls) return;

  camera.position.set(0, 8.5, 9.5);
  controls.target.set(0, 0, 0);
  controls.update();
}

function toggleFilterFlaggedOnly() {
  state.filterFlaggedOnly = !state.filterFlaggedOnly;
  const btn = document.getElementById('btnFilterFlagged');
  if (btn) btn.classList.toggle('active', state.filterFlaggedOnly);
  update3DCellsMeshColors();
}

/* 3D Raycasting & Mouse Interaction */
function onCanvasMouseMove(event) {
  const canvas = state.three.renderer?.domElement;
  if (!canvas) return;

  const rect = canvas.getBoundingClientRect();
  state.three.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  state.three.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

  state.three.raycaster.setFromCamera(state.three.mouse, state.three.camera);
  const intersects = state.three.raycaster.intersectObjects(state.three.cellsMeshes);

  const tooltip = document.getElementById('cellHudTooltip');

  if (intersects.length > 0) {
    const hitMesh = intersects[0].object;
    state.three.hoveredMesh = hitMesh;
    canvas.style.cursor = 'pointer';

    // Update HUD Tooltip
    if (tooltip && hitMesh.userData.cellData) {
      const c = hitMesh.userData.cellData;
      tooltip.style.display = 'block';
      document.getElementById('hudCellId').textContent = c.cell_name;
      const statusBadge = document.getElementById('hudStatusBadge');
      statusBadge.textContent = c.status;
      statusBadge.style.backgroundColor = c.status === 'Flagged Anomaly' ? 'rgba(231, 111, 81, 0.3)' : 'rgba(82, 183, 136, 0.25)';
      statusBadge.style.color = c.status === 'Flagged Anomaly' ? '#F4A261' : '#A8E6CF';

      document.getElementById('hudSoh').textContent = `${c.estimated_soh_pct}%`;
      document.getElementById('hudVoltage').textContent = `${c.voltage_v.toFixed(3)} V`;
      document.getElementById('hudIR').textContent = `${c.internal_resistance_mohm} mΩ`;
      document.getElementById('hudTemp').textContent = `${c.temperature_c}°C`;
    }
  } else {
    state.three.hoveredMesh = null;
    canvas.style.cursor = 'grab';
    if (tooltip) tooltip.style.display = 'none';
  }
}

function onCanvasMouseClick(event) {
  const canvas = state.three.renderer?.domElement;
  if (!canvas) return;

  const rect = canvas.getBoundingClientRect();
  state.three.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  state.three.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

  state.three.raycaster.setFromCamera(state.three.mouse, state.three.camera);
  const intersects = state.three.raycaster.intersectObjects(state.three.cellsMeshes);

  if (intersects.length > 0) {
    const hitMesh = intersects[0].object;
    selectCell(hitMesh.userData.cellId);
  }
}

function onCanvasMouseLeave() {
  state.three.hoveredMesh = null;
  const tooltip = document.getElementById('cellHudTooltip');
  if (tooltip) tooltip.style.display = 'none';
}

function selectCell(cellId) {
  state.selectedCellId = cellId;
  if (!state.analysisData) return;

  const cell = state.analysisData.cells.find(c => c.cell_id === cellId);
  if (!cell) return;

  // 1. Update Cell Inspector Card
  document.getElementById('inspCellBadge').textContent = cell.cell_name;
  document.getElementById('inspCellName').textContent = `Inspection: ${cell.cell_name} (Row ${cell.row + 1}, Col ${cell.col + 1})`;
  const statusPill = document.getElementById('inspStatusPill');
  statusPill.textContent = cell.status;
  statusPill.className = `insp-status ${cell.status === 'Flagged Anomaly' ? 'pill-flagged' : (cell.status === 'Moderate Ageing' ? 'pill-moderate' : 'pill-healthy')}`;

  document.getElementById('inspSoh').textContent = `${cell.estimated_soh_pct}%`;
  document.getElementById('inspVoltage').textContent = `${cell.voltage_v.toFixed(3)} V`;
  document.getElementById('inspIR').textContent = `${cell.internal_resistance_mohm} mΩ`;
  document.getElementById('inspTemp').textContent = `${cell.temperature_c}°C`;
  document.getElementById('inspIcaPeak').textContent = `${cell.ica_curve.v_peak.toFixed(3)} V`;
  document.getElementById('inspPeakShift').textContent = `${cell.ica_curve.peak_shift_mv > 0 ? '+' : ''}${cell.ica_curve.peak_shift_mv} mV`;

  // Anomaly warnings
  const anomBox = document.getElementById('inspAnomaliesBox');
  if (cell.is_flagged && cell.flag_reasons.length > 0) {
    anomBox.style.display = 'flex';
    anomBox.innerHTML = `
      <strong>⚠ Flagged Anomaly Details:</strong>
      ${cell.flag_reasons.map(r => `<div>• ${r}</div>`).join('')}
    `;
  } else {
    anomBox.style.display = 'none';
  }

  // 2. Update Inspection Target Tag in Charts
  const targetTag = document.getElementById('chartInspectionTarget');
  if (targetTag) {
    targetTag.textContent = `${cell.cell_name} Diagnostic Curve`;
  }

  // 3. Update Chart Curves
  updateChartsForSelectedCell(cell);
}

/* ==========================================================================
   VIEW 2: SYNCHRONIZED DIAGNOSTIC GRAPHS (Chart.js)
   ========================================================================== */
function switchChartTab(tabName) {
  const tabDqdv = document.getElementById('tabDqdv');
  const tabRul = document.getElementById('tabRul');
  const contDqdv = document.getElementById('containerDqdv');
  const contRul = document.getElementById('containerRul');
  const smoothingControl = document.getElementById('smoothingControl');

  if (tabName === 'dqdv') {
    tabDqdv.classList.add('active');
    tabRul.classList.remove('active');
    contDqdv.style.display = 'flex';
    contRul.style.display = 'none';
    if (smoothingControl) smoothingControl.style.display = 'flex';
  } else {
    tabRul.classList.add('active');
    tabDqdv.classList.remove('active');
    contRul.style.display = 'flex';
    contDqdv.style.display = 'none';
    if (smoothingControl) smoothingControl.style.display = 'none';
  }
}

function toggleSmoothing(isEnabled) {
  state.smoothingEnabled = isEnabled;
  const statusTag = document.getElementById('smoothingStatus');
  if (statusTag) {
    statusTag.textContent = isEnabled ? 'Savitzky-Golay ON' : 'Raw Data Only';
  }
  const cell = state.analysisData?.cells.find(c => c.cell_id === state.selectedCellId);
  if (cell) updateChartsForSelectedCell(cell);
}

function renderCharts() {
  if (!state.analysisData) return;
  const cell = state.analysisData.cells.find(c => c.cell_id === state.selectedCellId) || state.analysisData.cells[0];
  updateChartsForSelectedCell(cell);
  renderRulChart();
}

function updateChartsForSelectedCell(cell) {
  const ctx = document.getElementById('dqdvChart')?.getContext('2d');
  if (!ctx || !state.analysisData) return;

  const packIca = state.analysisData.ica_diagnostics;
  const cellIca = cell.ica_curve;
  const voltages = packIca.voltages;

  // Decide active curves based on smoothing toggle
  const inspectionCurve = state.smoothingEnabled ? cellIca.smoothed_dqdv : cellIca.raw_dqdv;
  const isAnomaly = cell.is_flagged;
  const strokeColor = isAnomaly ? '#E76F51' : (cell.status === 'Moderate Ageing' ? '#E9C46A' : '#52B788');

  if (state.charts.dqdv) {
    state.charts.dqdv.destroy();
  }

  state.charts.dqdv = new Chart(ctx, {
    type: 'line',
    data: {
      labels: voltages,
      datasets: [
        {
          label: 'Fresh Baseline Reference',
          data: packIca.baseline_dqdv,
          borderColor: '#8BA199',
          borderWidth: 1.8,
          borderDash: [5, 5],
          pointRadius: 0,
          fill: false,
          tension: 0.2
        },
        {
          label: 'Raw Measured Data',
          data: cellIca.raw_dqdv,
          borderColor: '#A8E6CF',
          backgroundColor: 'transparent',
          borderWidth: 1.2,
          pointRadius: state.smoothingEnabled ? 0 : 2.5,
          pointBackgroundColor: strokeColor,
          hidden: state.smoothingEnabled, // Faint or hidden when smoothed is active
          tension: 0
        },
        {
          label: `${cell.cell_name} Smoothed Curve`,
          data: inspectionCurve,
          borderColor: strokeColor,
          borderWidth: 2.6,
          pointRadius: 0,
          fill: {
            target: 'origin',
            above: isAnomaly ? 'rgba(231, 111, 81, 0.08)' : 'rgba(82, 183, 136, 0.08)'
          },
          tension: 0.35
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: 'rgba(8, 28, 21, 0.90)',
          titleFont: { family: 'Plus Jakarta Sans', size: 12 },
          bodyFont: { family: 'JetBrains Mono', size: 11 },
          callbacks: {
            title: (items) => `Voltage: ${items[0].label} V`,
            label: (item) => `${item.dataset.label}: ${item.formattedValue} Ah/V`
          }
        }
      },
      scales: {
        x: {
          title: { display: true, text: 'Cell Terminal Voltage (V)', font: { size: 11, weight: 'bold' }, color: '#5C766D' },
          grid: { color: '#E3EBE6' },
          ticks: { color: '#5C766D', maxTicksLimit: 8, font: { family: 'JetBrains Mono' } }
        },
        y: {
          title: { display: true, text: 'Incremental Capacity dQ/dV (Ah/V)', font: { size: 11, weight: 'bold' }, color: '#5C766D' },
          min: 0,
          grid: { color: '#E3EBE6' },
          ticks: { color: '#5C766D', font: { family: 'JetBrains Mono' } }
        }
      }
    }
  });
}

function renderRulChart() {
  const ctx = document.getElementById('rulChart')?.getContext('2d');
  if (!ctx || !state.analysisData) return;

  const rul = state.analysisData.rul_trajectory;

  // Combine historical and projected data points on shared X axis
  const allCycles = [...rul.historical_cycles, ...rul.projected_cycles];
  const histData = rul.historical_cycles.map((c, i) => ({ x: c, y: rul.historical_soh[i] }));
  const projData = rul.projected_cycles.map((c, i) => ({ x: c, y: rul.projected_soh[i] }));

  if (state.charts.rul) {
    state.charts.rul.destroy();
  }

  state.charts.rul = new Chart(ctx, {
    type: 'line',
    data: {
      datasets: [
        {
          label: 'Historical Capacity Fade',
          data: histData,
          borderColor: '#1B4332',
          borderWidth: 2.5,
          pointRadius: 2,
          pointBackgroundColor: '#1B4332',
          tension: 0.2
        },
        {
          label: 'Projected Degradation Trajectory',
          data: projData,
          borderColor: '#74A857',
          borderWidth: 2.2,
          borderDash: [6, 4],
          pointRadius: 0,
          tension: 0.3
        },
        {
          label: '70% SOH Second-Life Threshold',
          data: allCycles.map(c => ({ x: c, y: 70.0 })),
          borderColor: '#E76F51',
          borderWidth: 1.5,
          borderDash: [3, 3],
          pointRadius: 0
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: 'rgba(8, 28, 21, 0.90)',
          titleFont: { family: 'Plus Jakarta Sans', size: 12 },
          bodyFont: { family: 'JetBrains Mono', size: 11 },
          callbacks: {
            title: (items) => `Cycle #${items[0].raw.x}`,
            label: (item) => `${item.dataset.label}: ${item.raw.y}% SOH`
          }
        }
      },
      scales: {
        x: {
          type: 'linear',
          title: { display: true, text: 'Charge/Discharge Cycles', font: { size: 11, weight: 'bold' }, color: '#5C766D' },
          grid: { color: '#E3EBE6' },
          ticks: { color: '#5C766D', font: { family: 'JetBrains Mono' } }
        },
        y: {
          title: { display: true, text: 'State of Health (SOH %)', font: { size: 11, weight: 'bold' }, color: '#5C766D' },
          min: 40,
          max: 105,
          grid: { color: '#E3EBE6' },
          ticks: { color: '#5C766D', font: { family: 'JetBrains Mono' } }
        }
      }
    }
  });
}

/* ==========================================================================
   VIEW 2: SECOND-LIFE APPLICATION MATCHING
   ========================================================================== */
function renderSecondLifePathways() {
  const container = document.getElementById('pathwayCardsGrid');
  if (!container || !state.analysisData) return;

  const pathways = state.analysisData.second_life_decision.pathways;

  container.innerHTML = pathways.map(p => {
    let scoreClass = 'score-high';
    if (p.score < 50) scoreClass = 'score-low';
    else if (p.score < 75) scoreClass = 'score-mid';

    return `
      <div class="pathway-card">
        <div class="pathway-top">
          <div>
            <h4 class="pathway-title">${p.name}</h4>
            <span class="pathway-cat">${p.category}</span>
          </div>
          <span class="pathway-score-badge ${scoreClass}">${p.score} / 100</span>
        </div>
        <div class="pathway-bar-track">
          <div class="pathway-bar-fill" style="width: ${p.score}%;"></div>
        </div>
        <p class="pathway-tech-fit"><strong>Fit:</strong> ${p.technical_fit}</p>
      </div>
    `;
  }).join('');
}

/* ==========================================================================
   VIEW 2: INTERACTIVE VALUATION CALCULATOR
   ========================================================================== */
function initValuationSliders() {
  // Setup default labels
  onValuationSliderChange();
}

function setValuationCurrency(curr) {
  state.valuationCurrency = curr;
  document.getElementById('btnCurrINR')?.classList.toggle('active', curr === 'INR');
  document.getElementById('btnCurrUSD')?.classList.toggle('active', curr === 'USD');

  // Adjust default repurposing and recycling sliders for currency
  const repSlider = document.getElementById('valRepurposing');
  const recSlider = document.getElementById('valRecycling');

  if (curr === 'USD') {
    repSlider.min = 10;
    repSlider.max = 120;
    repSlider.step = 5;
    repSlider.value = 42;

    recSlider.min = 5;
    recSlider.max = 50;
    recSlider.step = 2;
    recSlider.value = 15;
  } else {
    repSlider.min = 500;
    repSlider.max = 10000;
    repSlider.step = 250;
    repSlider.value = 3500;

    recSlider.min = 300;
    recSlider.max = 4000;
    recSlider.step = 100;
    recSlider.value = 1200;
  }

  onValuationSliderChange();
}

async function onValuationSliderChange() {
  const capacity = parseFloat(document.getElementById('valCapacity').value);
  const repurposing = parseFloat(document.getElementById('valRepurposing').value);
  const efficiency = parseFloat(document.getElementById('valEfficiency').value);
  const years = parseFloat(document.getElementById('valYears').value);
  const recycling = parseFloat(document.getElementById('valRecycling').value);

  const sym = state.valuationCurrency === 'INR' ? '₹' : '$';

  // Update slider displays
  document.getElementById('valCapacityDisp').textContent = `${capacity.toFixed(1)} kWh`;
  document.getElementById('valRepurposingDisp').textContent = `${sym}${repurposing.toLocaleString()} / kWh`;
  document.getElementById('valEfficiencyDisp').textContent = `${efficiency}%`;
  document.getElementById('valYearsDisp').textContent = `${years.toFixed(1)} Years`;
  document.getElementById('valRecyclingDisp').textContent = `${sym}${recycling.toLocaleString()} / kWh`;

  const soh = state.analysisData?.pack_summary.soh_pct || 83.4;

  try {
    const res = await fetch('/api/recalculate-valuation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        usable_capacity_kwh: capacity,
        repurposing_cost_per_kwh: repurposing,
        efficiency_pct: efficiency,
        service_years: years,
        recycling_credit_per_kwh: recycling,
        currency: state.valuationCurrency,
        soh_pct: soh
      })
    });
    if (res.ok) {
      const val = await res.json();
      if (state.analysisData) state.analysisData.valuation = val;
      renderValuation();
    }
  } catch (err) {
    console.error('Failed to recalculate valuation:', err);
  }
}

function renderValuation() {
  const val = state.analysisData?.valuation;
  if (!val) return;

  document.getElementById('valSecondLifeNet').textContent = val.formatted_second_life_net;
  document.getElementById('valRecycleNet').textContent = val.formatted_recycling_value;

  const advEl = document.getElementById('valAdvantageVal');
  advEl.textContent = val.formatted_advantage;
  advEl.className = `adv-value ${val.advantage_positive ? 'color-mint-text' : 'color-red-text'}`;

  document.getElementById('valCo2Pill').textContent = `🌱 ~${val.avoided_co2e_kg.toLocaleString()} kg CO₂e Avoided`;
}

/* ==========================================================================
   MODAL 1: CSV UPLOAD HANDLING
   ========================================================================== */
function openUploadModal() {
  document.getElementById('modalUpload').style.display = 'flex';
}

function closeUploadModal() {
  document.getElementById('modalUpload').style.display = 'none';
  state.uploadedFile = null;
  const statusBox = document.getElementById('uploadStatusBox');
  if (statusBox) statusBox.style.display = 'none';
  document.getElementById('btnSubmitUpload').disabled = true;
}

function handleDragOver(e) {
  e.preventDefault();
  document.getElementById('csvDropzone')?.classList.add('dragover');
}

function handleDragLeave(e) {
  e.preventDefault();
  document.getElementById('csvDropzone')?.classList.remove('dragover');
}

function handleFileDrop(e) {
  e.preventDefault();
  document.getElementById('csvDropzone')?.classList.remove('dragover');
  if (e.dataTransfer.files.length > 0) {
    processSelectedFile(e.dataTransfer.files[0]);
  }
}

function handleFileSelected(e) {
  if (e.target.files.length > 0) {
    processSelectedFile(e.target.files[0]);
  }
}

function processSelectedFile(file) {
  if (!file.name.toLowerCase().endsWith('.csv')) {
    alert('Please select a valid CSV file (.csv).');
    return;
  }
  state.uploadedFile = file;
  const statusBox = document.getElementById('uploadStatusBox');
  statusBox.style.display = 'flex';
  document.getElementById('selectedFileName').textContent = file.name;
  document.getElementById('selectedFileSize').textContent = `${(file.size / 1024).toFixed(1)} KB`;
  document.getElementById('btnSubmitUpload').disabled = false;
}

async function submitUpload() {
  if (!state.uploadedFile) return;
  const submitBtn = document.getElementById('btnSubmitUpload');
  submitBtn.disabled = true;
  submitBtn.textContent = 'Analyzing Battery Signals...';

  const formData = new FormData();
  formData.append('file', state.uploadedFile);

  try {
    const res = await fetch('/api/analyze/upload', {
      method: 'POST',
      body: formData
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || 'Upload failed');
    }
    const data = await res.json();
    state.analysisData = data;
    closeUploadModal();
    renderAllDiagnosticViews();
    alert(`Successfully analyzed "${state.uploadedFile.name}"! SOH: ${data.pack_summary.soh_pct}%`);
  } catch (err) {
    alert(`Error analyzing file: ${err.message}`);
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = 'Run Full Diagnostics';
  }
}

/* ==========================================================================
   MODAL 2: TWO-BATTERY DEMO STORY COMPARISON
   ========================================================================== */
function openComparisonDrawer() {
  document.getElementById('modalComparison').style.display = 'flex';
}

function closeComparisonDrawer() {
  document.getElementById('modalComparison').style.display = 'none';
}

/* ==========================================================================
   MODAL 3: TRACEABLE DIAGNOSTIC REPORT (PRINT-READY)
   ========================================================================== */
function openTraceableReportModal() {
  if (!state.analysisData) return;
  const d = state.analysisData;
  const p = d.pack_summary;
  const val = d.valuation;

  document.getElementById('repId').textContent = d.assessment_id;
  document.getElementById('repDate').textContent = new Date().toISOString().replace('T', ' ').substring(0, 19) + ' UTC';
  document.getElementById('repProvenance').textContent = d.provenance_pill;

  document.getElementById('repSoh').textContent = `${p.soh_pct}% (${p.soh_confidence_interval})`;
  document.getElementById('repCycles').textContent = `${p.current_cycle} Recorded Cycles`;
  document.getElementById('repCapacity').textContent = `${p.estimated_current_capacity_ah} Ah / ${p.nominal_capacity_ah} Ah`;
  document.getElementById('repPeakV').textContent = `${d.ica_diagnostics.v_peak.toFixed(3)} V`;
  document.getElementById('repPeakShift').textContent = `${d.ica_diagnostics.peak_shift_mv > 0 ? '+' : ''}${d.ica_diagnostics.peak_shift_mv} mV`;
  document.getElementById('repCellSummary').textContent = `${p.healthy_cells_count} Healthy · ${p.moderate_cells_count} Moderate · ${p.flagged_cells_count} Flagged Anomalies`;

  // Flagged cell section
  const flagSec = document.getElementById('repFlaggedSection');
  const flagBox = document.getElementById('repFlaggedBox');
  if (p.has_flagged_cells) {
    flagSec.style.display = 'block';
    const flaggedCells = d.cells.filter(c => c.is_flagged);
    flagBox.innerHTML = flaggedCells.map(c => `
      <strong>${c.cell_name} (Row ${c.row + 1}, Col ${c.col + 1}):</strong>
      <div>• SOH: ${c.estimated_soh_pct}% | Temp: ${c.temperature_c}°C | IR: ${c.internal_resistance_mohm} mΩ</div>
      <div>• Anomalies: ${c.flag_reasons.join('; ')}</div>
    `).join('<hr style="margin: 0.5rem 0; border: none; border-top: 1px dashed #FCA5A5;">');
  } else {
    flagSec.style.display = 'none';
  }

  document.getElementById('repRecBadge').textContent = p.recommended_next_step;
  document.getElementById('repRulCycles').textContent = `${d.rul_trajectory.remaining_cycles_to_70_pct.toLocaleString()} cycles`;
  document.getElementById('repCo2').textContent = `~${val.avoided_co2e_kg.toLocaleString()} kg CO₂e`;
  document.getElementById('repNetVal').textContent = val.formatted_second_life_net;
  document.getElementById('repRecycleVal').textContent = val.formatted_recycling_value;
  document.getElementById('repAdvantageVal').textContent = val.formatted_advantage;

  document.getElementById('modalReport').style.display = 'flex';
}

function closeTraceableReportModal() {
  document.getElementById('modalReport').style.display = 'none';
}

function printReport() {
  window.print();
}

function downloadJsonReport() {
  if (!state.analysisData) return;
  const jsonStr = JSON.stringify(state.analysisData, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `CellPulse_Report_${state.analysisData.assessment_id}.json`;
  a.click();
  URL.revokeObjectURL(url);
}
