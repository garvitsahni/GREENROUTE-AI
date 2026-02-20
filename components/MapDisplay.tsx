import React, { useEffect, useRef } from 'react';
import { RouteOption } from '../types';

declare global {
  interface Window {
    L: any;
  }
}

interface MapDisplayProps {
  recommended?: RouteOption;
  alternatives?: RouteOption[];
  historicalRoute?: [number, number][];
  historicalLogData?: { id: string; timestamp: string };
}

const MapDisplay: React.FC<MapDisplayProps> = ({ recommended, alternatives, historicalRoute, historicalLogData }) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const leafletMap = useRef<any>(null);
  const layersRef = useRef<any[]>([]);

  useEffect(() => {
    if (mapRef.current && !leafletMap.current && window.L) {
      // Initialize Map
      leafletMap.current = window.L.map(mapRef.current).setView([40.7128, -74.0060], 11);

      window.L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
        subdomains: 'abcd',
        maxZoom: 19
      }).addTo(leafletMap.current);
    }
  }, []);

  useEffect(() => {
    if (!leafletMap.current || !window.L) return;

    // Clear previous layers
    layersRef.current.forEach(layer => leafletMap.current.removeLayer(layer));
    layersRef.current = [];

    let hasContent = false;

    // 1. Draw Alternatives (Gray/Dashed) - Only if no historical route is active
    if (alternatives && !historicalRoute) {
      alternatives.forEach(alt => {
        const poly = window.L.polyline(alt.coordinates, {
          color: '#64748b',
          weight: 3,
          dashArray: '5, 10',
          opacity: 0.6
        })
        .bindTooltip(`
          <div style="font-family: sans-serif; text-align: center;">
            <div style="font-weight: bold; color: #64748b;">${alt.name}</div>
            <div>ETA: ${alt.eta_mins} mins</div>
          </div>
        `, { sticky: true, className: 'custom-tooltip' })
        .addTo(leafletMap.current);
        layersRef.current.push(poly);
        hasContent = true;
      });
    }

    // 2. Draw Recommended (Bright Green) - Only if no historical route is active
    if (recommended && !historicalRoute) {
      const poly = window.L.polyline(recommended.coordinates, {
        color: '#10b981',
        weight: 5,
        opacity: 1
      })
      .bindTooltip(`
        <div style="font-family: sans-serif; text-align: center;">
          <div style="font-weight: bold; color: #10b981;">${recommended.name}</div>
          <div style="font-size: 0.8em; text-transform: uppercase;">Recommended</div>
          <div>ETA: ${recommended.eta_mins} mins</div>
        </div>
      `, { sticky: true, className: 'custom-tooltip' })
      .addTo(leafletMap.current);
      layersRef.current.push(poly);

      // Fit bounds
      const bounds = window.L.latLngBounds(recommended.coordinates);
      leafletMap.current.fitBounds(bounds, { padding: [50, 50] });
      hasContent = true;
    }

    // 3. Draw Historical Route (Purple)
    if (historicalRoute) {
      const poly = window.L.polyline(historicalRoute, {
        color: '#8b5cf6', // Violet/Purple
        weight: 5,
        opacity: 1
      }).addTo(leafletMap.current);
      layersRef.current.push(poly);

      // Add start/end markers for historical
      if (historicalRoute.length > 0) {
        const startCoords = historicalRoute[0];
        const endCoords = historicalRoute[historicalRoute.length - 1];
        
        const start = window.L.circleMarker(startCoords, { radius: 8, color: '#fff', fillColor: '#8b5cf6', fillOpacity: 1 }).addTo(leafletMap.current);
        const end = window.L.circleMarker(endCoords, { radius: 8, color: '#fff', fillColor: '#8b5cf6', fillOpacity: 1 }).addTo(leafletMap.current);
        
        if (historicalLogData) {
            start.bindTooltip(`
              <div style="font-family: sans-serif;">
                <b>Start Point</b><br/>
                Log ID: ${historicalLogData.id}
              </div>
            `, { direction: 'top', offset: [0, -10] });
            
            end.bindTooltip(`
              <div style="font-family: sans-serif;">
                <b>End Point</b><br/>
                ${new Date(historicalLogData.timestamp).toLocaleString()}
              </div>
            `, { direction: 'top', offset: [0, -10] });
        }

        layersRef.current.push(start);
        layersRef.current.push(end);
      }

      const bounds = window.L.latLngBounds(historicalRoute);
      leafletMap.current.fitBounds(bounds, { padding: [50, 50] });
      hasContent = true;
    }

    // If no content is drawn, reset view to default
    if (!hasContent) {
      leafletMap.current.setView([40.7128, -74.0060], 11);
    }

  }, [recommended, alternatives, historicalRoute, historicalLogData]);

  return <div ref={mapRef} className="w-full h-full min-h-[400px] rounded-lg shadow-lg z-0" />;
};

export default MapDisplay;