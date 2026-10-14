Initialize the "CellPulse — Physics-Informed Battery Intelligence & Second-Life Assessment" web application project.

Create a clean directory structure:
- `backend/`
  - `main.py` (FastAPI application serving REST endpoints and static frontend files)
  - `diagnostics.py` (Physics-informed Incremental Capacity Analysis dQ/dV, smoothing, degradation & RUL model, 24-cell pack mapping, second-life matcher, and reuse vs. recycling valuation engine)
- `data/`
  - `battery_a_moderate_ageing.csv` (Simulated EV pack history suitable for Second-Life Solar Energy Storage / Telecom Backup, ~83.4% SOH)
  - `battery_b_high_degradation.csv` (Simulated EV pack history with accelerated capacity fade and flagged cell #14 anomaly, ~64.2% SOH, suited for Recycling Assessment or low-demand backup)
- `frontend/`
  - `index.html`
  - `styles.css`
  - `app.js`
- `requirements.txt` (`fastapi`, `uvicorn`, `numpy`, `scipy`, `pandas`, `python-multipart`, `pydantic`)

Implement `backend/diagnostics.py` and `backend/main.py` with the following exact functionality:
1. Sample CSV Generator: On startup, if `data/battery_a_moderate_ageing.csv` and `data/battery_b_high_degradation.csv` do not exist, automatically generate them with realistic columns: `cycle`, `step_time_s`, `voltage_v`, `current_a`, `capacity_ah`, `temperature_c`.
2. Incremental Capacity Analysis (ICA) Engine:
   - Compute change in charge relative to voltage (`dQ/dV`) across the constant-current charging voltage window (3.2V to 4.2V).
   - Apply Savitzky-Golay or Gaussian smoothing to reduce measurement noise and return both raw and smoothed `dQ/dV` curves alongside reference fresh-cell baseline curves, peak voltage position (`V_peak`), peak height (`dQ/dV_max`), and peak shift indicators.
3. Degradation & Remaining Useful Life (RUL) Estimator:
   - Calculate current State of Health (SOH %), historical capacity fade trend across cycles, projected future degradation curve, and estimated Remaining Useful Cycles before reaching the second-life retirement threshold.
4. 24-Cell Virtual Pack Status Generator:
   - Generate cell-level diagnostic data for 24 cells (4 rows x 6 columns) based on the dataset, including cell voltage, estimated cell SOH %, internal resistance indicator, temperature, status (`Healthy`, `Moderate Ageing`, `Flagged Anomaly`), and cell-specific `dQ/dV` curve variations so clicking any cell in the 3D view shows distinct diagnostic data.
5. Second-Life Decision & Indicative Valuation Engine:
   - Evaluate suitability scores (0–100) and fit rationale for:
     a) Solar Energy Storage (Stationary C&I / Residential)
     b) Telecom Backup Power
     c) Continued EV Use
     d) Immediate Recycling Assessment
   - Accept customizable valuation assumptions (`integration_cost_per_kwh`, `usable_capacity_kwh`, `round_trip_efficiency_pct`, `expected_service_years`, `recycling_credit_per_kwh`) and calculate Indicative Reuse Net Value vs. Immediate Recycling Value with transparent cost-benefit breakdown.
6. API Endpoints in `backend/main.py`:
   - `GET /api/presets` -> Lists the two demo battery histories ("Battery A: Fleet EV Pack - Moderate Ageing" and "Battery B: Aged EV Pack - Flagged Cell Anomaly") for the Two-Battery Demo Story.
   - `POST /api/analyze/preset/{preset_id}` -> Runs full analysis on a preset dataset.
   - `POST /api/analyze/upload` -> Accepts a user-uploaded battery-cycle CSV, validates columns, and runs the full analysis pipeline.
   - `POST /api/recalculate-valuation` -> Dynamically recalculates indicative reuse vs. recycling value when the user adjusts assumption sliders.
   - Mount `frontend/` at the root `/` so running Uvicorn serves the entire application on `http://127.0.0.1:8000`.

