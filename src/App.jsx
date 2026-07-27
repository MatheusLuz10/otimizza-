import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { Home, Building2, Plus, Package, Search } from 'lucide-react';
import { getTechnician, clearTechnician } from './db/dexie';
import { setupRealtimeSync } from './services/sync';

// Pages
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import BuildingsPage from './pages/BuildingsPage';
import CTOsPage from './pages/CTOsPage';
import BuildingDetailPage from './pages/BuildingDetailPage';
import ChangesPage from './pages/ChangesPage';
import ReportPage from './pages/ReportPage';

import './App.css';

function BottomNav() {
  const navigate = useNavigate();
  const location = useLocation();

  const isBuildingsActive = location.pathname === '/buildings' || location.pathname.startsWith('/buildings/');
  const isCTOsActive = location.pathname === '/ctos';

  const handleNew = () => {
    const path = location.pathname;
    if (path === '/buildings' || path === '/ctos' || path.startsWith('/buildings/')) {
      window.dispatchEvent(new CustomEvent('bottomnav:new'));
    } else {
      navigate('/buildings', { state: { openForm: true } });
    }
  };

  const handleSearch = () => {
    if (!location.pathname.startsWith('/buildings') && location.pathname !== '/ctos') {
      navigate('/buildings');
    }
    window.dispatchEvent(new CustomEvent('bottomnav:search'));
  };

  return (
    <nav className="bottom-nav">
      <button
        className={`nav-item nav-item-home ${location.pathname === '/' ? 'active' : ''}`}
        onClick={() => navigate('/')}
      >
        <Home className="nav-icon" size={20} strokeWidth={2} />
        <span>Início</span>
      </button>
      <button
        className={`nav-item ${isBuildingsActive ? 'active' : ''}`}
        onClick={() => navigate('/buildings')}
      >
        <Building2 className="nav-icon" size={20} strokeWidth={2} />
        <span>Prédios</span>
      </button>
      <button
        className="nav-item nav-item-new"
        onClick={handleNew}
      >
        <Plus className="nav-icon nav-icon-new" size={22} strokeWidth={2.5} />
        <span>Novo</span>
      </button>
      <button
        className={`nav-item ${isCTOsActive ? 'active' : ''}`}
        onClick={() => navigate('/ctos')}
      >
        <Package className="nav-icon" size={20} strokeWidth={2} />
        <span>CTOs</span>
      </button>
      <button
        className="nav-item"
        onClick={handleSearch}
      >
        <Search className="nav-icon" size={20} strokeWidth={2} />
        <span>Buscar</span>
      </button>
    </nav>
  );
}

function AppRoutes({ technician, onLogin, onLogout }) {
  if (!technician) {
    return (
      <Routes>
        <Route path="/login" element={<LoginPage onLogin={onLogin} />} />
        <Route path="*" element={<Navigate to="/login" />} />
      </Routes>
    );
  }

  return (
    <>
      <Routes>
        <Route path="/" element={<DashboardPage technician={technician} onLogout={onLogout} />} />
        <Route path="/buildings" element={<BuildingsPage technician={technician} />} />
        <Route path="/buildings/:id" element={<BuildingDetailPage technician={technician} />} />
        <Route path="/ctos" element={<CTOsPage technician={technician} />} />
        <Route path="/changes" element={<ChangesPage />} />
        <Route path="/report" element={<ReportPage />} />
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
      <BottomNav />
    </>
  );
}

function App() {
  const [technician, setTechnician] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadTechnician = async () => {
      const tech = await getTechnician();
      setTechnician(tech);
      setIsLoading(false);

      if (tech) {
        setupRealtimeSync();
      }
    };

    loadTechnician();
  }, []);

  const handleLogin = (tech) => {
    setTechnician(tech);
    setupRealtimeSync();
  };

  const handleLogout = async () => {
    await clearTechnician();
    setTechnician(null);
  };

  if (isLoading) {
    return (
      <div className="loading-container">
        <div className="spinner"></div>
        <p>Carregando...</p>
      </div>
    );
  }

  return (
    <BrowserRouter>
      <AppRoutes technician={technician} onLogin={handleLogin} onLogout={handleLogout} />
    </BrowserRouter>
  );
}

export default App;
