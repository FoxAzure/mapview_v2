// ================================= DOCUMENTATION ------------------------------------------
// Script: MapView.jsx
// Purpose: Interface profissional, busca inferior, rastreamento persistente e limpeza de strings.
// ===========================================================================================

import { useState, useMemo, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, GeoJSON, Marker, useMap } from 'react-leaflet';
import L from 'leaflet';
import * as topojson from 'topojson-client';
import 'leaflet/dist/leaflet.css';

import dadosTopoJson from '../assets/areas.json';
import pinCustomizado from '../assets/pin.png';

const CONFIG_ZOOM_PROXIMIDADE = 16;
const COR_LOTE_ATIVO_BORDA = '#FF8C00';
const COR_LOTE_ATIVO_FUNDO = '#FFDAB9';

// ================================= UTILS --------------------------------------------------

const formatarNome = (nome) => (nome ? nome.replace(/_/g, ' ') : '');

const iconeGps = new L.Icon({
  iconUrl: pinCustomizado,
  iconSize: [34, 34],
  iconAnchor: [17, 34]
});

// ================================= HELPERS ------------------------------------------------

const isPointInPolygon = (point, vs) => {
  let x = point[0], y = point[1], inside = false;
  for (let i = 0, j = vs.length - 1; i < vs.length; j = i++) {
    let xi = vs[i][0], yi = vs[i][1], xj = vs[j][0], yj = vs[j][1];
    let intersect = ((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
};

const isPointInFeature = (ptLngLat, feature) => {
  if (!feature.geometry) return false;
  const type = feature.geometry.type;
  if (type === 'Polygon') return isPointInPolygon(ptLngLat, feature.geometry.coordinates[0]);
  if (type === 'MultiPolygon') {
    for (let poly of feature.geometry.coordinates) if (isPointInPolygon(ptLngLat, poly[0])) return true;
  }
  return false;
};

// ================================= COMPONENTES --------------------------------------------

function MotorDeCamera({ bounds, center, zoom, seguir }) {
  const map = useMap();
  useEffect(() => {
    if (bounds) map.fitBounds(bounds, { padding: [60, 60], animate: true });
    else if (center && zoom) map.setView(center, zoom, { animate: true });
  }, [bounds, center, zoom, seguir, map]);
  return null;
}

function RastreadorGps({ setPosicaoUsuario }) {
  const map = useMap();
  useEffect(() => {
    map.locate({ watch: true, enableHighAccuracy: true });
    map.on('locationfound', (e) => setPosicaoUsuario([e.latlng.lat, e.latlng.lng]));
  }, [map, setPosicaoUsuario]);
  return null;
}

// ================================= EXECUTOR -----------------------------------------------

export default function MapView() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedField, setSelectedField] = useState(null);
  const [showLots, setShowLots] = useState(false);
  const [showStreets, setShowStreets] = useState(false);
  const [seguirUsuario, setSeguirUsuario] = useState(false);
  
  const [posicaoUsuario, setPosicaoUsuario] = useState(null);
  const [camera, setCamera] = useState({ bounds: null, center: [-9.39, -40.50], zoom: 12 });
  const [localAtual, setLocalAtual] = useState(null);

  const dadosGeoJson = useMemo(() => {
    if (!dadosTopoJson) return null;
    return topojson.feature(dadosTopoJson, dadosTopoJson.objects[Object.keys(dadosTopoJson.objects)[0]]);
  }, []);

  // Efeito de Seguir Usuário
  useEffect(() => {
    if (seguirUsuario && posicaoUsuario) {
      setCamera({ center: posicaoUsuario, zoom: CONFIG_ZOOM_PROXIMIDADE, bounds: null });
    }
  }, [posicaoUsuario, seguirUsuario]);

  // Radar de Localização
  useEffect(() => {
    if (!posicaoUsuario || !dadosGeoJson) return;
    const ptLngLat = [posicaoUsuario[1], posicaoUsuario[0]];
    let achou = false;
    for (let f of dadosGeoJson.features) {
      if (isPointInFeature(ptLngLat, f)) {
        setLocalAtual({ 
          campo: formatarNome(f.properties.NOME_FAZ), 
          talhao: f.properties.TALHAO 
        });
        achou = true; break;
      }
    }
    if (!achou) setLocalAtual(null);
  }, [posicaoUsuario, dadosGeoJson]);

  const toggleCampo = (nomeOriginal) => {
    if (selectedField === nomeOriginal) {
      setSelectedField(null);
      setSearchTerm('');
      setShowLots(false);
    } else {
      setSelectedField(nomeOriginal);
      setSearchTerm(formatarNome(nomeOriginal));
      setShowLots(true);
      const features = dadosGeoJson.features.filter(f => f.properties.NOME_FAZ === nomeOriginal);
      if (features.length > 0) setCamera({ bounds: L.geoJSON(features).getBounds(), center: null, zoom: null });
    }
  };

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      <style>{`
        .map-label-custom { font-family: Arial; font-size: 11px; font-weight: bold; color: white; text-shadow: 1px 1px 0 #000; background: none; border: none; white-space: nowrap; }
        .control-panel { background: #fff; padding: 15px; border-top: 1px solid #ccc; z-index: 1000; }
        input, button { padding: 10px; border-radius: 5px; border: 1px solid #ccc; }
      `}</style>

      <div style={{ flex: 1, position: 'relative' }}>
        <MapContainer center={camera.center} zoom={camera.zoom} style={{ height: '100%', width: '100%' }}>
          <TileLayer url="https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}" maxZoom={20} />
          <MotorDeCamera {...camera} seguir={seguirUsuario} />
          <RastreadorGps setPosicaoUsuario={setPosicaoUsuario} />
          
          {posicaoUsuario && <Marker position={posicaoUsuario} icon={iconeGps} />}
          
          {dadosGeoJson && (
            <GeoJSON data={dadosGeoJson} style={(f) => {
              const isSelected = selectedField === f.properties.NOME_FAZ;
              const isRua = f.properties.TALHAO == 666;
              const isUserHere = localAtual && f.properties.NOME_FAZ === localAtual.campo && f.properties.TALHAO == localAtual.talhao;
              
              if (isUserHere) return { color: COR_LOTE_ATIVO_BORDA, weight: 3, fillColor: COR_LOTE_ATIVO_FUNDO, fillOpacity: 0.6 };
              if (selectedField && !isSelected) return { color: '#333', weight: 1, opacity: 0.1, fillColor: '#000', fillOpacity: 0.05 };
              if (isRua) return { color: '#666', weight: 1, opacity: 0.5, fillColor: '#505050', fillOpacity: 0.1 };
              
              return { color: '#007A4D', weight: 1.5, opacity: 0.9, fillColor: '#00D68F', fillOpacity: 0.25 };
            }} onEachFeature={(f, l) => {
              if (showLots && f.properties.TALHAO != 666 && (!selectedField || f.properties.NOME_FAZ == selectedField))
                l.bindTooltip(String(f.properties.TALHAO), { permanent: true, className: 'map-label-custom' });
              l.on('click', () => toggleCampo(f.properties.NOME_FAZ));
            }} />
          )}
        </MapContainer>
      </div>

      {/* PAINEL INFERIOR FIXO */}
      <div className="control-panel">
        <div style={{ display: 'flex', gap: '5px', marginBottom: '10px' }}>
          <input style={{ flex: 1 }} value={searchTerm} readOnly placeholder="Selecione um campo..." />
          <button onClick={() => setCamera({ center: posicaoUsuario, zoom: CONFIG_ZOOM_PROXIMIDADE })}>Você</button>
        </div>
        
        {localAtual && (
          <div style={{ fontSize: '14px', fontWeight: 'bold', marginBottom: '10px' }}>
            {localAtual.talhao == 666 
              ? `Estou em: Ruas do campo ${localAtual.campo}` 
              : `Estou em: ${localAtual.campo}, lote ${localAtual.talhao}`}
          </div>
        )}

        <div style={{ display: 'flex', gap: '5px' }}>
          <button onClick={() => setSeguirUsuario(!seguirUsuario)} style={{ background: seguirUsuario ? '#007A4D' : '#eee' }}>
            {seguirUsuario ? 'Seguindo' : 'Seguir'}
          </button>
          <button onClick={() => setShowLots(!showLots)}>Lotes: {showLots ? 'ON' : 'OFF'}</button>
          <button onClick={() => setShowStreets(!showStreets)}>Ruas: {showStreets ? 'ON' : 'OFF'}</button>
        </div>
      </div>
    </div>
  );
}