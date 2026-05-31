import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { getTechnician } from './db/dexie';
import { setupAutoSync, startPeriodicSync, setupRealtimeSync } from './services/sync';

// Pages
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import BuildingsPage from './pages/BuildingsPage';
import CTOsPage from './pages/CTOsPage';
import BuildingDetailPage from './pages/BuildingDetailPage';
import ChangesPage from './pages/ChangesPage';

import './App.css';

function BottomNav() {
  const navigate = useNavigate();
  const location = useLocation();

  const navItems = [
    { path: '/', icon: '🏠', label: 'Dashboard', exact: true },
    { path: '/buildings', icon: '🏢', label: 'Prédios', exact: false },
    { path: '/ctos', icon: '📦', label: 'CTOs', exact: false },
    { path: '/changes', icon: 'M', label: 'Mudanças', exact: false },
  ];

  const isActive = (item) => {
    if (item.exact) return location.pathname === item.path;
    return location.pathname.startsWith(item.path);
  };

  return (
    <nav className="bottom-nav">
      {navItems.map(item => (
        <button
          key={item.path}
          className={`nav-item ${isActive(item) ? 'active' : ''}`}
          onClick={() => navigate(item.path)}
        >
          <span style={{ fontSize: '20px' }}>{item.icon}</span>
          <span>{item.label}</span>
        </button>
      ))}
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
        setupAutoSync();
        startPeriodicSync();
        setupRealtimeSync();
      }
    };

    loadTechnician();
  }, []);

  const handleLogin = (tech) => {
    setTechnician(tech);
    setupAutoSync();
    startPeriodicSync();
    setupRealtimeSync();
  };

  const handleLogout = () => {
    setTechnician(null);
    localStorage.removeItem('technician');
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
