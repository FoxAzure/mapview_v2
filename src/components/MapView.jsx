// ================================= DOCUMENTATION ------------------------------------------
// Script: MapView.jsx
// Purpose: Tela principal com o mapa de satélite, busca de áreas e toggle de lotes.
// ================================= EXECUTOR -----------------------------------------------
import { useState } from 'react';
import { MapContainer, TileLayer } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';

export default function MapView() {
  const [searchTerm, setSearchTerm] = useState('');
  const [showLots, setShowLots] = useState(false);

  // Coordenadas iniciais (exemplo: centro do Brasil, depois ajustamos para Juazeiro/Petrolina)
  const initialPosition = [-9.11, -40.50]; 

  return (
    <div className="mapview-container">
      {/* --- TOPO: Busca --- */}
      <div className="search-bar">
        <input 
          type="text" 
          placeholder="Buscar campo... (Ex: Campo 12)" 
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
        {/* Aqui depois vamos renderizar a lista suspensa conforme a digitação */}
      </div>

      {/* --- CENTRO: O Mapa --- */}
      <div className="map-wrapper">
        <MapContainer center={initialPosition} zoom={13} style={{ height: '100%', width: '100%' }}>
          {/* Camada de Satélite do Google Maps */}
          <TileLayer
            url="https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}"
            attribution="&copy; Google Maps"
            maxZoom={20}
          />
          {/* Aqui depois vamos injetar o seu <GeoJSON /> com os filtros */}
        </MapContainer>
      </div>

      {/* --- RODAPÉ: Filtro de Lotes --- */}
      <div className="bottom-controls">
        <label className="checkbox-label">
          <input 
            type="checkbox" 
            checked={showLots}
            onChange={(e) => setShowLots(e.target.checked)}
          />
          Exibir Lotes (Desmarcado = Visão Limpa)
        </label>
      </div>
    </div>
  );
}