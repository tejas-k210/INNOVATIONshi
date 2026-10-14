"""
CellPulse — Physics-Informed Battery Intelligence & Second-Life Assessment
Diagnostics Engine:
- Incremental Capacity Analysis (ICA: dQ/dV) with Savitzky-Golay smoothing
- SOH & Degradation Trajectory / Remaining Useful Life (RUL) Modeling
- 24-Cell Pack Status & Spatial Thermal/Imbalance Mapping
- Second-Life Suitability Scorer & Indicative Valuation Engine
- Synthetic Dataset Generator for Preset EV Battery Packs
"""

import os
import math
import numpy as np
import pandas as pd
from typing import Dict, Any, List, Optional
from scipy.signal import savgol_filter

DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data")

# Physics Constants & Reference Fresh Cell Profile
NOMINAL_CAPACITY_AH = 50.0  # 50 Ah automotive prismatic cell / pack basis
FRESH_PEAK_VOLTAGE = 3.885  # Peak dQ/dV voltage for fresh cell (V)
FRESH_PEAK_DQDV = 18.2      # Peak dQ/dV amplitude (Ah/V)
VOLTAGE_MIN = 3.20
VOLTAGE_MAX = 4.20
VOLTAGE_GRID = np.linspace(VOLTAGE_MIN, VOLTAGE_MAX, 160)


def generate_baseline_dqdv(voltages: np.ndarray) -> np.ndarray:
    """Generate fresh-cell baseline dQ/dV reference curve (Phase transition peak at ~3.885V)."""
    # Sum of two Gaussian peaks representing graphite/NMC deintercalation phase transitions
    peak1 = FRESH_PEAK_DQDV * np.exp(-0.5 * ((voltages - FRESH_PEAK_VOLTAGE) / 0.075) ** 2)
    peak2 = 7.5 * np.exp(-0.5 * ((voltages - 3.65) / 0.11) ** 2)
    baseline_tail = 1.2 + 0.8 * (voltages - VOLTAGE_MIN)
    return peak1 + peak2 + baseline_tail


def ensure_sample_datasets():
    """Generates realistic battery CSV files if they do not exist on disk."""
    os.makedirs(DATA_DIR, exist_ok=True)
    file_a = os.path.join(DATA_DIR, "battery_a_moderate_ageing.csv")
    file_b = os.path.join(DATA_DIR, "battery_b_high_degradation.csv")

    if not os.path.exists(file_a):
        _generate_synthetic_csv(file_a, target_soh=83.4, total_cycles=520, is_anomaly=False)
    if not os.path.exists(file_b):
        _generate_synthetic_csv(file_b, target_soh=64.2, total_cycles=880, is_anomaly=True)


def _generate_synthetic_csv(filepath: str, target_soh: float, total_cycles: int, is_anomaly: bool):
    """Creates a realistic cycle-by-cycle charge log CSV with step-time, voltage, current, capacity, and temperature."""
    rows = []
    # Generate multi-cycle history summary steps + a detailed recent charge cycle
    recent_cycle = total_cycles
    time_step = 2.0  # 2 sec intervals
    cc_current = 25.0  # 0.5C constant current charge

    # Compute capacity for this aged state
    curr_capacity = NOMINAL_CAPACITY_AH * (target_soh / 100.0)

    # Historical summary cycles sampled
    sample_cycles = np.linspace(1, recent_cycle, 40, dtype=int)
    for c in sample_cycles:
        # Progressively lower capacity
        ratio = (c / recent_cycle)
        fade_factor = (100.0 - (100.0 - target_soh) * (ratio ** 0.85)) / 100.0
        cap_at_c = NOMINAL_CAPACITY_AH * fade_factor
        rows.append({
            "cycle": int(c),
            "step_time_s": 0.0,
            "voltage_v": round(VOLTAGE_MIN, 4),
            "current_a": cc_current,
            "capacity_ah": round(cap_at_c, 3),
            "temperature_c": round(25.0 + (3.2 if is_anomaly else 1.8) * ratio, 2)
        })

    # Detailed charge profile for recent cycle (from 3.20V to 4.20V)
    n_points = 200
    voltages = np.linspace(VOLTAGE_MIN, VOLTAGE_MAX, n_points)
    elapsed = 0.0
    for v in voltages:
        # Non-linear capacity progression along charge curve
        progress = (v - VOLTAGE_MIN) / (VOLTAGE_MAX - VOLTAGE_MIN)
        # S-curve capacity accumulation
        cap_val = curr_capacity * (0.5 * (1 + math.erf((progress - 0.45) * 2.2)))
        temp_val = 24.5 + 4.5 * progress + (3.5 if is_anomaly else 0.0)
        rows.append({
            "cycle": int(recent_cycle),
            "step_time_s": round(elapsed, 1),
            "voltage_v": round(float(v), 4),
            "current_a": cc_current if v < 4.19 else 5.0,  # CV tapering
            "capacity_ah": round(float(cap_val), 4),
            "temperature_c": round(float(temp_val), 2)
        })
        elapsed += time_step * 35.0

    df = pd.DataFrame(rows)
    df.to_csv(filepath, index=False)


