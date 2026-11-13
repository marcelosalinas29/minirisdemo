import { ReactNode, useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Calendar, Users, PlusCircle, LogOut, Search, X, MessageSquare, History, Menu, Settings, FileUp, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import { useAuth } from '@/contexts/AuthContext';
import { useClinicStore } from '@/store/useClinicStore';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import CommunicationCenter, { useChatUnread } from '@/components/CommunicationCenter';
import ThemeToggle from '@/components/ThemeToggle';

interface AppLayoutProps {
  children: ReactNode;
  title: string;
  showBack?: boolean;
}

const allNavItems = [
  { path: '/', icon: Calendar, label: 'Agenda' },
  { path: '/patients', icon: Users, label: 'Pacientes' },
  { path: '/historial', icon: History, label: 'Historial' },
  { path: '/new', icon: PlusCircle, label: 'Nueva' },
];

const AppLayout = ({ children, title }: AppLayoutProps) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { profile, role, signOut, isViewer } = useAuth();
  const navItems = isViewer ? [{ path: '/consultor', icon: Search, label: 'Buscar estudios' }] : allNavItems;
  const [menuOpen, setMenuOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const sideItems = isViewer ? navItems : [...navItems, { path: '/importar', icon: FileUp, label: 'Importar' }, { path: '/schedule', icon: Settings, label: 'Configuración' }];
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [commOpen, setCommOpen] = useState(false);
  const { searchPatients, getPatientAppointments, searchPatientsRemote } = useClinicStore();
  const showComm = !isViewer;
  const { unreadCount, setOpen: setChatOpen } = useChatUnread();

  useEffect(() => {
    if (searchQuery.trim().length < 2) return;
    const t = setTimeout(() => { searchPatientsRemote(searchQuery); }, 350);
    return () => clearTimeout(t);
  }, [searchQuery]);

  const searchResults = searchQuery.length >= 2 ? searchPatients(searchQuery) : [];
  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };
  const initials = (profile?.full_name || 'U').split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase();

  const sidebarContent = (
    <div className="flex h-full min-h-0 flex-col">
      <Link to={isViewer ? '/consultor' : '/'} onClick={() => setMenuOpen(false)} className="flex items-center gap-3 px-6 pt-9 pb-8">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-sidebar-foreground/10 text-sidebar-primary text-2xl font-bold">N</span>
        <div><p className="text-3xl font-bold text-sidebar-foreground">DMR</p><p className="text-xs text-silver">by Nexo Imagen</p></div>
      </Link>
      <span className="mx-6 mb-5 self-start rounded border border-silver/30 px-2 py-1 text-[10px] font-semibold text-silver">DEMO</span>
      <nav aria-label="Navegación lateral" className="flex-1 overflow-y-auto px-3 space-y-1">
        {sideItems.map(({ path, icon: Icon, label }) => (
          <Button key={path} asChild variant="ghost" className={`sidebar-link relative h-11 w-full justify-start gap-3 px-4 ${location.pathname === path ? 'sidebar-link-active' : ''}`}>
            <Link to={path} title={label} onClick={() => setMenuOpen(false)} aria-current={location.pathname === path ? 'page' : undefined}><Icon className="h-5 w-5 shrink-0" /><span className="sidebar-label">{label}</span></Link>
          </Button>
        ))}
      </nav>
      <div className="mt-5 border-t border-sidebar-border px-5 py-5 space-y-3">
        <div className="flex gap-2">
          {!isViewer && <Button variant="ghost" size="icon" className="sidebar-link h-9 w-9" title="Buscar paciente" onClick={() => { setSearchOpen(!searchOpen); setMenuOpen(false); }}><Search className="h-4 w-4" /></Button>}
          {showComm && <Button variant="ghost" size="icon" className="sidebar-link relative h-9 w-9" title="Centro de Comunicación" onClick={() => { const next = !commOpen; setCommOpen(next); setChatOpen(next); if (next) setSearchOpen(false); setMenuOpen(false); }}><MessageSquare className="h-4 w-4" />{unreadCount > 0 && <span className="absolute -right-1 -top-1 rounded-full bg-destructive px-1 text-[10px] text-destructive-foreground">{unreadCount > 9 ? '9+' : unreadCount}</span>}</Button>}
          <ThemeToggle />
          <Button variant="ghost" size="icon" className="sidebar-link h-9 w-9 ml-auto" title="Cerrar sesión" onClick={handleSignOut}><LogOut className="h-4 w-4" /></Button>
        </div>
        {profile && <Button asChild variant="ghost" className="sidebar-link h-auto w-full justify-start gap-3 px-0 py-2">
          <Link to="/profile" onClick={() => setMenuOpen(false)}>
            <Avatar className="h-9 w-9 shrink-0">{profile.avatar_url && <AvatarImage src={profile.avatar_url} alt={profile.full_name} />}<AvatarFallback className="bg-sidebar-foreground/10 text-sidebar-foreground text-xs">{initials}</AvatarFallback></Avatar>
            <span className="min-w-0 text-left whitespace-normal"><span className="block text-xs font-medium break-words">{profile.full_name}</span><span className="block text-[11px] text-silver">{role === 'secretary' ? 'Secretaria' : role === 'viewer' ? 'Médico visualizador' : 'Médico ejecutor'}</span></span>
          </Link>
        </Button>}
      </div>
    </div>
  );

  return (
    <div className={`min-h-screen bg-background ${sidebarCollapsed ? 'lg:pl-20' : 'lg:pl-[264px]'}`}>
      <aside className={`fixed inset-y-0 left-0 z-40 hidden border-r border-sidebar-border bg-sidebar text-sidebar-foreground lg:block ${sidebarCollapsed ? 'sidebar-mini w-20' : 'w-[264px]'}`}>{sidebarContent}</aside>
      <Button variant="outline" size="icon" className={`fixed top-3 z-40 hidden h-7 w-7 lg:flex ${sidebarCollapsed ? 'left-[65px]' : 'left-[249px]'}`} title={sidebarCollapsed ? 'Expandir menú' : 'Contraer menú'} aria-label={sidebarCollapsed ? 'Expandir menú' : 'Contraer menú'} onClick={() => setSidebarCollapsed(!sidebarCollapsed)}>{sidebarCollapsed ? <PanelLeftOpen className="h-3.5 w-3.5" /> : <PanelLeftClose className="h-3.5 w-3.5" />}</Button>
      <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
        <SheetContent side="left" className="w-[264px] max-w-[85vw] bg-sidebar text-sidebar-foreground border-sidebar-border p-0">
          <SheetTitle className="sr-only">Menú DMR</SheetTitle>
          {sidebarContent}
        </SheetContent>
      </Sheet>
      <header className="sticky top-0 z-30 header-institutional lg:hidden">
        <div className="flex h-14 items-center gap-3 px-4">
          <Button variant="ghost" size="icon" className="sidebar-link h-9 w-9" title="Abrir menú" aria-label="Abrir menú" onClick={() => setMenuOpen(true)}><Menu className="h-5 w-5" /></Button>
          <span className="font-bold text-sidebar-foreground">DMR</span><span className="flex-1 truncate text-xs text-silver">{title}</span>
          <ThemeToggle />
        </div>
      </header>
      <div className="relative z-30">
        {/* Global Search Bar */}
        {searchOpen && (
          <div className="fixed top-16 lg:top-5 left-4 right-4 lg:left-[284px] lg:right-6 max-w-2xl mx-auto animate-slide-up">
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
      </div>

      {/* Content */}
      <main className="min-w-0 pb-20 lg:pb-6">
        {children}
      </main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 lg:hidden bg-card/95 backdrop-blur-md border-t border-border shadow-institutional">
        <div className="flex justify-around items-center h-16 max-w-lg mx-auto">
          {navItems.map(({ path, icon: Icon, label }) => {
            const isActive = location.pathname === path;
            return (
              <Link
                key={path}
                to={path}
                className={`flex flex-col items-center gap-1 px-5 py-2 rounded-xl transition-all ${
                  isActive
                    ? 'text-primary bg-primary/10'
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
