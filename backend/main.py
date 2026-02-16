from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
import asyncio
import random
import os
import uvicorn
import csv
import traceback
import json

# --- Robust Imports ---
try:
    import pandas as pd
except ImportError:
    print("Warning: pandas not found. Using standard csv module.")
    pd = None

# Mock Engines
try:
    from ml_engine import train_model, predict_delay_probability
except Exception as e:
    print(f"Warning: ml_engine import failed ({e}). Using mocks.")
    def train_model(): pass
    def predict_delay_probability(*args): return 0.5

try:
    from rag_engine import get_rag_explanation, get_customer_message, get_voice_answer
except Exception as e:
    print(f"Warning: rag_engine import failed ({e}). Using mocks.")
    def get_rag_explanation(*args): return "AI Module Unavailable (Check Backend Logs)"
    def get_customer_message(*args): return "Status Update"
    def get_voice_answer(*args): return "Voice System Offline"

app = FastAPI(title="GreenRoute AI API")

# --- Custom Middleware for Private Network Access ---
# Must be defined before CORSMiddleware is added to ensure correct execution order in the stack
@app.middleware("http")
async def add_process_time_header(request: Request, call_next):
    try:
        response = await call_next(request)
        # Required for Chrome Localhost -> Localhost access
        response.headers["Access-Control-Allow-Private-Network"] = "true"
        return response
    except Exception as e:
        print(f"CRITICAL MIDDLEWARE ERROR: {e}")
        traceback.print_exc()
        return Response(content=f"Internal Server Error: {str(e)}", status_code=500)

# --- CORS Configuration ---
# Add this LAST so it runs FIRST on the request (handling OPTIONS preflight)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], 
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Global Simulation State ---
sim_state = {
    "traffic_level": "Low",
    "traffic_factor": 2, # 1-10
    "weather_condition": "Clear",
    "weather_risk": 0.1 # 0.0 - 1.0
}

# --- Models ---
class RouteOption(BaseModel):
    id: str
    name: str
    distance_km: float
    eta_mins: float
    traffic_factor: int
    weather_risk: float
    emissions: float
    delay_probability: float
    score: float
    coordinates: List[List[float]]

class OptimizationResponse(BaseModel):
    recommended_route: RouteOption
    alternatives: List[RouteOption]
    action: str
    customer_message: str
    carbon_saved: float
    ai_explanation: str
    timestamp: str

class VehicleInput(BaseModel):
    vehicle_id: str
    type: str
    capacity: int
    status: str

# --- Simulation Logic ---
async def simulation_loop():
    """Updates traffic/weather every 5 seconds."""
    weather_types = [("Clear", 0.1), ("Rain", 0.6), ("Stormy", 0.9), ("Cloudy", 0.3)]
    traffic_types = [("Low", 2), ("Moderate", 5), ("High", 9)]
    
    while True:
        try:
            w = random.choice(weather_types)
            t = random.choice(traffic_types)
            
            sim_state["weather_condition"] = w[0]
            sim_state["weather_risk"] = w[1]
            sim_state["traffic_level"] = t[0]
            sim_state["traffic_factor"] = t[1]
        except Exception as e:
            print(f"Simulation Error: {e}")
        
        await asyncio.sleep(5)

# --- Startup ---
@app.on_event("startup")
def startup_event():
    print("------------------------------------------------")
    print(" GREENROUTE AI BACKEND IS RUNNING ")
    print(" Listening on: http://0.0.0.0:8000")
    print("------------------------------------------------")
    
    # Ensure data directory exists
    base_dir = os.path.dirname(os.path.abspath(__file__))
    data_dir = os.path.join(base_dir, "data")
    if not os.path.exists(data_dir):
        os.makedirs(data_dir)
        print(f"Created data directory at {data_dir}")

    # Check files
    v_path = os.path.join(data_dir, "vehicles.csv")
    if os.path.exists(v_path):
        print(f"Found vehicles database: {v_path}")
    else:
        print(f"Vehicles database missing, will be created on write: {v_path}")

    try:
        train_model()
    except Exception as e:
        print(f"Startup Warning (ML): {e}")
        
    asyncio.create_task(simulation_loop())

# --- Routes Logic ---
def generate_route_options():
    # Simulate 3 routes from NYC to Newark
    start = [40.7128, -74.0060]
    end = [40.7357, -74.1724]
    
    routes = []
    
    # Route A: Direct
    dist_a = 18.5
    routes.append({
        "id": "A", "name": "I-78 Express", "distance_km": dist_a,
        "base_eta": 25, "coords": [start, [40.72, -74.05], [40.73, -74.10], end]
    })
    
    # Route B: Scenic
    dist_b = 24.2
    routes.append({
        "id": "B", "name": "US-1 Truck Route", "distance_km": dist_b,
        "base_eta": 35, "coords": [start, [40.75, -74.02], [40.78, -74.08], [40.74, -74.15], end]
    })
    
    processed_routes = []
    
    for r in routes:
        tf = sim_state["traffic_factor"] + random.randint(-1, 1)
        wr = sim_state["weather_risk"]
        
        try:
            delay_prob = predict_delay_probability(r["distance_km"], tf, wr)
        except:
            delay_prob = 0.5
        
        emissions = r["distance_km"] * max(1, tf) * 0.25
        adj_eta = r["base_eta"] * (1 + (tf/20)) * (1 + wr)
        score = (0.5 * adj_eta) + (0.3 * emissions) + (0.2 * delay_prob * 100)
        
        processed_routes.append(RouteOption(
            id=r["id"],
            name=r["name"],
            distance_km=r["distance_km"],
            eta_mins=round(adj_eta, 1),
            traffic_factor=max(1, tf),
            weather_risk=wr,
            emissions=round(emissions, 2),
            delay_probability=round(delay_prob, 2),
            score=round(score, 2),
            coordinates=r["coords"]
        ))
        
    return sorted(processed_routes, key=lambda x: x.score)

