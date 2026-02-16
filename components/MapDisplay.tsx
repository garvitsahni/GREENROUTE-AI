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
}

const MapDisplay: React.FC<MapDisplayProps> = ({ recommended, alternatives }) => {
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

    // Draw Alternatives (Gray/Dashed)
    if (alternatives) {
      alternatives.forEach(alt => {
        const poly = window.L.polyline(alt.coordinates, {
          color: '#64748b',
          weight: 3,
          dashArray: '5, 10',
          opacity: 0.6
        }).addTo(leafletMap.current);
        layersRef.current.push(poly);
      });
    }

    // Draw Recommended (Bright Green)
    if (recommended) {
      const poly = window.L.polyline(recommended.coordinates, {
        color: '#10b981',
        weight: 5,
        opacity: 1
      }).addTo(leafletMap.current);
      layersRef.current.push(poly);

      // Fit bounds
      const bounds = window.L.latLngBounds(recommended.coordinates);
      leafletMap.current.fitBounds(bounds, { padding: [50, 50] });
    }

  }, [recommended, alternatives]);

  return <div ref={mapRef} className="w-full h-full min-h-[400px] rounded-lg shadow-lg z-0" />;
};

export default MapDisplay;