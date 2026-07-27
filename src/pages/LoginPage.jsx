import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { setTechnician } from '../db/dexie';
import { getSession, isAuthConfigured, signIn } from '../services/supabase';
import './LoginPage.css';

function LoginPage({ onLogin }) {
  const [step, setStep] = useState(isAuthConfigured() ? 'password' : 'profile');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [registration, setRegistration] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isCheckingSession, setIsCheckingSession] = useState(isAuthConfigured());
  const [error, setError] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    if (!isAuthConfigured()) return;
    (async () => {
      const session = await getSession();
      if (session) setStep('profile');
      setIsCheckingSession(false);
    })();
  }, []);

  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    if (!password.trim()) {
      setError('Digite a senha de acesso');
      return;
    }
    setIsLoading(true);
    setError('');
    try {
      await signIn(password);
      setPassword('');
      setStep('profile');
    } catch (err) {
      setError('Senha incorreta. Tente novamente.');
      console.error('Auth error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleProfileSubmit = async (e) => {
    e.preventDefault();

    if (!name.trim() || !registration.trim()) {
      setError('Nome e matrícula são obrigatórios');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const tech = await setTechnician(name.trim(), registration.trim());
      onLogin({ id: tech, name: name.trim(), registration: registration.trim() });
      navigate('/');
    } catch (err) {
      setError('Erro ao salvar informações. Tente novamente.');
      console.error('Login error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-container">
        <div className="login-header">
          <div className="logo-icon">📡</div>
          <h1 className="app-title">Otimizza Pred</h1>
          <p className="app-subtitle">Gerenciamento de Prédios e Caixas</p>
        </div>

        {isCheckingSession ? (
          <p className="login-checking">Verificando acesso...</p>
        ) : step === 'password' ? (
          <form onSubmit={handlePasswordSubmit} className="login-form">
            <div className="form-group">
              <label className="form-label">Senha de acesso</label>
              <input
                type="password"
                className="form-input"
                placeholder="Digite a senha da equipe"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isLoading}
                autoFocus
              />
            </div>

            {error && (
              <div className="error-message">
                ⚠️ {error}
              </div>
            )}

            <button
              type="submit"
              className="btn btn-primary btn-block"
              disabled={isLoading}
            >
              {isLoading ? 'Verificando...' : 'Entrar'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleProfileSubmit} className="login-form">
            <div className="form-group">
              <label className="form-label">Nome do Técnico</label>
              <input
                type="text"
                className="form-input"
                placeholder="Digite seu nome completo"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={isLoading}
                autoFocus
              />
            </div>

            <div className="form-group">
              <label className="form-label">Matrícula</label>
              <input
                type="text"
                className="form-input"
                placeholder="Digite sua matrícula"
                value={registration}
                onChange={(e) => setRegistration(e.target.value)}
                disabled={isLoading}
              />
            </div>

            {error && (
              <div className="error-message">
                ⚠️ {error}
              </div>
            )}

            <button
              type="submit"
              className="btn btn-primary btn-block"
              disabled={isLoading}
            >
              {isLoading ? 'Carregando...' : 'Entrar'}
            </button>
          </form>
        )}

        <div className="login-info">
          <p>✓ Funciona offline</p>
          <p>✓ Sincroniza automaticamente</p>
          <p>✓ Otimizado para celular</p>
        </div>
      </div>
    </div>
  );
}

export default LoginPage;
