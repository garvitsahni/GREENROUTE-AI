export interface RouteOption {
  id: string;
  name: string;
  distance_km: number;
  eta_mins: number;
  traffic_factor: number;
  weather_risk: number;
  emissions: number;
  delay_probability: number;
  score: number;
  coordinates: [number, number][]; // Simple line simulation
}

export interface OptimizationResult {
  recommended_route: RouteOption;
  alternatives: RouteOption[];
  action: string;
  customer_message: string;
  carbon_saved: number;
  ai_explanation: string;
  timestamp: string;
}

export interface Vehicle {
  vehicle_id: string;
  type: string;
  capacity: number;
  status: string;
  assigned_orders: string[];
}

export interface SimulationStatus {
  traffic_level: string;
  weather_condition: string;
  timestamp: string;
}

export interface VoiceResponse {
  answer: string;
  audio_url?: string; // Placeholder for future TTS
}