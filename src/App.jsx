import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { getTechnician } from './db/dexie';
import { setupAutoSync, startPeriodicSync } from './services/sync';

// Pages
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import BuildingsPage from './pages/BuildingsPage';
import CTOsPage from './pages/CTOsPage';
import BuildingDetailPage from './pages/BuildingDetailPage';

import './App.css';

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
      }
    };

    loadTechnician();
  }, []);

  const handleLogin = (tech) => {
    setTechnician(tech);
    setupAutoSync();
    startPeriodicSync();
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
      <Routes>
        <Route 
          path="/login" 
          element={!technician ? <LoginPage onLogin={handleLogin} /> : <Navigate to="/" />} 
        />
        <Route 
          path="/" 
          element={technician ? <DashboardPage technician={technician} onLogout={handleLogout} /> : <Navigate to="/login" />} 
        />
        <Route 
          path="/buildings" 
          element={technician ? <BuildingsPage technician={technician} /> : <Navigate to="/login" />} 
        />
        <Route 
          path="/buildings/:id" 
          element={technician ? <BuildingDetailPage technician={technician} /> : <Navigate to="/login" />} 
        />
        <Route 
          path="/ctos" 
          element={technician ? <CTOsPage technician={technician} /> : <Navigate to="/login" />} 
        />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