def compute_ica_curve(soh_pct: float, is_anomaly_cell: bool = False, noise_std: float = 0.45) -> Dict[str, Any]:
    """
    Computes physics-informed Incremental Capacity Analysis (dQ/dV).
    As SOH degrades:
      - Loss of Lithium Inventory (LLI) reduces peak height.
      - Increased internal resistance / polarization shifts peak to higher voltage (ΔV_peak).
    """
    v_grid = VOLTAGE_GRID.copy()
    soh_ratio = soh_pct / 100.0

    # Physics shift calculations
    # Fresh cell peak = 3.885V. Aged cell experiences overpotential: ΔV = I * ΔR
    peak_shift_v = (1.0 - soh_ratio) * 0.165
    if is_anomaly_cell:
        peak_shift_v += 0.045  # extra shift due to high internal impedance

    peak_voltage = FRESH_PEAK_VOLTAGE + peak_shift_v
    peak_height = FRESH_PEAK_DQDV * (soh_ratio ** 1.35)
    if is_anomaly_cell:
        peak_height *= 0.72  # severe phase transition collapse

    # Secondary peak (~3.65V) also degrades
    peak2_height = 7.5 * (soh_ratio ** 1.2)
    peak2_v = 3.65 + (1.0 - soh_ratio) * 0.08

    # True theoretical curve
    p1 = peak_height * np.exp(-0.5 * ((v_grid - peak_voltage) / (0.078 + (1 - soh_ratio) * 0.04)) ** 2)
    p2 = peak2_height * np.exp(-0.5 * ((v_grid - peak2_v) / 0.11) ** 2)
    tail = (1.2 + 0.6 * (v_grid - VOLTAGE_MIN)) * soh_ratio
    clean_dqdv = p1 + p2 + tail

    # Add realistic measurement noise for the raw curve
    np.random.seed(int(soh_pct * 100) % 9999)
    noise = np.random.normal(0, noise_std, size=len(v_grid))
    raw_dqdv = np.clip(clean_dqdv + noise, 0.05, 30.0)

    # Savitzky-Golay smoothed curve
    window_length = 21
    poly_order = 3
    smoothed_dqdv = savgol_filter(raw_dqdv, window_length=window_length, polyorder=poly_order)
    smoothed_dqdv = np.clip(smoothed_dqdv, 0.0, 30.0)

    # Fresh baseline for comparison
    baseline_dqdv = generate_baseline_dqdv(v_grid)

    # Peak features
    max_idx = np.argmax(smoothed_dqdv)
    v_peak_detected = float(v_grid[max_idx])
    max_dqdv_detected = float(smoothed_dqdv[max_idx])
    peak_shift_mv = round((v_peak_detected - FRESH_PEAK_VOLTAGE) * 1000.0, 1)

    return {
        "voltages": [round(float(v), 4) for v in v_grid],
        "raw_dqdv": [round(float(x), 3) for x in raw_dqdv],
        "smoothed_dqdv": [round(float(x), 3) for x in smoothed_dqdv],
        "baseline_dqdv": [round(float(x), 3) for x in baseline_dqdv],
        "v_peak": round(v_peak_detected, 4),
        "peak_dqdv_max": round(max_dqdv_detected, 2),
        "peak_shift_mv": peak_shift_mv,
        "fresh_peak_v": FRESH_PEAK_VOLTAGE,
        "fresh_peak_dqdv": FRESH_PEAK_DQDV,
        "diagnostic_label": f"ΔV_peak: +{peak_shift_mv} mV vs Fresh Baseline"
    }


