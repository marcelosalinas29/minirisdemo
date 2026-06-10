import { ReactNode, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Calendar, Users, PlusCircle, LogOut, Search, X, MessageSquare } from 'lucide-react';
import clinicLogo from '@/assets/clinic-logo.png';
import { useAuth } from '@/contexts/AuthContext';
import { useClinicStore } from '@/store/useClinicStore';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import CommunicationCenter, { useChatUnread } from '@/components/CommunicationCenter';
import { Badge } from '@/components/ui/badge';

interface AppLayoutProps {
  children: ReactNode;
  title: string;
  showBack?: boolean;
}

const allNavItems = [
  { path: '/', icon: Calendar, label: 'Citas' },
  { path: '/patients', icon: Users, label: 'Pacientes' },
  { path: '/new', icon: PlusCircle, label: 'Nueva' },
];

const AppLayout = ({ children, title }: AppLayoutProps) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { profile, role, signOut, isViewer } = useAuth();
  const navItems = isViewer ? allNavItems.filter(n => n.path !== '/new') : allNavItems;
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [commOpen, setCommOpen] = useState(false);
  const { searchPatients, getPatientAppointments } = useClinicStore();
  const showComm = !isViewer;
  const { unreadCount, setOpen: setChatOpen } = useChatUnread();

  const searchResults = searchQuery.length >= 2 ? searchPatients(searchQuery) : [];

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  const initials = (profile?.full_name || 'U').split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase();

  return (
    <div className="flex flex-col min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-primary px-4 py-3 shadow-lg">
        <div className="flex items-center gap-3 max-w-2xl mx-auto">
          <img src={clinicLogo} alt="DMR" className="w-9 h-9 rounded-lg object-cover bg-white/10 p-0.5" />
          <div className="flex-1 min-w-0">
            <h1 className="text-sm font-bold text-primary-foreground/90 tracking-wide uppercase flex items-center gap-1.5">
              Ecografía y Doppler
              <span className="text-[9px] font-bold bg-amber-400 text-amber-950 px-1.5 py-0.5 rounded">DEMO</span>
            </h1>
            <p className="text-xs text-primary-foreground/60 truncate">{title}</p>
          </div>
          <div className="flex items-center gap-2">
            {showComm && (
              <button
                onClick={() => {
                  const next = !commOpen;
                  setCommOpen(next);
                  setChatOpen(next);
                  if (next) setSearchOpen(false);
                }}
                className="relative p-1.5 text-primary-foreground/70 hover:text-primary-foreground transition-colors"
                title="Centro de Comunicación"
              >
                <MessageSquare className="w-4 h-4" />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground text-[9px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </button>
            )}
            <button
              onClick={() => setSearchOpen(!searchOpen)}
              className="p-1.5 text-primary-foreground/70 hover:text-primary-foreground transition-colors"
              title="Buscar paciente"
            >
              <Search className="w-4 h-4" />
            </button>
            {profile && (
              <button
                onClick={() => navigate('/profile')}
                className="flex items-center gap-1.5 text-xs text-primary-foreground/80 hover:text-primary-foreground transition-colors"
              >
                <Avatar className="w-6 h-6">
                  {profile.avatar_url ? (
                    <AvatarImage src={profile.avatar_url} alt={profile.full_name} />
                  ) : null}
                  <AvatarFallback className="text-[10px] font-bold bg-primary-foreground/20 text-primary-foreground">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <span className="hidden sm:inline">
                  {role === 'secretary' ? 'Secretaria' : profile.full_name.split(' ')[0]}
                </span>
              </button>
            )}
            <button
              onClick={handleSignOut}
              className="p-1.5 text-primary-foreground/70 hover:text-primary-foreground transition-colors"
              title="Cerrar sesión"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Global Search Bar */}
        {searchOpen && (
          <div className="mt-2 max-w-2xl mx-auto animate-slide-up">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar paciente por nombre o teléfono..."
                className="w-full pl-9 pr-9 py-2 rounded-lg bg-card text-foreground text-sm border-0 focus:outline-none focus:ring-2 focus:ring-accent"
                autoFocus
              />
              <button
                onClick={() => { setSearchOpen(false); setSearchQuery(''); }}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            {searchResults.length > 0 && (
              <div className="mt-1 bg-card rounded-lg shadow-md border border-border overflow-hidden max-h-60 overflow-y-auto">
                {searchResults.slice(0, 8).map((p) => {
                  const apts = getPatientAppointments(p.id);
                  return (
                    <button
                      key={p.id}
                      onClick={() => {
                        if (apts.length > 0) {
                          navigate(`/appointment/${apts[0].id}`);
                        } else {
                          navigate('/patients');
                        }
                        setSearchOpen(false);
                        setSearchQuery('');
                      }}
                      className="w-full px-3 py-2.5 text-left text-sm hover:bg-muted transition-colors border-b border-border last:border-0"
                    >
                      <span className="font-medium text-foreground">{p.name}</span>
                      <span className="text-muted-foreground ml-2">— {p.phone}</span>
                      {apts.length > 0 && (
                        <span className="text-xs text-muted-foreground ml-2">({apts.length} estudio{apts.length > 1 ? 's' : ''})</span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
            {searchQuery.length >= 2 && searchResults.length === 0 && (
              <div className="mt-1 bg-card rounded-lg shadow-md border border-border p-3 text-sm text-muted-foreground text-center">
                No se encontraron pacientes
              </div>
            )}
          </div>
        )}

        {/* Communication Center Panel */}
        {commOpen && showComm && (
          <CommunicationCenter
            onClose={() => { setCommOpen(false); setChatOpen(false); }}
            onOpen={() => setChatOpen(true)}
          />
        )}
      </header>

      {/* Content */}
      <main className="flex-1 overflow-y-auto pb-20">
        {children}
      </main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 bg-card/95 backdrop-blur-md border-t border-border shadow-[0_-2px_10px_rgba(0,0,0,0.06)]">
        <div className="flex justify-around items-center h-16 max-w-lg mx-auto">
          {navItems.map(({ path, icon: Icon, label }) => {
            const isActive = location.pathname === path;
            return (
              <Link
                key={path}
                to={path}
                className={`flex flex-col items-center gap-1 px-5 py-2 rounded-xl transition-all ${
                  isActive
                    ? 'text-primary bg-primary/8'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <Icon className={`w-5 h-5 ${isActive ? 'stroke-[2.5]' : ''}`} />
                <span className={`text-[11px] ${isActive ? 'font-bold' : 'font-medium'}`}>{label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
};

export default AppLayout;
