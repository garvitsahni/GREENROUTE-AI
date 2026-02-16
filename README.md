# GreenRoute AI

An intelligent logistics operating platform that predicts delivery delays, optimizes routes, assigns fleets, explains decisions using RAG, and tracks carbon impact.

## Project Structure
- `frontend/` (Root): React + Tailwind + Leaflet
- `backend/`: FastAPI + Google Gemini + Scikit-Learn

## Prerequisites
1. Node.js (v18+)
2. Python (v3.9+)
3. Google Gemini API Key

## Setup & Run

### 1. Backend
Navigate to `backend/` (or root if running scripts directly):
```bash
cd backend
pip install -r requirements.txt
```

Set your API Key:
```bash
# Linux/Mac
export GEMINI_API_KEY="your_actual_key_here"
# Windows Powershell
$env:GEMINI_API_KEY="your_actual_key_here"
```

Run the server (binding to 0.0.0.0 ensures accessibility):
```bash
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```
Server will be at: `http://localhost:8000`

### 2. Frontend
In the project root:

```bash
# If using a standard Create React App or Vite setup:
npm install
npm start
```

*Note: The generated code assumes standard React dependencies (`react`, `react-dom`, `lucide-react`, `leaflet`) are installed.*

## Features
- **Real-time Traffic Simulation**: Updates every 5 seconds in background.
- **ML Delay Prediction**: RandomForest model trained on `training_delays.csv`.
- **RAG Explainer**: Gemini explains route choices based on `sustainability_rules.txt`.
- **Carbon Tracking**: Calculates emissions based on traffic/distance.