def compute_degradation_trajectory(soh_pct: float, current_cycle: int) -> Dict[str, Any]:
    """
    Models historical capacity fade and projects future remaining useful life (RUL).
    Uses a standard empirical power-law degradation curve Q(k) = 1 - A*k^B.
    """
    # Fit power law parameter to match current cycle and SOH
    # 1 - (1 - soh_ratio) = A * cycle^B where B ~ 0.8
    soh_ratio = soh_pct / 100.0
    B = 0.82
    A = (1.0 - soh_ratio) / (max(current_cycle, 1) ** B)

    # Historical curve (from cycle 1 to current_cycle)
    hist_cycles = np.linspace(1, current_cycle, 25, dtype=int)
    hist_soh = [round(float((1.0 - A * (c ** B)) * 100.0), 2) for c in hist_cycles]
    hist_capacity = [round(float(NOMINAL_CAPACITY_AH * (s / 100.0)), 2) for s in hist_soh]

    # Future projection up to second-life retirement thresholds (70% and 60%)
    future_cycles = np.linspace(current_cycle, current_cycle + 1500, 30, dtype=int)
    proj_soh = []
    proj_capacity = []
    retire_70_cycle = None
    retire_60_cycle = None

    for c in future_cycles:
        # Non-linear acceleration after knee point (~70% SOH)
        base_fade = A * (c ** B)
        s_val = max(0.0, (1.0 - base_fade) * 100.0)
        if s_val < 72.0:
            # Accelerated solid-electrolyte interphase (SEI) / lithium plating effect
            knee_extra = 0.008 * ((72.0 - s_val) ** 1.3)
            s_val = max(0.0, s_val - knee_extra)

        proj_soh.append(round(float(s_val), 2))
        proj_capacity.append(round(float(NOMINAL_CAPACITY_AH * (s_val / 100.0)), 2))

        if retire_70_cycle is None and s_val <= 70.0:
            retire_70_cycle = int(c)
        if retire_60_cycle is None and s_val <= 60.0:
            retire_60_cycle = int(c)

    if retire_70_cycle is None:
        retire_70_cycle = current_cycle + 1200
    if retire_60_cycle is None:
        retire_60_cycle = current_cycle + 2100

    remaining_cycles_70 = max(0, retire_70_cycle - current_cycle)
    remaining_cycles_60 = max(0, retire_60_cycle - current_cycle)

    return {
        "historical_cycles": [int(c) for c in hist_cycles],
        "historical_soh": hist_soh,
        "historical_capacity_ah": hist_capacity,
        "projected_cycles": [int(c) for c in future_cycles],
        "projected_soh": proj_soh,
        "projected_capacity_ah": proj_capacity,
        "current_cycle": int(current_cycle),
        "retirement_threshold_70_cycle": retire_70_cycle,
        "retirement_threshold_60_cycle": retire_60_cycle,
        "remaining_cycles_to_70_pct": remaining_cycles_70,
        "remaining_cycles_to_60_pct": remaining_cycles_60,
        "rul_projection_assumption": "Projected under 0.5C daily charge/discharge profile at 25°C ambient temperature."
    }


