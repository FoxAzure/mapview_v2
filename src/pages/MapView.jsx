// ================================= DOCUMENTATION ------------------------------------------
// Script: MapView.jsx
// Purpose: Código limpo, leve, otimizado com cliques nos nomes, cores mais vivas e botão GPS flutuante.
// Relationships: Usa dados em TopoJSON e Leaflet.
// ================================= VARIABLES ----------------------------------------------

import { useState, useMemo, useEffect } from 'react';
import { MapContainer, TileLayer, GeoJSON, Marker, Tooltip, useMap } from 'react-leaflet';
import L from 'leaflet';
import * as topojson from 'topojson-client';
import 'leaflet/dist/leaflet.css';

import dadosTopoJson from '../assets/areas.json';
import pinCustomizado from '../assets/pin.png';

const CONFIG_ZOOM_PROXIMIDADE = 16;

// Paleta de Cores Customizada
const COR_LOTE_ATIVO_BORDA = '#FF8C00'; // Laranja Vivo (Onde você está pisando)
const COR_LOTE_ATIVO_FUNDO = '#FFDAB9'; // Laranja Pastel

// ================================= ICONES -------------------------------------------------

const iconeGps = new L.Icon({
  iconUrl: pinCustomizado,
  iconSize: [34, 34],
  iconAnchor: [17, 34]
});

// Helper para gerar o ícone de texto físico (agora é clicável de verdade!)
const criarIconeTexto = (nome) => new L.DivIcon({
  className: 'map-label-custom clickable-marker',
  html: nome,
  iconSize: null, // Deixa o conteúdo ditar o tamanho
  iconAnchor: [0, 0] // O CSS cuida de centralizar
});

// ================================= HELPERS ------------------------------------------------

