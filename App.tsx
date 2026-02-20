import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Activity, Truck, Mic, Radio, Navigation, Leaf, AlertTriangle, MessageSquare, Server, Plus, X, Save, History, Calendar, MapPin, CheckCircle, Clock, Wrench, AlertCircle } from 'lucide-react';
import MapDisplay from './components/MapDisplay';
import { fetchHealth, fetchOptimization, fetchFleets, fetchSimulationStatus, sendVoiceQuery, addVehicle, fetchHistory, fetchLogExplanation } from './services/api';
import { OptimizationResult, Vehicle, SimulationStatus, DeliveryLog } from './types';

// Mock Geometry for Historical Routes (since CSV doesn't have lat/lng)
const ROUTE_GEOMETRIES: Record<string, [number, number][]> = {
  'R-NY-01': [[40.7128, -74.0060], [40.72, -74.05], [40.73, -74.10], [40.7357, -74.1724]], // I-78
  'R-NY-02': [[40.7128, -74.0060], [40.75, -74.02], [40.78, -74.08], [40.74, -74.15], [40.7357, -74.1724]], // US-1
  'R-NY-03': [[40.7128, -74.0060], [40.725, -74.04], [40.718, -74.045], [40.72, -74.06]], // Holland Tunnel (approx)
  'R-CA-01': [[37.7749, -122.4194], [37.70, -122.40], [37.60, -122.35], [37.4419, -122.1430]], // SF -> Palo Alto
  'R-CA-02': [[37.7749, -122.4194], [37.65, -122.45], [37.50, -122.30], [37.3382, -121.8863]], // SF -> San Jose
  'R-TX-01': [[30.2672, -97.7431], [29.80, -97.95], [29.4241, -98.4936]], // Austin -> SA
  'R-WA-01': [[47.6062, -122.3321], [47.50, -122.30], [47.2529, -122.4443]], // Seattle -> Tacoma
  'R-IL-01': [[41.8781, -87.6298], [41.90, -87.75], [41.9742, -87.9073]], // Chicago -> O'Hare
};

