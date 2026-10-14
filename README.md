# CellPulse — Physics-Informed Battery Intelligence & Second-Life Assessment
> **Theme H: Smart Vehicles / EV Motor & Battery Technology**  
> *Diagnose the degradation. Predict the future. Unlock the next life.*

---

## 📌 Project Overview

**CellPulse** is an advanced physics-informed battery intelligence web platform designed to evaluate aged electric vehicle (EV) battery packs. Rather than relying on a single, aggregate State of Health percentage (SOH %) that hides dangerous cell-level weak links, CellPulse extracts electrochemical degradation features via **Incremental Capacity Analysis ($dQ/dV$)**, simulates a **24-cell spatial 3D digital twin**, models **Remaining Useful Life (RUL)** trajectories, and delivers dynamic **Second-Life Application Matching** and **Reuse vs. Recycling Valuation**.

---

## ⚡ Core Innovation Pillars

1. **Battery Health & Signal Verification:** Continuous telemetry validation of terminal voltage, CC/CV step timing, thermal gradients, and series string divergence.
2. **Physics-Informed Incremental Capacity Analysis ($dQ/dV$):** Differential capacity tracking across charging phase transitions with Savitzky-Golay signal smoothing, measuring peak shift ($\Delta V_{peak}$) caused by internal resistance/polarization and peak height drop caused by Loss of Lithium Inventory (LLI) and Loss of Active Material (LAM).
3. **Degradation Trajectory & Remaining Life Projection:** Power-law empirical degradation modeling forecasting remaining cycles before reaching stationary second-life retirement thresholds (70% and 60% SOH).
4. **Interactive 3D Virtual Battery Pack (Three.js):** 24-cell prismatic module (4x6 matrix) with real-time raycasting hover HUD tooltips, click-to-inspect synchronization, and anomaly isolation filtering.
5. **Second-Life Decision & Indicative Valuation Engine:** Multi-criteria suitability scoring for Solar Energy Storage, Telecom Backup Systems, Continued EV Duty, and Recycling, paired with real-time economic cost-benefit sliders in both `₹ INR` and `$ USD`.

---

## 🚀 Quick Start Guide

### Prerequisites
- Python 3.10+
- Modern Web Browser (Chrome, Edge, Firefox, Safari)

### Installation & Launch

1. **Clone the Repository:**
   ```bash
   git clone https://github.com/tejas-k210/INNOVATIONshi.git
   cd INNOVATIONshi
   ```

2. **Install Dependencies:**
   ```bash
   pip install -r requirements.txt
   ```

3. **Start the Application:**
   ```bash
   python -m uvicorn backend.main:app --host 127.0.0.1 --port 8000
   ```

4. **Access the Web Interface:**
   Open your browser and navigate to:
   ```
   http://127.0.0.1:8000
   ```

---

## 🏗️ Repository Architecture

```
├── backend/
│   ├── main.py                  # FastAPI REST endpoints & static frontend mount
│   └── diagnostics.py           # Physics-informed ICA, RUL estimator, 24-cell twin & valuation
├── data/
│   ├── battery_a_moderate_ageing.csv   # Preset A (~83.4% SOH, 520 cycles, healthy pack)
│   └── battery_b_high_degradation.csv  # Preset B (~64.2% SOH, 880 cycles, flagged Cell #14)
├── frontend/
│   ├── index.html               # Dual-view application: Project Overview & Diagnostic Workspace
│   ├── styles.css               # Pistachio & Mint Green design system with responsive layouts
│   └── app.js                   # Three.js 3D pack, Chart.js curves, valuation calculator & reporting
├── requirements.txt             # Python backend dependencies
├── .gitignore                   # Ignore cache, OS & IDE files
└── THEPROMPTS.md                # System specification & prototype prompt history
```

---

## 🛡️ Engineering Guardrails & Scientific Integrity

- **Diagnostic Indicator Role:** Incremental Capacity Analysis (ICA) features ($V_{peak}$ shift and peak amplitude) are diagnostic indicators of internal electrochemical state changes.
- **Data Provenance:** Benchmark presets are synthesized from public lithium-ion cycle aging data with verifiable labels. Uploaded datasets are processed locally without unauthorized telemetry.
- **Screening Disclaimer:** CellPulse provides preliminary engineering triage. Physical second-life commissioning mandates hands-on insulation resistance, thermal abuse, and safety compliance testing (IEC 62619 / UL 1974).

---

## 📄 License
Developed for Hackathon / Innovation Project Demonstration.