# --- Endpoints ---

@app.get("/")
def health_check():
    return {"status": "ok", "service": "GreenRoute AI", "port": 8000}

@app.get("/simulation/status")
def get_simulation_status():
    return sim_state

@app.get("/optimize")
def optimize_route():
    try:
        options = generate_route_options()
        best = options[0]
        alts = options[1:]
        
        action = "PROCEED"
        if best.delay_probability > 0.75:
            action = "DELAY_DISPATCH"
        elif best.delay_probability > 0.5:
            action = "REROUTE"
            
        worst_emission = max(o.emissions for o in options)
        saved = worst_emission - best.emissions
        
        route_dict = {
            "name": best.name,
            "distance_km": best.distance_km,
            "emissions": best.emissions
        }
        explanation = get_rag_explanation(route_dict, sim_state["weather_risk"], sim_state["traffic_factor"])
        msg = get_customer_message(best.delay_probability, action)
        
        return OptimizationResponse(
            recommended_route=best,
            alternatives=alts,
            action=action,
            customer_message=msg,
            carbon_saved=saved,
            ai_explanation=explanation,
            timestamp="Now"
        )
    except Exception as e:
        print(f"Optimize Error: {e}")
        traceback.print_exc()
        return OptimizationResponse(
             recommended_route=RouteOption(
                 id="ERR", name="Error", distance_km=0, eta_mins=0, 
                 traffic_factor=0, weather_risk=0, emissions=0, delay_probability=0, score=0, coordinates=[]
             ),
             alternatives=[],
             action="ERROR",
             customer_message="System Error",
             carbon_saved=0,
             ai_explanation=f"Error: {str(e)}",
             timestamp="Error"
        )

@app.get("/fleet")
def get_fleet_assignments():
    base_dir = os.path.dirname(os.path.abspath(__file__))
    path = os.path.join(base_dir, "data", "vehicles.csv")
    vehicles = []

    try:
        # Method 1: Pandas (Preferred)
        if pd is not None and os.path.exists(path):
            df = pd.read_csv(path)
            # Normalize columns
            df.columns = [c.strip() for c in df.columns]
            df = df.fillna("Unknown")
            vehicles = df.to_dict(orient='records')
        
        # Method 2: CSV Standard Library (Fallback)
        elif os.path.exists(path):
            # utf-8-sig handles BOM if opened in Excel
            with open(path, mode='r', encoding='utf-8-sig') as f:
                reader = csv.DictReader(f)
                # Robustly strip whitespace from keys
                if reader.fieldnames:
                    reader.fieldnames = [c.strip() for c in reader.fieldnames]
                vehicles = [row for row in reader]

        # Use mock data if still empty
        if not vehicles:
             vehicles = [
                 {"vehicle_id": "V-MOCK-1", "type": "Mock Van", "capacity": 50, "status": "Active"}
             ]

        # Simulate round-robin assignments for demo
        orders = ["ORD-991", "ORD-992", "ORD-993", "ORD-994", "ORD-995"]
        for i, order in enumerate(orders):
            if not vehicles: break
            v_idx = i % len(vehicles)
            if "assigned_orders" not in vehicles[v_idx]:
                vehicles[v_idx]["assigned_orders"] = []
            
            # Ensure it is a list
            if not isinstance(vehicles[v_idx].get("assigned_orders"), list):
                 vehicles[v_idx]["assigned_orders"] = []
            
            vehicles[v_idx]["assigned_orders"].append(order)
                 
        return vehicles
    except Exception as e:
        print(f"Error in fleet endpoint: {e}")
        traceback.print_exc()
        return [{"vehicle_id": "Error", "type": str(e), "capacity": 0, "status": "Error", "assigned_orders": []}]

@app.post("/fleet/add")
def add_vehicle(vehicle: VehicleInput):
    base_dir = os.path.dirname(os.path.abspath(__file__))
    path = os.path.join(base_dir, "data", "vehicles.csv")
    
    try:
        new_row = {
            "vehicle_id": vehicle.vehicle_id,
            "type": vehicle.type,
            "capacity": vehicle.capacity,
            "status": vehicle.status
        }
        
        # Method 1: Pandas
        if pd is not None:
            # Check if file exists to handle header
            if os.path.exists(path):
                df = pd.read_csv(path)
                new_df = pd.DataFrame([new_row])
                df = pd.concat([df, new_df], ignore_index=True)
                df.to_csv(path, index=False)
            else:
                df = pd.DataFrame([new_row])
                df.to_csv(path, index=False)
        
        # Method 2: CSV Fallback
        else:
            exists = os.path.exists(path)
            with open(path, "a", newline='', encoding='utf-8') as f:
                fieldnames = ["vehicle_id", "type", "capacity", "status"]
                writer = csv.DictWriter(f, fieldnames=fieldnames)
                if not exists:
                    writer.writeheader()
                writer.writerow(new_row)

        return {"status": "success", "message": "Vehicle added"}
    except Exception as e:
        print(f"Add Vehicle Error: {e}")
        traceback.print_exc()
        return Response(content=f"Error adding vehicle: {str(e)}", status_code=500)

@app.get("/voice")
def voice_endpoint(question: str):
    answer = get_voice_answer(question)
    return {"question": question, "answer": answer}

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)