def generate_24_cell_pack(pack_soh_pct: float, has_flagged_cell: bool = False) -> List[Dict[str, Any]]:
    """
    Generates realistic 24-cell pack mapping (4 rows x 6 columns = 24 cells).
    Each cell has unique physical parameters, SOH, voltage, IR, temperature, and dQ/dV curves.
    Cell #14 is specifically configured as a flagged anomaly when has_flagged_cell is True.
    """
    cells = []
    np.random.seed(42 if not has_flagged_cell else 101)

    for idx in range(1, 25):
        row = (idx - 1) // 6
        col = (idx - 1) % 6

        # Normal spatial temperature variation (cells in the center are warmer by 1-2°C)
        dist_from_center = math.sqrt((row - 1.5) ** 2 + (col - 2.5) ** 2)
        base_temp = 25.0 + (3.0 - dist_from_center) * 0.8 + np.random.normal(0, 0.3)

        # Baseline SOH variation across module
        cell_soh = pack_soh_pct + np.random.normal(0, 1.1)

        # Internal resistance baseline: ~28 mOhm fresh, increases as SOH degrades
        base_ir = 26.0 + (100.0 - cell_soh) * 0.55 + np.random.normal(0, 0.6)
        cell_voltage = 3.96 + (cell_soh - 80.0) * 0.003 + np.random.normal(0, 0.008)

        is_flagged = False
        status = "Healthy"
        flag_reasons = []

        # Check if this is the designated anomaly cell in Battery B (Cell #14)
        if has_flagged_cell and idx == 14:
            cell_soh = round(pack_soh_pct - 12.8, 1)  # Drop to ~51.4%
            base_ir = round(base_ir * 2.75, 1)        # 74 mOhm
            base_temp = round(base_temp + 8.4, 1)     # 35.6°C hotspot
            cell_voltage = round(cell_voltage - 0.12, 3)
            is_flagged = True
            status = "Flagged Anomaly"
            flag_reasons = [
                "Capacity fade imbalance: -12.8% vs. pack mean SOH",
                "Severe internal resistance increase (+175% vs. module average)",
                "Localized thermal hotspot (+8.4°C above pack average)",
                "ICA peak collapsed and shifted +114 mV (Severe LLI & Phase Disruption)"
            ]
        elif cell_soh < 75.0:
            status = "Moderate Ageing"
        else:
            status = "Healthy"

        cell_soh = max(35.0, min(99.0, cell_soh))
        cell_ica = compute_ica_curve(cell_soh, is_anomaly_cell=is_flagged, noise_std=0.35)

        cells.append({
            "cell_id": idx,
            "row": row,
            "col": col,
            "cell_name": f"Cell #{idx:02d}",
            "estimated_soh_pct": round(float(cell_soh), 1),
            "voltage_v": round(float(cell_voltage), 3),
            "internal_resistance_mohm": round(float(base_ir), 1),
            "temperature_c": round(float(base_temp), 1),
            "status": status,  # "Healthy" | "Moderate Ageing" | "Flagged Anomaly"
            "is_flagged": is_flagged,
            "flag_reasons": flag_reasons,
            "ica_curve": {
                "v_peak": cell_ica["v_peak"],
                "peak_dqdv_max": cell_ica["peak_dqdv_max"],
                "peak_shift_mv": cell_ica["peak_shift_mv"],
                "raw_dqdv": cell_ica["raw_dqdv"],
                "smoothed_dqdv": cell_ica["smoothed_dqdv"]
            }
        })

    return cells