const App = () => {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'fleet' | 'history'>('dashboard');
  const [loading, setLoading] = useState(false);
  const [apiOnline, setApiOnline] = useState(false);
  const [simStatus, setSimStatus] = useState<SimulationStatus>({ traffic_level: 'Low', weather_condition: 'Clear', timestamp: '' });
  
  // Dashboard State
  const [optResult, setOptResult] = useState<OptimizationResult | null>(null);
  
  // Fleet State
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [showAddVehicle, setShowAddVehicle] = useState(false);
  const [newVehicle, setNewVehicle] = useState({
    vehicle_id: '',
    type: 'Electric Van',
    capacity: 50,
    status: 'Active'
  });

  // History State
  const [historyLogs, setHistoryLogs] = useState<DeliveryLog[]>([]);
  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  const [selectedLogId, setSelectedLogId] = useState<string | null>(null);
  const [selectedLogExplanation, setSelectedLogExplanation] = useState<string>('');
  const [explanationLoading, setExplanationLoading] = useState(false);

  // Voice State
  const [voiceQuery, setVoiceQuery] = useState('');
  const [voiceResponse, setVoiceResponse] = useState('');
  const [voiceLoading, setVoiceLoading] = useState(false);

  // Initial Data Load & Polling
  useEffect(() => {
    let mounted = true;

    const checkHealth = async () => {
      const online = await fetchHealth();
      if (mounted) setApiOnline(online);
    };
    
    // Check immediately
    checkHealth();

    // Poll health every 5 seconds to recover if backend starts late
    const healthInterval = setInterval(checkHealth, 5000);

    // Poll for simulation updates
    const simInterval = setInterval(async () => {
      try {
        const status = await fetchSimulationStatus();
        if (mounted) {
          setSimStatus(status);
          setApiOnline(true); // If this succeeds, API is definitely online
        }
      } catch (e) {
        if (mounted) setApiOnline(false); // Mark offline if simulation fetch fails
      }
    }, 5000);

    return () => {
      mounted = false;
      clearInterval(healthInterval);
      clearInterval(simInterval);
    };
  }, []);

  const handleOptimize = async () => {
    setLoading(true);
    try {
      const result = await fetchOptimization();
      setOptResult(result);
      setApiOnline(true);
    } catch (e) {
      console.error(e);
      setApiOnline(false);
      alert("Failed to fetch optimization data. Is the backend running?");
    } finally {
      setLoading(false);
    }
  };

  const loadFleets = useCallback(async () => {
    try {
      const data = await fetchFleets();
      setVehicles(data);
      setApiOnline(true);
    } catch (e) {
      console.error(e);
      setApiOnline(false);
    }
  }, []);

  const loadHistory = useCallback(async () => {
    try {
      const data = await fetchHistory();
      setHistoryLogs(data);
      setApiOnline(true);
    } catch (e) {
      console.error(e);
      setApiOnline(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'fleet') {
      loadFleets();
    } else if (activeTab === 'history') {
      loadHistory();
    }
  }, [activeTab, loadFleets, loadHistory]);

  // Fetch explanation when log is selected
  useEffect(() => {
    if (selectedLogId) {
      setExplanationLoading(true);
      setSelectedLogExplanation('');
      fetchLogExplanation(selectedLogId)
        .then(exp => {
           setSelectedLogExplanation(exp);
           setApiOnline(true);
        })
        .catch(() => setSelectedLogExplanation('Failed to retrieve AI analysis.'))
        .finally(() => setExplanationLoading(false));
    } else {
      setSelectedLogExplanation('');
    }
  }, [selectedLogId]);

  // Derived History Data
  const filteredHistory = useMemo(() => {
    if (!dateRange.start && !dateRange.end) return historyLogs;

    // Create dates in local time to match input date picker
    const start = dateRange.start ? new Date(dateRange.start + 'T00:00:00') : new Date(0);
    const end = dateRange.end ? new Date(dateRange.end + 'T23:59:59') : new Date(8640000000000000);

    return historyLogs.filter(log => {
      // Assuming log.timestamp is somewhat compatible with Date constructor
      const logTime = new Date(log.timestamp);
      return logTime >= start && logTime <= end;
    });
  }, [historyLogs, dateRange]);

  const historyStats = useMemo(() => {
    const totalCarbon = filteredHistory.reduce((sum, log) => sum + (Number(log.carbon_emitted_kg) || 0), 0);
    const avgRating = filteredHistory.length > 0 
      ? filteredHistory.reduce((sum, log) => sum + (Number(log.customer_rating) || 0), 0) / filteredHistory.length 
      : 0;
    const totalDelays = filteredHistory.filter(l => l.status === 'Delayed').length;

    return { totalCarbon, avgRating, totalDelays };
  }, [filteredHistory]);

  const selectedLog = useMemo(() => {
    return historyLogs.find(l => l.log_id === selectedLogId);
  }, [selectedLogId, historyLogs]);

  const selectedHistoricalRouteCoords = useMemo(() => {
    if (!selectedLog) return undefined;
    // Return mock geometry if available, else null
    return ROUTE_GEOMETRIES[selectedLog.route_id];
  }, [selectedLog]);

  const handleResetHistory = () => {
    setDateRange({ start: '', end: '' });
    setSelectedLogId(null);
  };

  const handleVoiceSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!voiceQuery) return;
    setVoiceLoading(true);
    try {
      const res = await sendVoiceQuery(voiceQuery);
      setVoiceResponse(res.answer);
      setApiOnline(true);
    } catch (e) {
      setVoiceResponse("Sorry, I couldn't process that. Backend might be offline.");
      setApiOnline(false);
    } finally {
      setVoiceLoading(false);
    }
  };

  const handleSubmitVehicle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newVehicle.vehicle_id) return;
    
    try {
      await addVehicle(newVehicle);
      await loadFleets();
      setShowAddVehicle(false);
      setNewVehicle({
        vehicle_id: '',
        type: 'Electric Van',
        capacity: 50,
        status: 'Active'
      });
    } catch (e) {
      alert("Failed to add vehicle.");
    }
  };

  return (
    <div className="flex flex-col h-screen bg-slate-900 text-white font-sans">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 bg-slate-800 border-b border-slate-700 shadow-md z-20">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-brand-green rounded-lg">
            <Navigation className="text-slate-900 w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-white">GREENROUTE AI</h1>
            <p className="text-xs text-slate-400">Intelligent Logistics Platform</p>
          </div>
        </div>
        
        <div className="flex items-center space-x-6">
           <div className="flex items-center space-x-2 text-sm text-slate-400 bg-slate-900 px-3 py-1 rounded-full border border-slate-700">
             <Radio className={`w-4 h-4 ${apiOnline ? 'text-brand-green animate-pulse' : 'text-red-500'}`} />
             <span>Backend: {apiOnline ? 'Online' : 'Offline'}</span>
           </div>

           <div className="flex items-center space-x-4 text-xs">
              <div className="flex flex-col items-end">
                <span className="text-slate-500 uppercase tracking-wider font-bold">Traffic</span>
                <span className={`font-bold ${simStatus.traffic_level === 'High' ? 'text-red-400' : 'text-brand-green'}`}>
                  {simStatus.traffic_level.toUpperCase()}
                </span>
              </div>
              <div className="w-px h-6 bg-slate-700"></div>
              <div className="flex flex-col items-end">
                <span className="text-slate-500 uppercase tracking-wider font-bold">Weather</span>
                <span className={`font-bold ${simStatus.weather_condition === 'Stormy' ? 'text-red-400' : 'text-brand-green'}`}>
                  {simStatus.weather_condition.toUpperCase()}
                </span>
              </div>
           </div>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <nav className="w-64 bg-slate-800 border-r border-slate-700 p-4 flex flex-col space-y-2 z-10 shrink-0">
          <button 
            onClick={() => setActiveTab('dashboard')}
            className={`flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors ${activeTab === 'dashboard' ? 'bg-brand-green text-slate-900 font-bold' : 'text-slate-300 hover:bg-slate-700'}`}
          >
            <Activity className="w-5 h-5" />
            <span>Mission Control</span>
          </button>
          <button 
            onClick={() => setActiveTab('fleet')}
            className={`flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors ${activeTab === 'fleet' ? 'bg-brand-green text-slate-900 font-bold' : 'text-slate-300 hover:bg-slate-700'}`}
          >
            <Truck className="w-5 h-5" />
            <span>Fleet Manager</span>
          </button>
          <button 
            onClick={() => setActiveTab('history')}
            className={`flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors ${activeTab === 'history' ? 'bg-brand-green text-slate-900 font-bold' : 'text-slate-300 hover:bg-slate-700'}`}
          >
            <History className="w-5 h-5" />
            <span>Analytics & History</span>
          </button>
          
          <div className="mt-auto pt-6 border-t border-slate-700">
            <h3 className="text-xs uppercase text-slate-500 font-bold mb-3 flex items-center">
              <Mic className="w-4 h-4 mr-2" />
              Voice Command
            </h3>
            <form onSubmit={handleVoiceSubmit} className="flex flex-col space-y-2">
              <input 
                type="text" 
                value={voiceQuery}
                onChange={(e) => setVoiceQuery(e.target.value)}
                placeholder="Ask about routing..." 
                className="bg-slate-900 border border-slate-700 rounded p-2 text-sm text-white focus:border-brand-green outline-none"
              />
              <button 
                type="submit"
                disabled={voiceLoading}
                className="bg-slate-700 hover:bg-slate-600 text-xs py-2 rounded transition-colors"
              >
                {voiceLoading ? 'Processing...' : 'Ask AI'}
              </button>
            </form>
            {voiceResponse && (
              <div className="mt-2 p-2 bg-slate-900 rounded border border-slate-700 text-xs text-brand-green italic">
                "{voiceResponse}"
              </div>
            )}
          </div>
        </nav>

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto p-6 bg-slate-900 relative">
          
          {activeTab === 'dashboard' && (
            <div className="grid grid-cols-12 gap-6 h-full">
              {/* Left Column: Controls & Stats */}
              <div className="col-span-12 lg:col-span-4 flex flex-col space-y-6">
                
                {/* Control Card */}
                <div className="bg-slate-800 rounded-xl p-6 border border-slate-700 shadow-lg">
                  <div className="flex justify-between items-center mb-4">
                    <h2 className="text-lg font-bold text-white">Route Optimizer</h2>
                    <span className="text-xs bg-slate-700 px-2 py-1 rounded text-slate-300">Live Model</span>
                  </div>
                  <p className="text-sm text-slate-400 mb-6">
                    Predict delays and optimize routes based on real-time traffic, weather, and carbon impact.
                  </p>
                  <button 
                    onClick={handleOptimize}
                    disabled={loading || !apiOnline}
                    className={`w-full font-bold py-3 px-4 rounded-lg flex items-center justify-center transition-all ${apiOnline ? 'bg-brand-green hover:bg-emerald-400 text-slate-900' : 'bg-slate-700 text-slate-500 cursor-not-allowed'}`}
                  >
                    {loading ? (
                      <span className="animate-spin mr-2">⟳</span>
                    ) : (
                      <Activity className="mr-2 w-5 h-5" />
                    )}
                    {loading ? 'Analyzing Routes...' : (apiOnline ? 'Run Optimization' : 'Backend Offline')}
                  </button>
                </div>

                {/* Key Metrics */}
                {optResult && (
                  <div className="grid grid-cols-2 gap-4">
                     <div className="bg-slate-800 p-4 rounded-xl border border-slate-700">
                        <div className="text-slate-400 text-xs uppercase font-bold mb-1 flex items-center">
                          <Leaf className="w-3 h-3 mr-1 text-green-400" /> Carbon Saved
                        </div>
                        <div className="text-2xl font-bold text-green-400">
                          {optResult.carbon_saved.toFixed(2)} kg
                        </div>
                     </div>
                     <div className="bg-slate-800 p-4 rounded-xl border border-slate-700">
                        <div className="text-slate-400 text-xs uppercase font-bold mb-1 flex items-center">
                          <AlertTriangle className="w-3 h-3 mr-1 text-yellow-400" /> Delay Risk
                        </div>
                        <div className={`text-2xl font-bold ${optResult.recommended_route.delay_probability > 0.5 ? 'text-red-400' : 'text-brand-green'}`}>
                          {(optResult.recommended_route.delay_probability * 100).toFixed(0)}%
                        </div>
                     </div>
                  </div>
                )}

                {/* AI Explanation Card */}
                {optResult && (
                  <div className="bg-slate-800 rounded-xl p-6 border border-slate-700 flex-1 flex flex-col">
                    <h3 className="text-sm font-bold text-white mb-3 flex items-center">
                      <Server className="w-4 h-4 mr-2 text-brand-accent" />
                      Gemini RAG Analysis
                    </h3>
                    <div className="bg-slate-900 p-4 rounded border border-slate-700 text-sm text-slate-300 leading-relaxed overflow-y-auto max-h-[200px]">
                      {optResult.ai_explanation}
                    </div>
                  </div>
                )}
              </div>

              {/* Right Column: Map & Action */}
              <div className="col-span-12 lg:col-span-8 flex flex-col space-y-6">
                 {/* Map Container */}
                 <div className="flex-1 bg-slate-800 rounded-xl border border-slate-700 overflow-hidden relative min-h-[500px]">
                    <MapDisplay 
                      recommended={optResult?.recommended_route} 
                      alternatives={optResult?.alternatives}
                    />
                    
                    {/* Overlay Action */}
                    {optResult && (
                      <div className="absolute top-4 right-4 bg-slate-900/90 backdrop-blur border border-slate-600 p-4 rounded-lg shadow-xl max-w-sm">
                        <div className="text-xs text-slate-400 uppercase font-bold mb-1">AI Agent Decision</div>
                        <div className="text-lg font-bold text-white mb-2 flex items-center">
                          {optResult.action === 'REROUTE' ? (
                            <span className="text-yellow-400 flex items-center"><Navigation className="w-4 h-4 mr-2" /> REROUTE ACTIVE</span>
                          ) : (
                            <span className="text-brand-green flex items-center"><Truck className="w-4 h-4 mr-2" /> PROCEED</span>
                          )}
                        </div>
                        <div className="text-xs text-slate-300 border-t border-slate-700 pt-2 mt-2">
                           <span className="font-bold text-brand-accent">Customer Msg:</span> "{optResult.customer_message}"
                        </div>
                      </div>
                    )}
                 </div>
              </div>
            </div>
          )}

          {activeTab === 'fleet' && (
            <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden p-6">
               <div className="flex justify-between items-center mb-6">
                 <h2 className="text-xl font-bold flex items-center">
                   <Truck className="mr-2 text-brand-green"/> Fleet Allocation
                 </h2>
                 <div className="flex space-x-3">
                    <button 
                      onClick={() => setShowAddVehicle(!showAddVehicle)}
                      className="bg-brand-accent hover:bg-blue-600 text-white px-3 py-2 rounded text-sm font-bold flex items-center transition-colors"
                    >
                      {showAddVehicle ? <X className="w-4 h-4 mr-1"/> : <Plus className="w-4 h-4 mr-1"/>}
                      {showAddVehicle ? 'Cancel' : 'Add Vehicle'}
                    </button>
                    <button onClick={loadFleets} className="text-sm text-slate-400 hover:text-white underline">Refresh</button>
                 </div>
               </div>

               {/* Add Vehicle Form */}
               {showAddVehicle && (
                 <div className="bg-slate-900 p-4 rounded-lg border border-slate-700 mb-6">
                    <h3 className="text-sm font-bold text-slate-300 mb-3 uppercase">New Vehicle Details</h3>
                    <form onSubmit={handleSubmitVehicle} className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end">
                      <div>
                        <label className="block text-xs text-slate-500 mb-1">Vehicle ID</label>
                        <input 
                          type="text" 
                          required
                          value={newVehicle.vehicle_id}
                          onChange={e => setNewVehicle({...newVehicle, vehicle_id: e.target.value})}
                          className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-2 text-sm focus:border-brand-green outline-none"
                          placeholder="V-200"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-slate-500 mb-1">Type</label>
                        <select 
                          value={newVehicle.type}
                          onChange={e => setNewVehicle({...newVehicle, type: e.target.value})}
                          className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-2 text-sm focus:border-brand-green outline-none"
                        >
                          <option>Electric Van</option>
                          <option>Diesel Truck</option>
                          <option>Hybrid Lorry</option>
                          <option>Drone Swarm</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs text-slate-500 mb-1">Capacity</label>
                        <input 
                          type="number" 
                          required
                          value={newVehicle.capacity}
                          onChange={e => setNewVehicle({...newVehicle, capacity: parseInt(e.target.value)})}
                          className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-2 text-sm focus:border-brand-green outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-slate-500 mb-1">Status</label>
                        <select 
                          value={newVehicle.status}
                          onChange={e => setNewVehicle({...newVehicle, status: e.target.value})}
                          className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-2 text-sm focus:border-brand-green outline-none"
                        >
                          <option>Active</option>
                          <option>Maintenance</option>
                          <option>Idle</option>
                          <option>Testing</option>
                        </select>
                      </div>
                      <button 
                        type="submit"
                        className="bg-brand-green hover:bg-emerald-500 text-slate-900 font-bold py-2 px-4 rounded text-sm flex items-center justify-center"
                      >
                        <Save className="w-4 h-4 mr-2" /> Save
                      </button>
                    </form>
                 </div>
               )}

               <div className="overflow-x-auto rounded-lg border border-slate-700">
                 <table className="w-full text-left">
                    <thead className="bg-slate-900 text-slate-400 text-xs uppercase">
                      <tr>
                        <th className="px-6 py-4">Vehicle ID</th>
                        <th className="px-6 py-4">Type</th>
                        <th className="px-6 py-4">Status</th>
                        <th className="px-6 py-4">Assigned Orders</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-700 bg-slate-800/50">
                      {vehicles.map((v, idx) => {
                        let statusColor = 'text-slate-400';
                        let statusBg = 'bg-slate-700/50';
                        let StatusIcon = AlertCircle;

                        if (v.status === 'Active') {
                          statusColor = 'text-green-400';
                          statusBg = 'bg-green-900/30';
                          StatusIcon = CheckCircle;
                        } else if (v.status === 'Idle') {
                          statusColor = 'text-yellow-400';
                          statusBg = 'bg-yellow-900/30';
                          StatusIcon = Clock;
                        } else if (v.status === 'Maintenance' || v.status === 'Repair') {
                          statusColor = 'text-red-400';
                          statusBg = 'bg-red-900/30';
                          StatusIcon = Wrench;
                        } else if (v.status === 'Testing') {
                          statusColor = 'text-blue-400';
                          statusBg = 'bg-blue-900/30';
                          StatusIcon = Activity;
                        }

                        return (
                          <tr key={idx} className="hover:bg-slate-700/50 transition-colors">
                            <td className="px-6 py-4 font-medium text-white">{v.vehicle_id}</td>
                            <td className="px-6 py-4 text-slate-300">{v.type}</td>
                            <td className="px-6 py-4">
                              <span className={`px-2 py-1 rounded text-xs font-bold flex items-center w-fit ${statusBg} ${statusColor}`}>
                                <StatusIcon className="w-3 h-3 mr-1.5" />
                                {v.status}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-slate-300 font-mono text-xs">
                              {v.assigned_orders?.join(', ') || '-'}
                            </td>
                          </tr>
                        );
                      })}
                      {vehicles.length === 0 && (
                         <tr>
                           <td colSpan={4} className="px-6 py-8 text-center text-slate-500">No fleet data available.</td>
                         </tr>
                      )}
                    </tbody>
                 </table>
               </div>
            </div>
          )}

          {activeTab === 'history' && (
            <div className="grid grid-cols-12 gap-6 h-full">
              {/* Left Column: List & Filters */}
              <div className="col-span-12 lg:col-span-6 flex flex-col space-y-6">
                 {/* Controls */}
                 <div className="bg-slate-800 p-6 rounded-xl border border-slate-700">
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <h2 className="text-xl font-bold flex items-center mb-1">
                          <History className="mr-2 text-brand-green"/> Historical Analysis
                        </h2>
                        <p className="text-xs text-slate-400">Analyze past performance and emissions.</p>
                      </div>
                    </div>
                    
                    <div className="flex gap-4 items-end">
                      <div className="flex-1">
                        <label className="block text-xs text-slate-500 mb-1">Start Date</label>
                        <input 
                          type="date" 
                          className="w-full bg-slate-900 border border-slate-700 text-white text-sm rounded px-3 py-2 outline-none focus:border-brand-green"
                          value={dateRange.start}
                          onChange={(e) => setDateRange({...dateRange, start: e.target.value})}
                        />
                      </div>
                      <div className="flex-1">
                        <label className="block text-xs text-slate-500 mb-1">End Date</label>
                        <input 
                          type="date" 
                          className="w-full bg-slate-900 border border-slate-700 text-white text-sm rounded px-3 py-2 outline-none focus:border-brand-green"
                          value={dateRange.end}
                          onChange={(e) => setDateRange({...dateRange, end: e.target.value})}
                        />
                      </div>
                      <button 
                        onClick={handleResetHistory} 
                        className="bg-slate-700 hover:bg-slate-600 text-xs px-3 py-2 rounded text-slate-300 h-[38px]"
                      >
                        Reset
                      </button>
                    </div>
                 </div>

                 {/* Aggregate Stats */}
                 <div className="grid grid-cols-3 gap-4">
                     <div className="bg-slate-800 p-3 rounded-xl border border-slate-700">
                        <div className="text-slate-500 text-[10px] uppercase font-bold mb-1">Total Emissions</div>
                        <div className="text-lg font-bold text-white">
                          {historyStats.totalCarbon.toFixed(1)} <span className="text-xs text-slate-500 font-normal">kg</span>
                        </div>
                     </div>
                     <div className="bg-slate-800 p-3 rounded-xl border border-slate-700">
                        <div className="text-slate-500 text-[10px] uppercase font-bold mb-1">Avg Rating</div>
                        <div className="text-lg font-bold text-yellow-400">
                          {historyStats.avgRating.toFixed(1)} <span className="text-xs text-slate-500 font-normal">/5</span>
                        </div>
                     </div>
                     <div className="bg-slate-800 p-3 rounded-xl border border-slate-700">
                        <div className="text-slate-500 text-[10px] uppercase font-bold mb-1">Delays</div>
                        <div className={`text-lg font-bold ${historyStats.totalDelays > 0 ? 'text-red-400' : 'text-green-400'}`}>
                          {historyStats.totalDelays}
                        </div>
                     </div>
                 </div>

                 {/* Data Table */}
                 <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden flex-1 flex flex-col">
                   <div className="overflow-auto flex-1 h-[400px]">
                     <table className="w-full text-left">
                        <thead className="bg-slate-900 text-slate-400 text-xs uppercase sticky top-0 z-10">
                          <tr>
                            <th className="px-4 py-3">Date</th>
                            <th className="px-4 py-3">Route</th>
                            <th className="px-4 py-3">Status</th>
                            <th className="px-4 py-3 text-right">Rating</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-700 bg-slate-800/50">
                          {filteredHistory.map((log) => (
                            <tr 
                              key={log.log_id} 
                              onClick={() => setSelectedLogId(log.log_id)}
                              className={`cursor-pointer transition-colors ${selectedLogId === log.log_id ? 'bg-brand-green/20 border-l-2 border-brand-green' : 'hover:bg-slate-700/50'}`}
                            >
                              <td className="px-4 py-3 text-slate-300 text-xs whitespace-nowrap">
                                {new Date(log.timestamp).toLocaleDateString()}
                              </td>
                              <td className="px-4 py-3 text-white text-xs">
                                {log.route_id}
                                <div className="text-[10px] text-slate-500">{log.vehicle_id}</div>
                              </td>
                              <td className="px-4 py-3">
                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                  log.status === 'Completed' ? 'bg-green-900/50 text-green-400' : 
                                  log.status === 'Delayed' ? 'bg-red-900/50 text-red-400' : 'bg-yellow-900/50 text-yellow-400'
                                }`}>
                                  {log.status}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-yellow-400 text-xs text-right">{'★'.repeat(Math.round(Number(log.customer_rating)))}</td>
                            </tr>
                          ))}
                          {filteredHistory.length === 0 && (
                             <tr>
                               <td colSpan={4} className="px-6 py-12 text-center text-slate-500">
                                  No logs found.
                               </td>
                             </tr>
                          )}
                        </tbody>
                     </table>
                   </div>
                 </div>
              </div>

              {/* Right Column: Map Visualization */}
              <div className="col-span-12 lg:col-span-6 flex flex-col h-full">
                 <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden relative flex-1 min-h-[500px]">
                    <MapDisplay 
                      historicalRoute={selectedHistoricalRouteCoords} 
                      historicalLogData={selectedLog ? { id: selectedLog.log_id, timestamp: selectedLog.timestamp } : undefined}
                    />
                    
                    {/* Map Overlay Info */}
                    {!selectedLogId && (
                      <div className="absolute inset-0 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm pointer-events-none">
                        <div className="text-center">
                          <MapPin className="w-12 h-12 text-slate-500 mx-auto mb-2 opacity-50"/>
                          <p className="text-slate-400 font-medium">Select a trip log to view route</p>
                        </div>
                      </div>
                    )}
                    
                    {selectedLogId && (
                      <div className="absolute top-4 left-4 right-4 bg-slate-900/90 backdrop-blur border border-slate-600 p-4 rounded-lg shadow-xl z-[400]">
                         {(() => {
                           const log = historyLogs.find(l => l.log_id === selectedLogId);
                           if (!log) return null;
                           return (
                             <>
                              <div className="flex justify-between items-center mb-3">
                                <div>
                                  <h3 className="font-bold text-white text-sm">{log.log_id} - {log.vehicle_id}</h3>
                                  <p className="text-xs text-slate-400">{log.timestamp}</p>
                                </div>
                                <div className="text-right">
                                    <div className="text-xs text-slate-500 uppercase font-bold">Carbon Impact</div>
                                    <div className="text-brand-green font-mono">{log.carbon_emitted_kg} kg</div>
                                </div>
                              </div>
                              <div className="bg-slate-800/50 p-3 rounded border border-slate-700/50">
                                <div className="flex items-center text-xs text-slate-400 uppercase font-bold mb-1">
                                  <Server className="w-3 h-3 mr-1 text-brand-accent"/> AI Analysis
                                </div>
                                <div className="text-xs text-slate-300 leading-relaxed italic">
                                  {explanationLoading ? "Analyzing logistics data..." : selectedLogExplanation}
                                </div>
                              </div>
                             </>
                           );
                         })()}
                      </div>
                    )}
                 </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
};

export default App;