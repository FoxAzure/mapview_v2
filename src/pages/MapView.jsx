// ================================= DOCUMENTATION ------------------------------------------
// Script: MapView.jsx
// Purpose: Código limpo, leve e 100% alinhado ao CSS customizado, com rastreio de talhão ativo.
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

// Cores para quando você entrar fisicamente em um lote!
const COR_LOTE_ATIVO_BORDA = '#FF8C00'; // Laranja Vivo
const COR_LOTE_ATIVO_FUNDO = '#FFDAB9'; // Laranja Pastel

// ================================= ICONES -------------------------------------------------

const iconeInvisivel = new L.DivIcon({
  className: 'invisible-marker',
  html: '',
  iconSize: [0, 0]
});

const iconeGps = new L.Icon({
  iconUrl: pinCustomizado,
  iconSize: [34, 34],
  iconAnchor: [17, 34]
});

// ================================= HELPERS ------------------------------------------------

// Lógica ninja para identificar se o GPS do Paulo está dentro de um polígono
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

  // Exigências aplicadas nos checkboxes (como o chefe pediu)
  const [showFieldNames, setShowFieldNames] = useState(true);
  const [showLots, setShowLots] = useState(false);
  const [showStreets, setShowStreets] = useState(false);

  // Menu começa aberto
  const [bottomMenuOpen, setBottomMenuOpen] = useState(true);
  
  const [posicaoUsuario, setPosicaoUsuario] = useState(null);
  const [camera, setCamera] = useState({ bounds: null, center: [-9.39, -40.50], zoom: 12 });
  
  // Novo State para saber exatamente onde você está pisando
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
    // Leaflet usa [Lat, Lng], GeoJSON usa [Lng, Lat]. Invertendo para a matemática bater.
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
    setShowLots(false); // Apaga os lotes para limpar a tela
  };

  const selecionarCampo = (nomeFazenda) => {
    setSearchTerm(nomeFazenda);
    setSelectedField(nomeFazenda);
    setShowLots(true); // Acende os lotes (só deste campo) magicamente
    setIsDropdownOpen(false);

    if (!dadosGeoJson) return;
    const features = dadosGeoJson.features.filter((f) => f.properties?.NOME_FAZ === nomeFazenda);
    if (features.length > 0) {
      const layer = L.geoJSON(features);
      setCamera({ bounds: layer.getBounds(), center: null, zoom: null });
    }
  };

  const focarNoUsuario = () => {
    if (!posicaoUsuario) return;
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

    // Prioridade Máxima: Onde o usuário está pisando agora
    if (isUserHere) {
      return { color: COR_LOTE_ATIVO_BORDA, weight: 3, opacity: 1, fillColor: COR_LOTE_ATIVO_FUNDO, fillOpacity: 0.6 };
    }

    // Se houver um campo selecionado na busca
    if (selectedField) {
      if (isSelectedField) {
        // Campo focado
        return { color: '#00ff88', weight: 2.5, opacity: 1, fillColor: '#00c97a', fillOpacity: 0.35 };
      } else {
        // Restante da fazenda escurecida
        return { color: '#333333', weight: 0.5, opacity: 0.3, fillColor: '#1a1a1a', fillOpacity: 0.1 };
      }
    }

    // Visão Geral Padrão
    if (isRua) {
      return { color: '#666666', weight: 1, opacity: 0.7, fillColor: '#505050', fillOpacity: 0.18 };
    }
    
    return {
      color: '#00b37e',
      weight: showLots ? 1 : 0.4,
      opacity: 0.35,
      fillColor: '#00b37e',
      fillOpacity: 0.06
    };
  };

  // ================================= PLACAS DE LOTES ---------------------------------------

  const aoCriarCadaArea = (feature, layer) => {
    const props = feature.properties || {};
    const isRua = props.TALHAO == 666;

    // Só exibe a placa se showLots for true E (não tiver filtro ativo OU for o campo filtrado)
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
      
      {/* Estilo CSS injetado direto no componente para garantir a fonte perfeita e sem quebrar nada externo */}
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
        }
        .map-label-custom::before { display: none; /* remove a setinha do leaflet */ }
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
            <button className="clear-search-btn" onClick={limparFiltro} style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#888', cursor: 'pointer', fontSize: '16px' }}>
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
              // Atualizamos a chave caso você ande de um talhão para outro, forçando a re-renderização da cor Ativa
              key={`geo-${selectedField}-${showLots}-${showStreets}-${localAtual?.talhao || 'none'}`}
              data={dadosParaMapa}
              style={obterEstiloArea}
              onEachFeature={aoCriarCadaArea}
            />
          )}

          {showFieldNames && centrosParaExibir.map((fazenda) => (
            <Marker key={`nome-${fazenda.nome}`} position={fazenda.centro} icon={iconeInvisivel}>
              <Tooltip permanent direction="center" className="map-label-custom">
                {fazenda.nome}
              </Tooltip>
            </Marker>
          ))}

        </MapContainer>
      </div>

      {/* ================= INDICADOR DE LOCALIZAÇÃO ================= */}
      {localAtual && (
        <div style={{
          position: 'absolute',
          bottom: '85px', // Acima do bottom-sheet
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
          pointerEvents: 'none', // Para não bloquear clicks no mapa
          whiteSpace: 'nowrap'
        }}>
          Estou em {localAtual.campo}, Talhão {localAtual.talhao}
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
            <button className="action-btn" onClick={focarNoUsuario}>Centralizar</button>
            <button className="action-btn" disabled={!selectedField} onClick={focarCampo}>Campo</button>
            <button className="action-btn" disabled={!selectedField || !posicaoUsuario} onClick={focarRotas}>Rotas</button>
          </div>

        </div>
      </div>

    </div>
  );
}