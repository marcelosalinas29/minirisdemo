import { useState, useEffect, useRef, useCallback } from 'react';
import { MessageSquare, StickyNote, Send, Check, X, Trash2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface Note {
  id: string;
  user_id: string;
  author_name: string;
  content: string;
  completed: boolean;
  created_at: string;
}

interface ChatMessage {
  id: string;
  user_id: string;
  author_name: string;
  content: string;
  created_at: string;
}

type Tab = 'notes' | 'chat';

const notificationAudio = typeof window !== 'undefined' ? new Audio('/notification.wav') : null;
if (notificationAudio) {
  notificationAudio.volume = 0.3;
  notificationAudio.preload = 'auto';
}

export function useChatUnread() {
  const [unreadCount, setUnreadCount] = useState(0);
  const { user, isDoctor, isSecretary } = useAuth();
  const lastSeenRef = useRef<string>(localStorage.getItem('chat_last_seen') || new Date().toISOString());
  const isOpenRef = useRef(false);

  const markSeen = useCallback(() => {
    const now = new Date().toISOString();
    lastSeenRef.current = now;
    localStorage.setItem('chat_last_seen', now);
    setUnreadCount(0);
  }, []);

  const setOpen = useCallback((open: boolean) => {
    isOpenRef.current = open;
    if (open) markSeen();
  }, [markSeen]);

  useEffect(() => {
    if (!user || (!isDoctor && !isSecretary)) return;

    // Initial count
    supabase
      .from('chat_messages')
      .select('id', { count: 'exact', head: true })
      .gt('created_at', lastSeenRef.current)
      .neq('user_id', user.id)
      .then(({ count }) => {
        if (!isOpenRef.current && count && count > 0) setUnreadCount(count);
      });

    const channel = supabase
      .channel('chat-unread')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_messages' }, (payload) => {
        const msg = payload.new as ChatMessage;
        if (msg.user_id !== user.id) {
          if (isOpenRef.current) {
            markSeen();
          } else {
            setUnreadCount(c => c + 1);
            notificationAudio?.play().catch(() => {});
          }
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user, isDoctor, isSecretary, markSeen]);

  return { unreadCount, markSeen, setOpen };
}

interface CommunicationCenterProps {
  onClose: () => void;
  onOpen: () => void;
}

export default function CommunicationCenter({ onClose, onOpen }: CommunicationCenterProps) {
  const [tab, setTab] = useState<Tab>('chat');
  const { user, profile } = useAuth();

  // Notes state
  const [notes, setNotes] = useState<Note[]>([]);
  const [newNote, setNewNote] = useState('');
  const [loadingNotes, setLoadingNotes] = useState(true);

  // Chat state
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loadingChat, setLoadingChat] = useState(true);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => { onOpen(); return () => {}; }, [onOpen]);

  // Fetch notes once, then use direct state updates via realtime
  useEffect(() => {
    supabase.from('clinic_notes').select('*').order('created_at', { ascending: false })
      .then(({ data }) => { setNotes(data || []); setLoadingNotes(false); });

    const ch = supabase.channel('notes-rt')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'clinic_notes' }, (payload) => {
        const newNote = payload.new as Note;
        setNotes(prev => [newNote, ...prev]);
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'clinic_notes' }, (payload) => {
        const updated = payload.new as Note;
        setNotes(prev => prev.map(n => n.id === updated.id ? updated : n));
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'clinic_notes' }, (payload) => {
        const oldId = (payload.old as any)?.id;
        if (oldId) setNotes(prev => prev.filter(n => n.id !== oldId));
      })
      .subscribe();

    return () => { supabase.removeChannel(ch); };
  }, []);

  // Fetch messages
  useEffect(() => {
    supabase.from('chat_messages').select('*').order('created_at', { ascending: true }).limit(200)
      .then(({ data }) => { setMessages(data || []); setLoadingChat(false); });

    const ch = supabase.channel('chat-rt')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_messages' }, (payload) => {
        setMessages(prev => [...prev, payload.new as ChatMessage]);
      }).subscribe();

    return () => { supabase.removeChannel(ch); };
  }, []);

  // Auto-scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const addNote = async () => {
    if (!newNote.trim() || !user || !profile) return;
    await supabase.from('clinic_notes').insert({
      user_id: user.id,
      author_name: profile.full_name,
      content: newNote.trim(),
    });
    setNewNote('');
  };

  const toggleNote = async (note: Note) => {
    await supabase.from('clinic_notes').update({ completed: !note.completed }).eq('id', note.id);
  };

  const deleteNote = async (id: string) => {
    await supabase.from('clinic_notes').delete().eq('id', id);
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || !user || !profile) return;
    const content = newMessage.trim();
    setNewMessage('');
    await supabase.from('chat_messages').insert({
      user_id: user.id,
      author_name: profile.full_name,
      content,
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (tab === 'chat') sendMessage();
      else addNote();
    }
  };

  const clearAllChat = async () => {
    if (!confirm('¿Borrar TODOS los mensajes del chat? Esta acción no se puede deshacer.')) return;
    const { error } = await supabase.from('chat_messages').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    if (!error) setMessages([]);
  };

  const isSameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

  const formatDateLabel = (iso: string) => {
    const d = new Date(iso);
    const today = new Date();
    const yesterday = new Date(); yesterday.setDate(today.getDate() - 1);
    if (isSameDay(d, today)) return 'HOY';
    if (isSameDay(d, yesterday)) return 'AYER';
    return format(d, "EEEE d 'de' MMMM", { locale: es }).toUpperCase();
  };

  return (
    <div className="bg-card border-b border-border shadow-md max-w-2xl mx-auto animate-slide-up">
      {/* Tab header */}
      <div className="flex items-center border-b border-border">
        <button
          onClick={() => setTab('chat')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-semibold transition-colors ${
            tab === 'chat' ? 'text-primary border-b-2 border-primary' : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <MessageSquare className="w-3.5 h-3.5" />
          Chat
        </button>
        <button
          onClick={() => setTab('notes')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-semibold transition-colors ${
            tab === 'notes' ? 'text-primary border-b-2 border-primary' : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <StickyNote className="w-3.5 h-3.5" />
          Notas
        </button>
        {tab === 'chat' && messages.length > 0 && (
          <button
            onClick={clearAllChat}
            title="Borrar todo el chat"
            className="px-2 py-2.5 text-muted-foreground hover:text-destructive transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}
        <button onClick={onClose} className="px-3 py-2.5 text-muted-foreground hover:text-foreground">
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Content */}
      <div className="h-72 flex flex-col">
        {tab === 'chat' ? (
          <>
            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {loadingChat ? (
                <p className="text-xs text-muted-foreground text-center py-4">Cargando...</p>
              ) : messages.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-4">Sin mensajes aún</p>
              ) : (
                messages.map((m, idx) => {
                  const isOwn = m.user_id === user?.id;
                  const prev = idx > 0 ? messages[idx - 1] : null;
                  const showDateSep = !prev || !isSameDay(new Date(prev.created_at), new Date(m.created_at));
                  return (
                    <div key={m.id}>
                      {showDateSep && (
                        <div className="flex justify-center my-1.5">
                          <span className="text-[9px] font-semibold tracking-wide text-muted-foreground bg-muted/60 px-2 py-0.5 rounded-full">
                            {formatDateLabel(m.created_at)}
                          </span>
                        </div>
                      )}
                      <div className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[75%] rounded-lg px-3 py-1.5 ${
                          isOwn ? 'bg-primary text-primary-foreground' : 'bg-muted text-foreground'
                        }`}>
                          {!isOwn && (
                            <p className="text-[10px] font-semibold opacity-70 mb-0.5">{m.author_name}</p>
                          )}
                          <p className="text-sm whitespace-pre-wrap break-words">{m.content}</p>
                          <p className={`text-[10px] mt-0.5 ${isOwn ? 'text-primary-foreground/60' : 'text-muted-foreground'}`}>
                            {format(new Date(m.created_at), 'HH:mm', { locale: es })}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={chatEndRef} />
            </div>
            <div className="border-t border-border p-2 flex gap-2">
              <input
                value={newMessage}
                onChange={e => setNewMessage(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Escribir mensaje..."
                className="flex-1 text-sm px-3 py-1.5 rounded-md bg-background border border-border focus:outline-none focus:ring-1 focus:ring-primary"
              />
              <Button size="sm" onClick={sendMessage} disabled={!newMessage.trim()}>
                <Send className="w-3.5 h-3.5" />
              </Button>
            </div>
          </>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
              {loadingNotes ? (
                <p className="text-xs text-muted-foreground text-center py-4">Cargando...</p>
              ) : notes.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-4">Sin notas</p>
              ) : (
                notes.map(n => (
                  <div key={n.id} className="flex items-start gap-2 p-2 rounded-md hover:bg-muted/50 group">
                    <Checkbox
                      checked={n.completed}
                      onCheckedChange={() => toggleNote(n)}
                      className="mt-0.5"
                    />
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm break-words ${n.completed ? 'line-through text-muted-foreground' : 'text-foreground'}`}>
                        {n.content}
                      </p>
                      <p className="text-[10px] text-muted-foreground">
                        {n.author_name} · {format(new Date(n.created_at), 'dd/MM HH:mm', { locale: es })}
                      </p>
                    </div>
                    <button
                      onClick={() => deleteNote(n.id)}
                      className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-opacity p-1"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))
              )}
            </div>
            <div className="border-t border-border p-2 flex gap-2">
              <input
                value={newNote}
                onChange={e => setNewNote(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Nueva nota..."
                className="flex-1 text-sm px-3 py-1.5 rounded-md bg-background border border-border focus:outline-none focus:ring-1 focus:ring-primary"
              />
              <Button size="sm" onClick={addNote} disabled={!newNote.trim()}>
                <Check className="w-3.5 h-3.5" />
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
