// ================================= DOCUMENTATION ------------------------------------------
// Script: App.jsx
// Purpose: Ponto central limpo. Apenas chama o MapView sem Sidebar para não poluir.
// ================================= EXECUTOR -----------------------------------------------
import MapView from './pages/MapView';
import './index.css';

export default function App() {
  return (
    <div style={{ width: '100vw', height: '100vh', overflow: 'hidden' }}>
      <MapView />
    </div>
  );
}