import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { getTechnician, clearTechnician } from './db/dexie';
import { setupRealtimeSync } from './services/sync';
import { isAuthConfigured, getSession, signOut, onAuthStateChange } from './services/supabase';

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
        <span className="nav-icon">🏠</span>
        <span>Início</span>
      </button>
      <button
        className={`nav-item ${isBuildingsActive ? 'active' : ''}`}
        onClick={() => navigate('/buildings')}
      >
        <span className="nav-icon">🏢</span>
        <span>Prédios</span>
      </button>
      <button
        className="nav-item nav-item-new"
        onClick={handleNew}
      >
        <span className="nav-icon nav-icon-new">➕</span>
        <span>Novo</span>
      </button>
      <button
        className={`nav-item ${isCTOsActive ? 'active' : ''}`}
        onClick={() => navigate('/ctos')}
      >
        <span className="nav-icon">📦</span>
        <span>CTOs</span>
      </button>
      <button
        className="nav-item"
        onClick={handleSearch}
      >
        <span className="nav-icon">🔍</span>
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
      if (isAuthConfigured()) {
        const session = await getSession();
        if (!session) {
          setTechnician(null);
          setIsLoading(false);
          return;
        }
      }

      const tech = await getTechnician();
      setTechnician(tech);
      setIsLoading(false);

      if (tech) {
        setupRealtimeSync();
      }
    };

    loadTechnician();

    const unsubscribe = onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') {
        setTechnician(null);
        clearTechnician();
      }
    });

    return () => unsubscribe();
  }, []);

  const handleLogin = (tech) => {
    setTechnician(tech);
    setupRealtimeSync();
  };

  const handleLogout = async () => {
    if (isAuthConfigured()) {
      await signOut();
    }
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
