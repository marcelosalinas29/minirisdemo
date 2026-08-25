import { useState, useRef, useCallback } from 'react';
import { appendChunk } from '@/lib/dictation';

interface SpeechRecognitionHook {
  isListening: boolean;
  transcript: string;
  interimTranscript: string;
  error: string | null;
  startListening: () => void;
  stopListening: () => void;
  clearTranscript: () => void;
  setTranscript: (text: string) => void;
  isSupported: boolean;
}

export function useSpeechRecognition(): SpeechRecognitionHook {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);
  const recognitionRef = useRef<any>(null);
  const gotSpeechRef = useRef(false);

  const SpeechRecognition =
    typeof window !== 'undefined'
      ? (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
      : null;

  const isSupported = !!SpeechRecognition;

  const startListening = useCallback(async () => {
    if (!SpeechRecognition) return;
    setError(null);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((t) => t.stop());
    } catch (e: any) {
      const name = e?.name || '';
      if (name === 'NotAllowedError' || name === 'SecurityError') {
        setError(
          'El navegador bloqueó el micrófono. Tocá el candado en la barra de direcciones, permití el micrófono y recargá.',
        );
      } else if (name === 'NotFoundError') {
        setError('No se detectó ningún micrófono conectado a esta PC.');
      } else {
        setError('No se pudo acceder al micrófono. Cerrá otras apps que lo estén usando.');
      }
      setIsListening(false);
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'es-AR';
    recognition.continuous = true;
    recognition.interimResults = true;
    gotSpeechRef.current = false;

    recognition.onresult = (event: any) => {
      let finalTranscript = '';
      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          finalTranscript += result[0].transcript + ' ';
        } else {
          interim += result[0].transcript;
        }
      }
      if (finalTranscript || interim) gotSpeechRef.current = true;
      if (finalTranscript) {
        setTranscript((prev) => appendChunk(prev, finalTranscript));
      }
      setInterimTranscript(interim);
    };

    recognition.onerror = (event: any) => {
      const err = event.error;
      if (err === 'no-speech') {
        if (!gotSpeechRef.current) {
          setError('No se detecta audio del micrófono. Verificá que esté seleccionado el micrófono correcto en la PC.');
        }
        return;
      }
      if (err === 'not-allowed' || err === 'service-not-allowed') {
        setError('Permiso de micrófono denegado por el navegador.');
      } else if (err === 'audio-capture') {
        setError('No se pudo capturar audio. Revisá el micrófono de la PC.');
      } else if (err === 'network') {
        setError('Sin conexión con el servicio de reconocimiento de voz.');
      }
      recognitionRef.current = null;
      setIsListening(false);
    };

    recognition.onend = () => {
      if (recognitionRef.current) {
        try {
          recognition.start();
        } catch {
          setIsListening(false);
        }
      }
    };

    recognitionRef.current = recognition;
    recognition.start();
    setIsListening(true);
    setInterimTranscript('');
  }, [SpeechRecognition]);

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      const ref = recognitionRef.current;
      recognitionRef.current = null;
      try { ref.stop(); } catch { /* noop */ }
      setIsListening(false);
      setInterimTranscript('');
    }
  }, []);

  const clearTranscript = useCallback(() => {
    setTranscript('');
    setInterimTranscript('');
    setError(null);
  }, []);

  return {
    isListening,
    transcript,
    interimTranscript,
    error,
    startListening,
    stopListening,
    clearTranscript,
    setTranscript,
    isSupported,
  };
}