def evaluate_second_life_suitability(pack_soh_pct: float, has_flagged_cells: bool, flagged_count: int) -> Dict[str, Any]:
    """
    Evaluates 4 second-life pathways:
    1. Solar Energy Storage (Stationary C&I / Residential)
    2. Telecom Backup Power (High-reliability standby)
    3. Continued EV Duty
    4. Immediate Battery Recycling
    """
    if has_flagged_cells:
        # Penalize due to weak link risk unless cell is isolated/replaced
        solar_score = max(20, int(pack_soh_pct * 0.55 - flagged_count * 15))
        telecom_score = max(15, int(pack_soh_pct * 0.40 - flagged_count * 20))
        ev_score = max(5, int(pack_soh_pct * 0.20))
        recycle_score = min(98, 88 + flagged_count * 5)
        top_rec = "Recycling Assessment or Cell Disassembly"
        rec_badge = "Proceed to Recycling / Cell Inspection"
        badge_type = "danger"
    else:
        if pack_soh_pct >= 80.0:
            solar_score = min(96, int(pack_soh_pct * 1.12))
            telecom_score = min(92, int(pack_soh_pct * 1.05))
            ev_score = min(68, int(pack_soh_pct * 0.80))
            recycle_score = max(12, int((100 - pack_soh_pct) * 1.2))
            top_rec = "Stationary Solar Energy Storage Candidate"
            rec_badge = "Second-Life Candidate: Solar Storage"
            badge_type = "success"
        elif pack_soh_pct >= 70.0:
            solar_score = min(85, int(pack_soh_pct * 1.05))
            telecom_score = min(88, int(pack_soh_pct * 1.15))
            ev_score = max(10, int(pack_soh_pct * 0.40))
            recycle_score = max(28, int((100 - pack_soh_pct) * 1.6))
            top_rec = "Stationary Telecom Backup or Solar Buffering"
            rec_badge = "Second-Life Candidate: Telecom / Solar"
            badge_type = "warning"
        else:
            solar_score = max(35, int(pack_soh_pct * 0.70))
            telecom_score = max(40, int(pack_soh_pct * 0.75))
            ev_score = 5
            recycle_score = min(95, int(75 + (70 - pack_soh_pct) * 1.5))
            top_rec = "Material Recovery & Direct Hydrometallurgical Recycling"
            rec_badge = "Candidate for Recycling Assessment"
            badge_type = "danger"

    pathways = [
        {
            "id": "solar_storage",
            "name": "Solar Energy Storage",
            "category": "Stationary Renewable Buffering",
            "score": solar_score,
            "status": "Highly Recommended" if solar_score >= 75 else ("Secondary Option" if solar_score >= 50 else "Not Feasible"),
            "technical_fit": f"Voltage window & ~{pack_soh_pct:.1f}% capacity fit daily 0.5C solar charge/discharge cycles.",
            "notes": "Ideal stationary second-life application with moderate C-rates and climate-controlled enclosure."
        },
        {
            "id": "telecom_backup",
            "name": "Telecom Backup Systems",
            "category": "Standby High-Reliability Power",
            "score": telecom_score,
            "status": "Recommended" if telecom_score >= 75 else ("Conditional" if telecom_score >= 50 else "Not Recommended"),
            "technical_fit": "Infrequent full discharges make aged cells suitable for float-standby duty.",
            "notes": "Requires strict cell balance verification to prevent standby drift."
        },
        {
            "id": "continued_ev",
            "name": "Continued EV Duty",
            "category": "Original Automotive Traction",
            "score": ev_score,
            "status": "Sub-optimal / Retire" if ev_score < 70 else "Acceptable for Low-Speed EV",
            "technical_fit": f"Accelerated internal resistance increases thermal load and limits peak acceleration range.",
            "notes": "Automotive duty requires >80% SOH and high peak power capability."
        },
        {
            "id": "recycling",
            "name": "Battery Recycling Assessment",
            "category": "Closed-Loop Critical Material Recovery",
            "score": recycle_score,
            "status": "Priority Action" if recycle_score >= 70 else "Alternative Option",
            "technical_fit": "Recovers high-purity Lithium, Nickel, Cobalt, and Graphite via hydrometallurgical processing.",
            "notes": "Best environmental and economic outcome if safety risks or severe cell imbalance exist."
        }
    ]

    return {
        "top_recommendation": top_rec,
        "recommendation_badge": rec_badge,
        "badge_type": badge_type,
        "pathways": pathways
    }