Review all imports, array lengths, JSON serialization (convert all NumPy floats/arrays to standard Python types), and error handling carefully so there are zero runtime exceptions.
Build `frontend/index.html` and `frontend/styles.css` with a minimal, responsive, and highly interactive UI using a Pistachio (#93C572, #DCECCB) and Mint Green (#A8E6CF, #F4FBF7, #1B4332) design language.

Structure the application into two seamless top-level views controlled by a sticky navigation bar:
1. "Project Overview (Home)" — Active by default.
2. "Diagnostic & 3D Workspace" — Interactive analytical platform.

Requirements for View 1: "Project Overview (Home Page)" explaining the CellPulse project in brief:
1. Sticky Top Navbar:
   - Brand logo & badge: "CellPulse" with a subtle pulsing mint indicator and subtitle "Theme H: Smart Vehicles / EV Motor & Battery Technology".
   - Navigation pills: "Overview", "How It Works", "Who It Helps", and a primary pistachio-mint CTA button "Launch Diagnostic Workspace →".
2. Hero Section:
   - Tagline badge: "Diagnose the degradation. Predict the future. Unlock the next life."
   - Main Headline: "Physics-Informed Battery Intelligence & Second-Life Assessment"
   - One-Sentence Brief Card: "CellPulse studies how an EV battery is ageing, estimates how much useful life it may have left, and suggests whether it could be reused for another purpose instead of being discarded or immediately recycled."
   - Two interactive action buttons:
     - "Run Two-Battery Demo Story" (loads Battery A & Battery B comparison in the workspace)
     - "Upload Battery CSV" (switches to workspace upload dropzone)
   - Live Mini-Preview Card on the right showing an animated SVG/canvas dQ/dV curve shifting as a cell ages.
3. "The Problem & What Makes CellPulse Different" Interactive Split Section:
   - Left card (The Problem): Explains why ageing lithium-ion EV batteries lose storage capacity and why a single health percentage (SOH %) cannot explain internal condition, remaining useful life, or optimal next use.
   - Right card (The CellPulse Innovation): Interactive tabs highlighting the 5 core pillars:
     1) Battery Health Checks (voltage, current, time, capacity anomaly flagging)
     2) Physics-Informed ICA (`dQ/dV` charging-curve analysis with signal smoothing)
     3) Degradation & Remaining Useful Cycles Projection
     4) Interactive 3D Pack & Cell-Level Visual Inspection
     5) Second-Life Application Matching & Indicative Reuse vs. Recycling Valuation
4. Interactive 4-Step Prototype Workflow Stepper:
   - Clickable horizontal cards for:
     - `1. UPLOAD DATA` (Upload battery-cycle CSV or select clearly labelled simulated ageing datasets)
     - `2. ANALYSE` (Extract smoothed dQ/dV Incremental Capacity features and capacity fade trends)
     - `3. VISUALISE` (Inspect health estimates, diagnostic curves, and cell status in the interactive 3D battery pack)
     - `4. RECOMMEND` (Compare solar storage or telecom backup suitability, indicative valuation, and recycling with a traceable report)
5. "Who Uses CellPulse?" Interactive Persona Grid:
   - 4 interactive cards with hover elevation for:
     - EV Fleet Operators (Monitor condition & flag packs needing closer inspection)
     - Used-EV Buyers & Sellers (Review transparent battery-health evidence during vehicle assessment)
     - Renewable Energy Companies (Identify candidate packs for stationary solar energy storage)
     - Battery Recyclers (Screen batteries warranting reuse assessment vs. immediate recycling)
6. Transparency & Scientific Integrity Footer Banner:
   - Clearly highlights CellPulse's engineering guardrails: ICA features as diagnostic indicators, explicit labelling of simulated vs. measured cell data, and preliminary screening disclaimers.

Ensure `frontend/styles.css` uses CSS custom properties for the Pistachio & Mint palette, smooth transitions, clean card shadows, and responsive grid layouts.
Expand `frontend/index.html` and implement `frontend/app.js` to build the "Diagnostic & 3D Workspace" view with Three.js (via CDN) and Chart.js (via CDN).

Include the following interactive components in the Diagnostic Workspace:
1. Data Source & Two-Battery Demo Bar (Top Control Strip):
   - Toggle buttons to switch instantly between:
     - "Demo Battery A (Moderate Ageing — ~83% SOH)"
     - "Demo Battery B (High Degradation & Flagged Cell — ~64% SOH)"
     - "Compare A vs. B (Demo Story Mode)"
     - "Upload Custom CSV" (with a clean drag-and-drop modal and downloadable sample CSV template).
   - Prominent Data Source Provenance Pill: Clearly states `[SIMULATED PUBLIC AGEING DATASET — NOT A LIVE VEHICLE CONNECTION]` or `[USER UPLOADED CSV DATASET]` with the assessment date.

2. KPI Summary Ribbon:
   - Pack State of Health (SOH %) with confidence interval
   - Estimated Remaining Useful Cycles (with projection assumptions)
   - ICA Primary Peak Shift Indicator (`ΔV_peak` in mV — explicitly labelled as a "Diagnostic Indicator")
   - Cell Status Summary (Count of Healthy, Moderate Ageing, and Flagged Cells)
   - Recommended Next Step Badge (e.g., "Second-Life Candidate: Solar Storage" vs. "Proceed to Recycling / Cell Inspection")

3. Interactive 3D Virtual Battery Pack (`Three.js` Canvas):
   - Render a clean, well-lit 3D EV battery module housing 24 cells (4x6 grid) over a soft mint/pistachio studio background.
   - Colour each 3D cell dynamically according to its estimated status:
     - Mint Green (`#52B788`) for Healthy
     - Warm Pistachio/Amber (`#E9C46A`) for Moderate Ageing
     - Coral Red (`#E76F51`) for Flagged Behaviour
   - Add raycasting for mouse hover and click interactions:
     - Hovering a cell elevates it slightly and displays a floating HUD tooltip (`Cell ID`, `Estimated SOH`, `Voltage`, `Status`).
     - Clicking any cell locks selection on that cell, highlights its 3D outline, and immediately updates the right-hand diagnostic graphs and cell inspection drawer to show that specific cell's curves and flagged anomalies.
   - Include camera controls (Orbit, Reset View, Filter Flagged Cells Only) and a mandatory transparency caption beneath the 3D canvas: *"Note: 3D view maps pack and sample cell measurements across representative module locations for visual inspection."*