// Algoritmo Ray-Casting levinho para validação de coordenadas no dispositivo
const isPointInPolygon = (point, vs) => {
  let x = point[0], y = point[1];
  let inside = false;
  for (let i = 0, j = vs.length - 1; i < vs.length; j = i++) {
    let xi = vs[i][0], yi = vs[i][1];
    let xj = vs[j][0], yj = vs[j][1];
    let intersect = ((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
};

const isPointInFeature = (ptLngLat, feature) => {
  if (!feature.geometry) return false;
  const type = feature.geometry.type;
  const coords = feature.geometry.coordinates;

  if (type === 'Polygon') {
    return isPointInPolygon(ptLngLat, coords[0]);
  } else if (type === 'MultiPolygon') {
    for (let poly of coords) {
      if (isPointInPolygon(ptLngLat, poly[0])) return true;
    }
  }
  return false;
};

// ================================= CAMERA -------------------------------------------------

function MotorDeCamera({ bounds, center, zoom }) {
  const map = useMap();
  useEffect(() => {
    if (bounds) {
      map.fitBounds(bounds, { padding: [60, 60], animate: true });
    } else if (center && zoom) {
      map.setView(center, zoom, { animate: true });
    }
  }, [bounds, center, zoom, map]);
  return null;
}

// ================================= GPS LITE -----------------------------------------------

function RastreadorGps({ setPosicaoUsuario, setCamera }) {
  const map = useMap();
  useEffect(() => {
    map.locate({ watch: true, enableHighAccuracy: true });
    map.on('locationfound', (e) => {
      const pos = [e.latlng.lat, e.latlng.lng];
      setPosicaoUsuario((oldPos) => {
        if (!oldPos) {
          setCamera({ center: pos, zoom: CONFIG_ZOOM_PROXIMIDADE, bounds: null });
        }
        return pos;
      });
    });
  }, [map, setPosicaoUsuario, setCamera]);
  return null;
}

// ================================= EXECUTOR -----------------------------------------------

export default function MapView() {

  // ================================= STATES -----------------------------------------------

  const [searchTerm, setSearchTerm] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [selectedField, setSelectedField] = useState(null);

  const [showFieldNames, setShowFieldNames] = useState(true);
  const [showLots, setShowLots] = useState(false);
  const [showStreets, setShowStreets] = useState(false);

  const [bottomMenuOpen, setBottomMenuOpen] = useState(true);
  
  const [posicaoUsuario, setPosicaoUsuario] = useState(null);
  const [camera, setCamera] = useState({ bounds: null, center: [-9.39, -40.50], zoom: 12 });
  
  const [localAtual, setLocalAtual] = useState(null);

  // ================================= GEOJSON ----------------------------------------------

  const dadosGeoJson = useMemo(() => {
    if (!dadosTopoJson || dadosTopoJson.type !== 'Topology') return null;
    return topojson.feature(
      dadosTopoJson,
      dadosTopoJson.objects[Object.keys(dadosTopoJson.objects)[0]]
    );
  }, []);

  // ================================= RADAR DE LOTE ----------------------------------------
  
  useEffect(() => {
    if (!posicaoUsuario || !dadosGeoJson) return;
    const ptLngLat = [posicaoUsuario[1], posicaoUsuario[0]]; 
    
    let achou = false;
    for (let f of dadosGeoJson.features) {
      if (isPointInFeature(ptLngLat, f)) {
        setLocalAtual({ campo: f.properties.NOME_FAZ, talhao: f.properties.TALHAO });
        achou = true;
        break;
      }
    }
    if (!achou) setLocalAtual(null);
  }, [posicaoUsuario, dadosGeoJson]);

  // ================================= LISTA CAMPOS ------------------------------------------

  const listaFazendas = useMemo(() => {
    if (!dadosGeoJson) return [];
    const nomes = new Set();
    dadosGeoJson.features.forEach((feature) => {
      if (feature.properties?.NOME_FAZ) nomes.add(feature.properties.NOME_FAZ);
    });
    return Array.from(nomes).sort();
  }, [dadosGeoJson]);

  const fazendasFiltradas = listaFazendas.filter((nome) =>
    nome.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // ================================= CENTROS (Nomes) ---------------------------------------

  const centrosFazendas = useMemo(() => {
    if (!dadosGeoJson) return [];
    const grupos = {};
    dadosGeoJson.features.forEach((feature) => {
      const props = feature.properties || {};
      if (!props.NOME_FAZ || props.TALHAO == 666) return;
      if (!grupos[props.NOME_FAZ]) grupos[props.NOME_FAZ] = [];
      grupos[props.NOME_FAZ].push(feature);
    });

    return Object.keys(grupos).map((nome) => {
      try {
        const layer = L.geoJSON(grupos[nome]);
        const center = layer.getBounds().getCenter();
        return { nome, centro: [center.lat, center.lng] };
      } catch { return null; }
    }).filter(Boolean);
  }, [dadosGeoJson]);

  // ================================= AÇÕES E ROTEAMENTO ------------------------------------

  const limparFiltro = () => {
    setSearchTerm('');
    setSelectedField(null);
    setIsDropdownOpen(false);
    setShowLots(false); 
  };

  const selecionarCampo = (nomeFazenda) => {
    setSearchTerm(nomeFazenda);
    setSelectedField(nomeFazenda);
    setShowLots(true); 
    setIsDropdownOpen(false);

    if (!dadosGeoJson) return;
    const features = dadosGeoJson.features.filter((f) => f.properties?.NOME_FAZ === nomeFazenda);
    if (features.length > 0) {
      const layer = L.geoJSON(features);
      setCamera({ bounds: layer.getBounds(), center: null, zoom: null });
    }
  };

  const focarNoUsuario = () => {
    if (!posicaoUsuario) {
      // Se não tiver GPS ainda, tenta forçar a atualização (feedback visual pro usuário)
      alert("Aguardando o sinal do GPS... Tente novamente em alguns segundos!");
      return;
    }
    setCamera({ center: posicaoUsuario, zoom: CONFIG_ZOOM_PROXIMIDADE, bounds: null });
  };

  const focarCampo = () => {
    if (!selectedField || !dadosGeoJson) return;
    const features = dadosGeoJson.features.filter((f) => f.properties?.NOME_FAZ === selectedField);
    if (features.length > 0) {
      const layer = L.geoJSON(features);
      setCamera({ bounds: layer.getBounds(), center: null, zoom: null });
    }
  };

  const focarRotas = () => {
    if (!selectedField || !dadosGeoJson) return;
    const features = dadosGeoJson.features.filter((f) => f.properties?.NOME_FAZ === selectedField);
    if (features.length > 0) {
      const layer = L.geoJSON(features);
      const bounds = layer.getBounds();
      if (posicaoUsuario) bounds.extend(posicaoUsuario);
      setCamera({ bounds, center: null, zoom: null });
    }
  };

  // ================================= DADOS DO MAPA (PERFORMANCE) ---------------------------

  const dadosParaMapa = useMemo(() => {
    if (!dadosGeoJson) return null;
    return {
      ...dadosGeoJson,
      features: dadosGeoJson.features.filter((f) => {
        const props = f.properties || {};
        if (!showStreets && props.TALHAO == 666) return false;
        return true; 
      })
    };
  }, [dadosGeoJson, showStreets]);

  // ================================= ESTILO DE ÁREAS (REALCE) ------------------------------

  const obterEstiloArea = (feature) => {
    const props = feature.properties || {};
    const isRua = props.TALHAO == 666;
    const isSelectedField = selectedField && props.NOME_FAZ === selectedField;
    const isUserHere = localAtual && props.NOME_FAZ === localAtual.campo && props.TALHAO === localAtual.talhao;

    if (isUserHere) {
      return { color: COR_LOTE_ATIVO_BORDA, weight: 3, opacity: 1, fillColor: COR_LOTE_ATIVO_FUNDO, fillOpacity: 0.6 };
    }

    if (selectedField) {
      if (isSelectedField) {
        return { color: '#00ff88', weight: 2.5, opacity: 1, fillColor: '#00c97a', fillOpacity: 0.35 };
      } else {
        return { color: '#333333', weight: 0.5, opacity: 0.3, fillColor: '#1a1a1a', fillOpacity: 0.1 };
      }
    }

    if (isRua) {
      return { color: '#666666', weight: 1, opacity: 0.7, fillColor: '#505050', fillOpacity: 0.18 };
    }
    
    // NOVO VISUAL AGRÍCOLA MAIS FORTE E VISÍVEL
    return {
      color: '#007A4D', // Borda verde escura sólida e marcante
      weight: showLots ? 2 : 1.5, // Mais grossa
      opacity: 0.9, // Quase opaco na linha
      fillColor: '#00D68F', // Verde interno mais vivo
      fillOpacity: 0.25 // Fundo sutil mas presente
    };
  };

  // ================================= PLACAS DE LOTES ---------------------------------------

  const aoCriarCadaArea = (feature, layer) => {
    const props = feature.properties || {};
    const isRua = props.TALHAO == 666;

    const deveMostrarLote = !isRua && showLots && (!selectedField || props.NOME_FAZ === selectedField);

    if (deveMostrarLote) {
      layer.bindTooltip(`${props.TALHAO}`, {
        permanent: true,
        direction: 'center',
        className: 'map-label-custom',
        opacity: 1
      });
    }
  };

  // ================================= NOMES DOS CAMPOS --------------------------------------

  const centrosParaExibir = useMemo(() => {
    if (selectedField) {
      return centrosFazendas.filter((f) => f.nome === selectedField);
    }
    return centrosFazendas;
  }, [centrosFazendas, selectedField]);

  // ================================= RENDER ================================================

  return (
    <div className="mapview-container" style={{ position: 'relative' }}>
      
      <style>{`
        .map-label-custom {
          font-family: Arial, sans-serif !important;
          font-size: 11px !important;
          font-weight: bold;
          color: white !important;
          text-shadow: 
            -1px -1px 0 #000,  
             1px -1px 0 #000,
            -1px  1px 0 #000,
             1px  1px 0 #000;
          background: transparent !important;
          border: none !important;
          box-shadow: none !important;
          white-space: nowrap;
          transform: translate(-50%, -50%); /* Centraliza o texto no Marker DivIcon */
        }
        .map-label-custom::before { display: none; }
        .clickable-marker { 
          cursor: pointer; 
          pointer-events: auto !important; /* Essencial para o clique funcionar no texto */
        }
        /* Botão flutuante de GPS (Centralizar) */
        .floating-gps-btn {
          position: absolute;
          bottom: 140px; /* Acima da plaquinha de Estou Em... */
          right: 20px;
          z-index: 1000;
          background-color: white;
          border: 2px solid rgba(0,0,0,0.2);
          border-radius: 50%;
          width: 44px;
          height: 44px;
          display: flex;
          align-items: center;
          justifyContent: center;
          box-shadow: 0 2px 6px rgba(0,0,0,0.3);
          cursor: pointer;
          font-size: 20px;
          transition: background-color 0.2s;
        }
        .floating-gps-btn:active { background-color: #f0f0f0; }
      `}</style>

      {/* ================= BUSCA E BOTÃO X ================= */}
      <div className="search-container">
        <div style={{ position: 'relative', width: '100%' }}>
          <input
            type="text"
            placeholder="Buscar campo..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setIsDropdownOpen(true);
            }}
            onFocus={() => setIsDropdownOpen(true)}
          />
          
          {(searchTerm || selectedField) && (
            <button className="clear-search-btn" onClick={limparFiltro} style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#888', cursor: 'pointer', fontSize: '16px', zIndex: 10 }}>
              ✕
            </button>
          )}
        </div>

        {isDropdownOpen && searchTerm && fazendasFiltradas.length > 0 && !selectedField && (
          <ul className="search-dropdown">
            {fazendasFiltradas.map((faz) => (
              <li key={faz} onClick={() => selecionarCampo(faz)}>
                {faz}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* ================= MAPA ================= */}
      <div className="map-wrapper">
        <MapContainer center={camera.center} zoom={camera.zoom} style={{ height: '100%', width: '100%' }}>
          
          <TileLayer url="https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}" maxZoom={20} />
          
          <MotorDeCamera bounds={camera.bounds} center={camera.center} zoom={camera.zoom} />
          <RastreadorGps setPosicaoUsuario={setPosicaoUsuario} setCamera={setCamera} />

          {posicaoUsuario && (
            <Marker position={posicaoUsuario} icon={iconeGps} />
          )}

          {dadosParaMapa && (
            <GeoJSON
              key={`geo-${selectedField}-${showLots}-${showStreets}-${localAtual?.talhao || 'none'}`}
              data={dadosParaMapa}
              style={obterEstiloArea}
              onEachFeature={aoCriarCadaArea}
            />
          )}

          {showFieldNames && centrosParaExibir.map((fazenda) => (
            <Marker 
              key={`nome-${fazenda.nome}`} 
              position={fazenda.centro} 
              icon={criarIconeTexto(fazenda.nome)} /* Transformamos o nome num ícone físico! */
              eventHandlers={{
                click: () => selecionarCampo(fazenda.nome) // Agora funciona liso.
              }}
            />
          ))}

        </MapContainer>
      </div>

      {/* ================= BOTÃO FLUTUANTE DE GPS ================= */}
      <button 
        className="floating-gps-btn" 
        onClick={focarNoUsuario} 
        title="Minha Localização"
      >
        🎯
      </button>

      {/* ================= INDICADOR DE LOCALIZAÇÃO ================= */}
      {localAtual && (
        <div style={{
          position: 'absolute',
          bottom: '85px', 
          left: '50%',
          transform: 'translateX(-50%)',
          backgroundColor: 'rgba(20, 20, 20, 0.85)',
          color: '#fff',
          padding: '6px 16px',
          borderRadius: '20px',
          fontSize: '12px',
          fontWeight: 'bold',
          border: `1px solid ${COR_LOTE_ATIVO_BORDA}`,
          boxShadow: `0 0 8px ${COR_LOTE_ATIVO_BORDA}40`,
          zIndex: 1000,
          pointerEvents: 'none', 
          whiteSpace: 'nowrap'
        }}>
          Estou em {localAtual.campo}, lote {localAtual.talhao}
        </div>
      )}

      {/* ================= BOTTOM SHEET ================= */}
      <div className="bottom-sheet">
        
        <div className="bottom-sheet-toggle" onClick={() => setBottomMenuOpen(!bottomMenuOpen)}>
          <div className="bottom-sheet-bar" />
        </div>

        <div className={`bottom-sheet-content ${bottomMenuOpen ? 'visible' : ''}`}>
          
          <div className="sheet-options">
            <label className="checkbox-label">
              <input 
                type="checkbox" 
                checked={showFieldNames} 
                onChange={(e) => setShowFieldNames(e.target.checked)} 
              />
              Exibir Nome do Campo
            </label>
            <label className="checkbox-label">
              <input 
                type="checkbox" 
                checked={showLots} 
                onChange={(e) => setShowLots(e.target.checked)} 
              />
              Exibir Número dos Lotes
            </label>
            <label className="checkbox-label">
              <input 
                type="checkbox" 
                checked={showStreets} 
                onChange={(e) => setShowStreets(e.target.checked)} 
              />
              Exibir Área de Ruas
            </label>
          </div>

          <div className="controls-grid">
            {/* Mantive o do menu pra caso você prefira, mas o flutuante é muito mais ágil */}
            <button className="action-btn" onClick={focarNoUsuario}>Centralizar</button>
            <button className="action-btn" disabled={!selectedField} onClick={focarCampo}>Campo</button>
            <button className="action-btn" disabled={!selectedField || !posicaoUsuario} onClick={focarRotas}>Rotas</button>
          </div>

        </div>
      </div>

    </div>
  );
}