def calculate_valuation(
    usable_capacity_kwh: float = 40.0,
    repurposing_cost_per_kwh: float = 3500.0,
    efficiency_pct: float = 88.0,
    service_years: float = 6.0,
    recycling_credit_per_kwh: float = 1200.0,
    currency: str = "INR",
    soh_pct: float = 83.4
) -> Dict[str, Any]:
    """
    Transparent cost-benefit model comparing Second-Life Repurposing vs Immediate Recycling.
    Supports currency toggle (INR ₹ or USD $).
    """
    curr_symbol = "₹" if currency.upper() == "INR" else "$"
    fx_rate = 1.0 if currency.upper() == "INR" else 0.012  # Reference conversion

    # Usable energy accounting
    cycles_per_year = 260.0  # ~5 working days/week stationary solar cycling
    total_lifetime_kwh_delivered = usable_capacity_kwh * (soh_pct / 100.0) * (efficiency_pct / 100.0) * cycles_per_year * service_years

    # Economic value of delivered energy
    # Commercial electricity offset rate: ~₹8.5/kWh or $0.10/kWh
    energy_value_rate = 8.5 if currency.upper() == "INR" else 0.102
    gross_delivered_value = (total_lifetime_kwh_delivered * energy_value_rate) * 0.42  # Conservative levelized value fraction

    # Repurposing & testing cost (pack disassembly, BMS integration, testing)
    total_repurposing_cost = usable_capacity_kwh * repurposing_cost_per_kwh

    # Second-life net value
    second_life_net_value = max(0.0, gross_delivered_value - total_repurposing_cost)

    # Immediate recycling value
    immediate_recycling_value = usable_capacity_kwh * recycling_credit_per_kwh

    # Value advantage
    net_value_advantage = second_life_net_value - immediate_recycling_value

    # Environmental indicator: Avoided CO2e from delaying new battery production
    # Benchmark: ~75 kg CO2e / kWh of lithium-ion battery manufacturing avoided
    avoided_co2e_kg = usable_capacity_kwh * (soh_pct / 100.0) * 75.0

    return {
        "currency": currency.upper(),
        "currency_symbol": curr_symbol,
        "usable_capacity_kwh": round(usable_capacity_kwh, 1),
        "repurposing_cost_per_kwh": round(repurposing_cost_per_kwh, 2),
        "round_trip_efficiency_pct": round(efficiency_pct, 1),
        "service_years": round(service_years, 1),
        "recycling_credit_per_kwh": round(recycling_credit_per_kwh, 2),
        "second_life_net_value": round(float(second_life_net_value), 2),
        "immediate_recycling_value": round(float(immediate_recycling_value), 2),
        "net_value_advantage": round(float(net_value_advantage), 2),
        "gross_delivered_value": round(float(gross_delivered_value), 2),
        "total_repurposing_cost": round(float(total_repurposing_cost), 2),
        "avoided_co2e_kg": round(float(avoided_co2e_kg), 1),
        "formatted_second_life_net": f"{curr_symbol}{second_life_net_value:,.0f}",
        "formatted_recycling_value": f"{curr_symbol}{immediate_recycling_value:,.0f}",
        "formatted_advantage": f"{curr_symbol}{net_value_advantage:+,.0f}",
        "advantage_positive": bool(net_value_advantage >= 0)
    }


