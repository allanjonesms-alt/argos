
import React, { useState, useEffect, useCallback, Component, ErrorInfo, ReactNode } from 'react';
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { AuthState, User, UserRole } from './types';
import { STORAGE_KEYS } from './constants';
import Header from './components/Header';
import ScrollToTop from './components/ScrollToTop';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import NewApproach from './pages/NewApproach';
import ApproachesList from './pages/ApproachesList';
import IndividualsList from './pages/IndividualsList';
import Gallery from './pages/Gallery';
import Settings from './pages/Settings';
import ImportReports from './pages/ImportReports';
import ROList from './pages/ROList';
import SSList from './pages/SSList';
import Operators from './pages/Operators';
import Logs from './pages/Logs';
import FirstAccess from './pages/FirstAccess';
import MapPage from './pages/Map';
import UserManual from './pages/UserManual';
import Occurrences from './pages/Occurrences';
import DateOccurrences from './pages/DateOccurrences';
import Statistics from './pages/Statistics';
import SystemVersions from './pages/SystemVersions';
import CrimeGroupsList from './pages/CrimeGroupsList';
import CrimeOrganogram from './pages/CrimeOrganogram';
import ParteDiaria from './pages/ParteDiaria';
import Abordagem from './pages/Abordagem';
import ManageVehicles from './pages/ManageVehicles';
import RoAssistant from './pages/RoAssistant';
import RoTemplates from './pages/RoTemplates';
import StartShift from './pages/StartShift';
import { EfetivoPage } from './pages/EfetivoPage';
import { GestaoPessoalPage } from './pages/GestaoPessoalPage';
import { PromocoesPage } from './pages/PromocoesPage';
import { RequerimentosPage } from './pages/RequerimentosPage';
import { EscalaRemuneradaPage } from './pages/EscalaRemuneradaPage';
import { FormaturaPage } from './pages/FormaturaPage';
import RequestForm from './pages/RequestForm';
import P3Monitoramento from './pages/P3Monitoramento';
import { auth as firebaseAuth, logAction, db } from './firebase';
import { onAuthStateChanged, signInAnonymously } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("ErrorBoundary caught an error", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      let errorMessage = "Ocorreu um erro inesperado.";
      try {
        const parsedError = JSON.parse(this.state.error?.message || "{}");
        if (parsedError.error) {
          errorMessage = `Erro no Firestore: ${parsedError.error} (${parsedError.operationType} em ${parsedError.path})`;
        }
      } catch (e) {
        errorMessage = this.state.error?.message || errorMessage;
      }

      return (
        <div className="min-h-screen bg-white flex items-center justify-center p-4">
          <div className="bg-white border border-red-100 p-8 rounded-3xl max-w-md w-full text-center shadow-2xl">
            <i className="fas fa-exclamation-triangle text-red-500 text-5xl mb-6"></i>
            <h2 className="text-2xl font-black text-navy-950 uppercase tracking-tighter mb-4">Erro Crítico</h2>
            <p className="text-navy-400 text-sm mb-8 leading-relaxed">
              {errorMessage}
            </p>
            <button 
              onClick={() => window.location.reload()}
              className="w-full bg-red-600 hover:bg-red-500 text-white font-black py-4 rounded-2xl uppercase text-xs transition-all shadow-lg shadow-red-600/20"
            >
              Recarregar Aplicativo
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

const App: React.FC = () => {
  const [auth, setAuth] = useState<AuthState>({
    user: null,
    isAuthenticated: false,
  });
  const [isFirebaseReady, setIsFirebaseReady] = useState(false);
  const [isSessionSynced, setIsSessionSynced] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    console.log('App component auth:', auth);
    const unsubscribe = onAuthStateChanged(firebaseAuth, (user) => {
      if (user) {
        setIsFirebaseReady(true);
      } else {
        signInAnonymously(firebaseAuth).catch((err) => {
          console.error("Erro ao autenticar anonimamente:", err);
          setIsFirebaseReady(true);
        });
      }
    });

    const timer = setTimeout(() => {
      setIsFirebaseReady(true);
    }, 1000);

    const savedAuth = localStorage.getItem(STORAGE_KEYS.AUTH);
    if (savedAuth) {
      try {
        const parsed = JSON.parse(savedAuth);
        setAuth(parsed);
      } catch (e) {
        localStorage.removeItem(STORAGE_KEYS.AUTH);
      }
    }

    return () => {
      unsubscribe();
      clearTimeout(timer);
    };
  }, []);

  useEffect(() => {
    let active = true;

    const syncUserSession = async () => {
      if (!auth.isAuthenticated || !auth.user) {
        if (active) {
          setIsSessionSynced(false);
        }
        return;
      }

      try {
        if (firebaseAuth.currentUser) {
          const isTemporarySession = firebaseAuth.currentUser.uid !== auth.user.id;
          const sessionUserRef = doc(db, 'users', firebaseAuth.currentUser.uid);
          const payload: any = {
            matricula: auth.user.matricula,
            nome: auth.user.nome,
            senha: auth.user.senha,
            role: auth.user.role,
            unidade: auth.user.unidade || '',
            primeiro_acesso: auth.user.primeiro_acesso ?? true,
            created_at: new Date().toISOString()
          };

          if (isTemporarySession) {
            payload.ord = 99;
            payload.is_session = true;
          }

          await setDoc(sessionUserRef, payload, { merge: true });
          console.log("Sessão do usuário sincronizada no Firestore sob o UID:", firebaseAuth.currentUser.uid);
        }
      } catch (err) {
        console.error("Erro ao sincronizar sessão do usuário no Firestore:", err);
      } finally {
        if (active) {
          setIsSessionSynced(true);
        }
      }
    };

    const unsubscribe = onAuthStateChanged(firebaseAuth, (user) => {
      if (user) {
        syncUserSession();
      } else {
        if (active) {
          setIsSessionSynced(true);
        }
      }
    });

    syncUserSession();

    const fallbackTimer = setTimeout(() => {
      if (active) {
        setIsSessionSynced(true);
      }
    }, 1000);

    return () => {
      active = false;
      unsubscribe();
      clearTimeout(fallbackTimer);
    };
  }, [auth.user, auth.isAuthenticated]);

  const handleLogin = async (user: User) => {
    const newAuth = { user, isAuthenticated: true };
    setAuth(newAuth);
    localStorage.setItem(STORAGE_KEYS.AUTH, JSON.stringify(newAuth));
    
    await logAction(
      user.id,
      user.nome,
      'USER_LOGIN',
      `O usuário ${user.nome} realizou login no sistema.`,
      {}
    );

    navigate('/', { replace: true });
  };

  const handleLogout = useCallback(async (isAuto: boolean | React.MouseEvent | React.PointerEvent = false) => {
    const autoLogout = isAuto === true;
    console.log(`Iniciando logout ${autoLogout ? 'automático' : 'manual'}...`);
    const user = auth.user;
    if (user) {
      try {
        await logAction(
          user.id,
          user.nome,
          autoLogout ? 'AUTO_LOGOUT' : 'USER_LOGOUT',
          `O usuário ${user.nome} ${autoLogout ? 'foi desconectado automaticamente por inatividade' : 'saiu do sistema'}.`,
          {}
        );
        console.log('Log de logout gravado.');
      } catch (err) {
        console.error('Erro ao gravar log de logout:', err);
      }
    }
    setAuth({ user: null, isAuthenticated: false });
    setIsSessionSynced(false);
    localStorage.removeItem(STORAGE_KEYS.AUTH);
    console.log('Estado de auth resetado e localStorage limpo.');
    navigate('/', { replace: true });
    console.log('Navegação para home concluída.');
  }, [auth.user, navigate]);

  // Inactivity Logout Logic
  useEffect(() => {
    if (!auth.isAuthenticated) return;

    const INACTIVITY_TIMEOUT = 30 * 60 * 1000; // 30 minutes
    let timeoutId: NodeJS.Timeout;

    const resetTimer = () => {
      if (timeoutId) clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        handleLogout(true);
      }, INACTIVITY_TIMEOUT);
    };

    const activityEvents = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart'];
    
    activityEvents.forEach(event => {
      window.addEventListener(event, resetTimer);
    });

    resetTimer();

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
      activityEvents.forEach(event => {
        window.removeEventListener(event, resetTimer);
      });
    };
  }, [auth.isAuthenticated, handleLogout]);

  const handlePasswordChanged = (updatedUser: User) => {
    const newAuth = { user: updatedUser, isAuthenticated: true };
    setAuth(newAuth);
    localStorage.setItem(STORAGE_KEYS.AUTH, JSON.stringify(newAuth));
    navigate('/', { replace: true });
  };

  if (!isFirebaseReady) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="flex flex-col items-center">
          <div className="w-16 h-16 border-4 border-navy-600 border-t-transparent rounded-full animate-spin mb-4"></div>
          <p className="text-navy-950 font-black uppercase tracking-widest text-[10px]">Iniciando Sistemas...</p>
        </div>
      </div>
    );
  }

  console.log("App auth state:", auth);
  if (!auth.isAuthenticated) {
    return <Login onLogin={handleLogin} />;
  }

  if (!isSessionSynced) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="flex flex-col items-center">
          <div className="w-16 h-16 border-4 border-navy-600 border-t-transparent rounded-full animate-spin mb-4"></div>
          <p className="text-navy-950 font-black uppercase tracking-widest text-[10px]">Sincronizando Sessão de Segurança...</p>
        </div>
      </div>
    );
  }

  if (auth.user?.primeiro_acesso === false || auth.user?.senha === '@Senha123' || auth.user?.senha === 'admin123') {
    return <FirstAccess user={auth.user} onPasswordChanged={handlePasswordChanged} onLogout={handleLogout} />;
  }

  return (
    <ErrorBoundary>
      <ScrollToTop />
      <div className="flex flex-col min-h-screen bg-white">
        <Header user={auth.user} onLogout={handleLogout} />
        <main className="flex-1 container mx-auto p-4 md:p-6 pb-24">
          <Routes>
            <Route path="/" element={<Dashboard user={auth.user} />} />
            <Route path="/nova-abordagem" element={<NewApproach user={auth.user} />} />
            <Route path="/editar-abordagem/:id" element={<NewApproach user={auth.user} />} />
            <Route path="/abordagens" element={<ApproachesList user={auth.user} />} />
            <Route path="/individuos" element={<IndividualsList user={auth.user} />} />
            <Route path="/galeria" element={<Gallery user={auth.user} />} />
            <Route path="/mapas" element={<MapPage user={auth.user} />} />
            <Route path="/configuracoes" element={<Settings user={auth.user} />} />
            <Route path="/importar-relatorios" element={<ImportReports user={auth.user} />} />
            <Route path="/lista-ro" element={<ROList user={auth.user} />} />
            <Route path="/lista-ss" element={<SSList user={auth.user} />} />
            <Route path="/estatisticas" element={<Statistics user={auth.user} />} />
            <Route path="/operadores" element={<Operators user={auth.user} />} />
            <Route path="/gestao-pessoal" element={<GestaoPessoalPage user={auth.user} />} />
            <Route path="/promocoes" element={<PromocoesPage user={auth.user} />} />
            <Route path="/formatura" element={<FormaturaPage user={auth.user} />} />
            <Route path="/requerimentos" element={<RequerimentosPage user={auth.user} />} />
            <Route path="/requerimentos/:typeId" element={<RequestForm user={auth.user} />} />
            <Route path="/escala-remunerada" element={<EscalaRemuneradaPage user={auth.user} />} />
            <Route path="/efetivo" element={<EfetivoPage user={auth.user} />} />
            <Route path="/logs" element={<Logs user={auth.user} />} />
            <Route path="/versoes" element={<SystemVersions user={auth.user} />} />
            <Route path="/parte-diaria" element={<ParteDiaria user={auth.user} />} />
            <Route path="/p3-monitoramento" element={<P3Monitoramento user={auth.user} />} />
            <Route path="/abordagem" element={<Abordagem user={auth.user} />} />
            <Route path="/assistente-ro" element={<RoAssistant user={auth.user} />} />
            <Route path="/modelos-ro" element={auth.user?.role === UserRole.MASTER ? <RoTemplates user={auth.user} /> : <Navigate to="/" replace />} />
            <Route path="/iniciar-servico" element={<StartShift user={auth.user} />} />
            <Route path="/manual" element={<UserManual />} />
            <Route path="/gerenciar-viaturas" element={<ManageVehicles user={auth.user} />} />
            <Route path="/organogramas" element={auth.user?.role === UserRole.MASTER ? <CrimeGroupsList user={auth.user} /> : <Navigate to="/" replace />} />
            <Route path="/organograma/:groupId" element={auth.user?.role === UserRole.MASTER ? <CrimeOrganogram user={auth.user} /> : <Navigate to="/" replace />} />
            <Route path="/ocorrencias" element={(auth.user?.role === UserRole.ADMIN || auth.user?.role === UserRole.MASTER || auth.user?.role === UserRole.SUPERVISOR_DE_OPERACOES) ? <Occurrences user={auth.user} /> : <Navigate to="/" replace />} />
            <Route path="/ocorrencias/data/:date" element={(auth.user?.role === UserRole.ADMIN || auth.user?.role === UserRole.MASTER || auth.user?.role === UserRole.SUPERVISOR_DE_OPERACOES) ? <DateOccurrences user={auth.user} /> : <Navigate to="/" replace />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>
    </ErrorBoundary>
  );
};

export default App;