4. Synchronized Diagnostic Graphs (`Chart.js`):
   - Tabbed or dual-panel interactive charts that update when switching batteries or clicking individual 3D cells:
     - Chart 1: **Incremental Capacity Analysis (`dQ/dV` vs. Voltage V)** showing the Fresh Baseline curve (dashed sage line), Raw Measured curve (faint dots), and Smoothed Cell/Pack curve (solid pistachio/mint line), with an interactive toggle to switch Signal Smoothing ON/OFF so users can see how smoothing reduces measurement noise.
     - Chart 2: **Degradation Trajectory & Remaining Life Projection (Capacity Ah / SOH % vs. Cycles)** showing historical measurements, predicted degradation path, and second-life threshold markers.

Ensure the Three.js canvas resizes cleanly with `ResizeObserver` and Chart.js instances are properly destroyed/updated before re-rendering to prevent canvas memory leaks.
Complete the lower section of the "Diagnostic & 3D Workspace" in `frontend/index.html`, `frontend/styles.css`, and `frontend/app.js` with the Second-Life Decision Engine, Indicative Valuation Calculator, Two-Battery Comparison Mode, and Traceable Report Generator.

1. Second-Life Application Matching Panel:
   - Display suitability cards with animated pistachio/mint progress bars, match scores (0–100%), technical voltage/capacity fit, and clear recommendations for:
     - **Solar Energy Storage** (Stationary renewable buffering)
     - **Telecom Backup Systems** (High-reliability standby power)
     - **Continued EV Duty** (Original mobility suitability)
     - **Battery Recycling Assessment** (Material recovery priority)
   - Include a clear screening banner: *"Preliminary screening aid only — not a safety certification. Real reuse requires qualified electrical, thermal, and safety assessment."*

2. Interactive Reuse vs. Recycling Valuation Calculator:
   - Provide interactive range sliders that call `POST /api/recalculate-valuation` (or update in real time) so users can inspect and adjust transparent assumptions:
     - Usable Capacity (kWh)
     - Repurposing & Integration Cost ($ or ₹ per kWh — provide a currency toggle between `₹ INR` and `$ USD`, defaulting to `₹ INR`)
     - Expected Round-Trip Efficiency (%)
     - Expected Second-Life Service Life (Years)
     - Immediate Recycling Recovery Value per kWh
   - Render a clean comparison visual showing **Estimated Second-Life Net Value**, **Immediate Recycling Value**, **Net Value Advantage**, and **Estimated CO₂e Avoided (Indicative Estimate)**.

3. Two-Battery Demo Story Comparison Modal / Drawer:
   - When the user clicks "Run Two-Battery Demo Story" or "Compare A vs. B", display a side-by-side comparison of **Battery A (Moderate Ageing)** and **Battery B (High Degradation with Flagged Cell #14)** covering SOH %, ICA peak shift indicators, flagged cell count, best second-life match, and indicative valuation vs. recycling.

4. Traceable Diagnostic Report Generator:
   - Add an "Export / View Traceable Report" button that opens a structured, print-ready assessment report containing:
     - Assessment ID, Timestamp & Data Source Provenance (Simulated vs. Uploaded CSV)
     - Pack & Flagged Cell Diagnostic Summary + ICA (`dQ/dV`) Indicator Summary
     - Model Estimates, Validation Confidence & Known Limitations (noting dataset chemistry/temperature scope)
     - Second-Life Recommendation & Valuation Assumptions Table
     - Mandatory Safety & Engineering Disclaimers
   - Include a "Print / Save as PDF" button (`window.print()` with clean `@media print` CSS rules) and a "Download JSON Report" button.
   Perform a complete end-to-end verification of the CellPulse application:
1. Check `backend/main.py` and `backend/diagnostics.py` to ensure all endpoints (`/api/presets`, `/api/analyze/preset/{preset_id}`, `/api/analyze/upload`, `/api/recalculate-valuation`) return valid JSON without NaN or NumPy serialization errors.
2. Verify that `frontend/index.html`, `frontend/styles.css`, and `frontend/app.js` have no missing DOM IDs, broken CDN links, or console errors, and that switching between the "Project Overview (Home)" page and the "Diagnostic & 3D Workspace" works smoothly.
3. Verify that clicking any of the 24 cells in the Three.js 3D battery pack updates the selected cell inspector and redraws the Chart.js `dQ/dV` Incremental Capacity curve.
4. Install dependencies in the virtual environment if needed and start the FastAPI server using Uvicorn on port 8000 so I can preview the application.