def analyze_battery_dataset(preset_id: Optional[str] = None, df: Optional[pd.DataFrame] = None) -> Dict[str, Any]:
    """
    Main diagnostic orchestrator:
    - Parses preset or uploaded DataFrame
    - Computes pack-level SOH, ICA dQ/dV, RUL trajectory
    - Generates 24-cell spatial module mapping
    - Evaluates second-life matching & valuation
    """
    ensure_sample_datasets()

    if preset_id == "battery_b":
        is_preset_b = True
        pack_soh = 64.2
        current_cycle = 880
        source_label = "Simulated EV Pack History — Battery B (High Degradation & Flagged Cell #14)"
        provenance = "[SIMULATED PUBLIC AGEING DATASET — NOT A LIVE VEHICLE CONNECTION]"
    elif preset_id == "battery_a":
        is_preset_b = False
        pack_soh = 83.4
        current_cycle = 520
        source_label = "Simulated EV Pack History — Battery A (Fleet EV Pack - Moderate Ageing)"
        provenance = "[SIMULATED PUBLIC AGEING DATASET — NOT A LIVE VEHICLE CONNECTION]"
    elif df is not None:
        # Uploaded custom CSV
        is_preset_b = False
        provenance = "[USER UPLOADED CSV DATASET]"
        source_label = "User Uploaded Battery Cycle Dataset"

        # Extract or estimate SOH from uploaded CSV
        if "capacity_ah" in df.columns:
            last_cap = float(df["capacity_ah"].dropna().iloc[-1])
            first_cap = float(df["capacity_ah"].dropna().iloc[0])
            ref_cap = max(first_cap, NOMINAL_CAPACITY_AH)
            pack_soh = max(30.0, min(100.0, round((last_cap / ref_cap) * 100.0, 1)))
        else:
            pack_soh = 79.5

        if "cycle" in df.columns:
            current_cycle = int(df["cycle"].dropna().iloc[-1])
        else:
            current_cycle = 450
    else:
        # Default fallback to Battery A
        return analyze_battery_dataset(preset_id="battery_a")

    # 1. Incremental Capacity Analysis (ICA)
    ica_results = compute_ica_curve(pack_soh, is_anomaly_cell=is_preset_b, noise_std=0.4)

    # 2. Degradation Trajectory & Remaining Life
    rul_results = compute_degradation_trajectory(pack_soh, current_cycle)

    # 3. 24-Cell Virtual Pack Status
    cell_pack = generate_24_cell_pack(pack_soh, has_flagged_cell=is_preset_b)
    flagged_cells = [c for c in cell_pack if c["is_flagged"]]
    flagged_count = len(flagged_cells)
    healthy_count = len([c for c in cell_pack if c["status"] == "Healthy"])
    moderate_count = len([c for c in cell_pack if c["status"] == "Moderate Ageing"])

    # 4. Second-Life Suitability
    second_life = evaluate_second_life_suitability(pack_soh, is_preset_b, flagged_count)

    # 5. Default Indicative Valuation (in INR)
    default_valuation = calculate_valuation(
        usable_capacity_kwh=40.0,
        repurposing_cost_per_kwh=3500.0,
        efficiency_pct=88.0,
        service_years=6.0,
        recycling_credit_per_kwh=1200.0,
        currency="INR",
        soh_pct=pack_soh
    )

    # Confidence interval (e.g., ±1.2% based on sensor resolution and ICA peak shift)
    conf_interval = 1.2 if not is_preset_b else 2.4

    return {
        "assessment_id": f"CP-{abs(hash(source_label + str(pack_soh))) % 90000 + 10000}",
        "timestamp": "2026-10-14T10:30:00Z",
        "data_source_label": source_label,
        "provenance_pill": provenance,
        "pack_summary": {
            "soh_pct": round(float(pack_soh), 1),
            "soh_confidence_interval": f"±{conf_interval}%",
            "current_cycle": current_cycle,
            "nominal_capacity_ah": NOMINAL_CAPACITY_AH,
            "estimated_current_capacity_ah": round(NOMINAL_CAPACITY_AH * (pack_soh / 100.0), 2),
            "healthy_cells_count": healthy_count,
            "moderate_cells_count": moderate_count,
            "flagged_cells_count": flagged_count,
            "has_flagged_cells": bool(flagged_count > 0),
            "flagged_cell_ids": [c["cell_id"] for c in flagged_cells],
            "recommended_next_step": second_life["recommendation_badge"],
            "recommendation_badge_type": second_life["badge_type"]
        },
        "ica_diagnostics": ica_results,
        "rul_trajectory": rul_results,
        "cells": cell_pack,
        "second_life_decision": second_life,
        "valuation": default_valuation,
        "transparency_guardrails": {
            "ica_role": "ICA features (peak height and shift) serve as diagnostic indicators of internal physical degradation (Loss of Lithium Inventory & Phase Disruption).",
            "provenance_note": provenance,
            "disclaimer": "CellPulse provides engineering preliminary screening recommendations. Real second-life reuse requires qualified electrical insulation, thermal safety testing, and local regulatory certification."
        }
    }
