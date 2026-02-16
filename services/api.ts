import { OptimizationResult, SimulationStatus, Vehicle, VoiceResponse } from '../types';

// Standard localhost development URL. 
const API_BASE = 'http://localhost:8000';

const getHeaders = () => {
  return {
    'Content-Type': 'application/json',
  };
};

const handleFetchError = (e: any, endpoint: string) => {
  console.error(`[API Error] Failed to fetch ${endpoint} from ${API_BASE}`);
  console.error("Error details:", e);
  console.warn("TROUBLESHOOTING:\n1. Ensure backend is running: `uvicorn main:app --reload`\n2. Check console for 'Access-Control-Allow-Origin' errors (CORS).\n3. Ensure port 8000 is not blocked.");
  throw e;
};

export const fetchHealth = async (): Promise<boolean> => {
  try {
    const res = await fetch(`${API_BASE}/?t=${Date.now()}`, { 
      method: 'GET',
      headers: getHeaders(),
    });
    return res.ok;
  } catch (e) {
    // Silent failure for health check is preferred to avoid console spam loop
    return false;
  }
};

export const fetchOptimization = async (): Promise<OptimizationResult> => {
  try {
    const res = await fetch(`${API_BASE}/optimize?t=${Date.now()}`);
    if (!res.ok) throw new Error(`Optimization failed: ${res.status}`);
    return res.json();
  } catch (e) {
    handleFetchError(e, '/optimize');
    throw e;
  }
};

export const fetchSimulationStatus = async (): Promise<SimulationStatus> => {
  try {
    const res = await fetch(`${API_BASE}/simulation/status?t=${Date.now()}`);
    if (!res.ok) throw new Error('Failed to fetch status');
    return res.json();
  } catch (e) {
    throw e;
  }
};

export const fetchFleets = async (): Promise<Vehicle[]> => {
  try {
    const res = await fetch(`${API_BASE}/fleet?t=${Date.now()}`);
    if (!res.ok) throw new Error('Failed to fetch fleet');
    return res.json();
  } catch (e) {
    handleFetchError(e, '/fleet');
    throw e;
  }
};

export const addVehicle = async (vehicle: Omit<Vehicle, 'assigned_orders'>): Promise<void> => {
  try {
    const res = await fetch(`${API_BASE}/fleet/add`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(vehicle),
    });
    if (!res.ok) throw new Error('Failed to add vehicle');
  } catch (e) {
    handleFetchError(e, '/fleet/add');
    throw e;
  }
};

export const sendVoiceQuery = async (question: string): Promise<VoiceResponse> => {
  const params = new URLSearchParams({ question });
  try {
    const res = await fetch(`${API_BASE}/voice?${params.toString()}`);
    if (!res.ok) throw new Error('Voice query failed');
    return res.json();
  } catch (e) {
    handleFetchError(e, '/voice');
    throw e;
  }
};