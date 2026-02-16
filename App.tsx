import React, { useState, useEffect, useCallback } from 'react';
import { Activity, Truck, Mic, Radio, Navigation, Leaf, AlertTriangle, MessageSquare, Server, Plus, X, Save } from 'lucide-react';
import MapDisplay from './components/MapDisplay';
import { fetchHealth, fetchOptimization, fetchFleets, fetchSimulationStatus, sendVoiceQuery, addVehicle } from './services/api';
import { OptimizationResult, Vehicle, SimulationStatus } from './types';

const App = () => {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'fleet'>('dashboard');
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

  useEffect(() => {
    if (activeTab === 'fleet') {
      loadFleets();
    }
  }, [activeTab, loadFleets]);

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
        <nav className="w-64 bg-slate-800 border-r border-slate-700 p-4 flex flex-col space-y-2 z-10">
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
                      {vehicles.map((v, idx) => (
                        <tr key={idx} className="hover:bg-slate-700/50 transition-colors">
                          <td className="px-6 py-4 font-medium text-white">{v.vehicle_id}</td>
                          <td className="px-6 py-4 text-slate-300">{v.type}</td>
                          <td className="px-6 py-4">
                            <span className={`px-2 py-1 rounded text-xs font-bold ${v.status === 'Active' ? 'bg-green-900/50 text-green-400' : 'bg-slate-700 text-slate-400'}`}>
                              {v.status}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-slate-300 font-mono text-xs">
                            {v.assigned_orders?.join(', ') || '-'}
                          </td>
                        </tr>
                      ))}
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
        </main>
      </div>
    </div>
  );
};

export default App;