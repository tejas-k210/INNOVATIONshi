"""
CellPulse — Physics-Informed Battery Intelligence & Second-Life Assessment
FastAPI Main Application:
- Serves REST diagnostic and valuation APIs
- Handles preset analysis, CSV uploads, dynamic valuation recalculations
- Serves the frontend single-page application at the root /
"""

import os
import io
import pandas as pd
from typing import Optional
from fastapi import FastAPI, HTTPException, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, Response
from pydantic import BaseModel

from backend.diagnostics import (
    ensure_sample_datasets,
    analyze_battery_dataset,
    calculate_valuation,
    DATA_DIR
)

app = FastAPI(
    title="CellPulse — Physics-Informed Battery Intelligence API",
    description="Diagnostics, Incremental Capacity Analysis, 3D Pack Mapping & Second-Life Valuation",
    version="1.0.0"
)

# Enable CORS for local development flexibility
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

FRONTEND_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "frontend")


class ValuationRequest(BaseModel):
    usable_capacity_kwh: float = 40.0
    repurposing_cost_per_kwh: float = 3500.0
    efficiency_pct: float = 88.0
    service_years: float = 6.0
    recycling_credit_per_kwh: float = 1200.0
    currency: str = "INR"
    soh_pct: float = 83.4


@app.on_event("startup")
def startup_event():
    """Ensure data files and sample datasets exist when the server boots."""
    ensure_sample_datasets()


@app.get("/api/presets")
def get_presets():
    """Returns available preset battery aging profiles for the two-battery demo story."""
    return {
        "presets": [
            {
                "id": "battery_a",
                "name": "Battery A: Fleet EV Pack — Moderate Ageing",
                "soh_pct": 83.4,
                "current_cycles": 520,
                "status": "Healthy & Well-Balanced",
                "flagged_cells": 0,
                "recommended_pathway": "Solar Energy Storage",
                "badge_type": "success",
                "description": "520-cycle commercial fleet pack with moderate capacity fade, uniform cell balance, and low ICA peak shift (+31 mV). Prime candidate for stationary solar buffering."
            },
            {
                "id": "battery_b",
                "name": "Battery B: Aged EV Pack — Flagged Cell Anomaly",
                "soh_pct": 64.2,
                "current_cycles": 880,
                "status": "High Degradation & Flagged Cell #14",
                "flagged_cells": 1,
                "recommended_pathway": "Battery Recycling Assessment",
                "badge_type": "danger",
                "description": "880-cycle high-mileage pack exhibiting severe cell #14 thermal hotspot, +114 mV ICA peak shift, and internal impedance rise (+175%). Recommended for direct material recycling or cell disassembly."
            }
        ]
    }


@app.post("/api/analyze/preset/{preset_id}")
def analyze_preset(preset_id: str):
    """Executes full physics-informed diagnostics for the selected preset."""
    if preset_id not in ["battery_a", "battery_b"]:
        raise HTTPException(status_code=400, detail=f"Invalid preset ID '{preset_id}'. Expected 'battery_a' or 'battery_b'.")
    try:
        results = analyze_battery_dataset(preset_id=preset_id)
        return results
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Diagnostic error: {str(e)}")


@app.post("/api/analyze/upload")
async def analyze_upload(file: UploadFile = File(...)):
    """Processes a user-uploaded CSV file containing cycle charge data."""
    if not file.filename.lower().endswith(".csv"):
        raise HTTPException(status_code=400, detail="Only CSV files (.csv) are accepted.")

    try:
        contents = await file.read()
        df = pd.read_csv(io.StringIO(contents.decode("utf-8", errors="ignore")))

        # Case-insensitive column normalization
        col_map = {c.lower().strip(): c for c in df.columns}
        if "voltage_v" not in col_map and "voltage" not in col_map and "v" not in col_map:
            raise HTTPException(
                status_code=400,
                detail="CSV must contain a voltage column ('voltage_v', 'voltage', or 'v')."
            )

        # Standardize key column names
        for standard, aliases in [
            ("voltage_v", ["voltage", "v", "voltage(v)", "cell_voltage"]),
            ("capacity_ah", ["capacity", "cap_ah", "ah", "capacity(ah)", "charge_ah"]),
            ("current_a", ["current", "i", "current_a", "current(a)"]),
            ("cycle", ["cycle", "cycle_index", "cycle_num", "cycle_count"]),
            ("temperature_c", ["temperature", "temp_c", "temp", "temp(c)"])
        ]:
            if standard not in df.columns:
                for alias in aliases:
                    if alias in col_map:
                        df[standard] = df[col_map[alias]]
                        break

        results = analyze_battery_dataset(df=df)
        return results

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to parse uploaded CSV: {str(e)}")


@app.post("/api/recalculate-valuation")
def recalculate_valuation(req: ValuationRequest):
    """Dynamically recalculates indicative reuse vs. recycling value based on interactive assumptions."""
    try:
        valuation = calculate_valuation(
            usable_capacity_kwh=req.usable_capacity_kwh,
            repurposing_cost_per_kwh=req.repurposing_cost_per_kwh,
            efficiency_pct=req.efficiency_pct,
            service_years=req.service_years,
            recycling_credit_per_kwh=req.recycling_credit_per_kwh,
            currency=req.currency,
            soh_pct=req.soh_pct
        )
        return valuation
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Valuation calculation error: {str(e)}")


@app.get("/api/download-sample-csv")
def download_sample_csv(preset: str = "battery_a"):
    """Allows downloading a realistic sample battery CSV for upload testing."""
    filename = "battery_a_moderate_ageing.csv" if preset == "battery_a" else "battery_b_high_degradation.csv"
    path = os.path.join(DATA_DIR, filename)
    if not os.path.exists(path):
        ensure_sample_datasets()
    return FileResponse(
        path=path,
        media_type="text/csv",
        filename=filename
    )


# Mount static frontend files at root
if os.path.isdir(FRONTEND_DIR):
    app.mount("/", StaticFiles(directory=FRONTEND_DIR, html=True), name="frontend")
