import { useState, useEffect, useRef, useCallback } from 'react';
import { useLanguage } from './useLanguage';

const LANG_MAP: Record<string, string> = {
  fr: 'fr-FR',
  en: 'en-US',
};

function getRecognitionCtor() {
  return typeof window !== 'undefined'
    ? window.SpeechRecognition || window.webkitSpeechRecognition
    : undefined;
}

// Singleton: only one mic active across the entire app
let activeInstance: SpeechRecognition | null = null;
let activeStopCallback: (() => void) | null = null;

interface UseSpeechToTextOptions {
  lang?: string;
  continuous?: boolean;
  onTranscript?: (text: string, isFinal: boolean) => void;
}

export function useSpeechToText(options: UseSpeechToTextOptions = {}) {
  const { continuous = true, onTranscript } = options;
  const { lang: appLang } = useLanguage();
  const lang = options.lang || appLang;

  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const isSupported = !!getRecognitionCtor();

  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const mountedRef = useRef(true);
  const onTranscriptRef = useRef(onTranscript);
  onTranscriptRef.current = onTranscript;

  // StrictMode-safe: reset mountedRef on each mount
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      // Cleanup: abort if this component unmounts while listening
      if (recognitionRef.current) {
        recognitionRef.current.abort();
        if (activeInstance === recognitionRef.current) {
          activeInstance = null;
          activeStopCallback = null;
        }
        recognitionRef.current = null;
      }
    };
  }, []);

  const stop = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      if (activeInstance === recognitionRef.current) {
        activeInstance = null;
        activeStopCallback = null;
      }
      recognitionRef.current = null;
    }
    if (mountedRef.current) {
      setIsListening(false);
    }
  }, []);

  const start = useCallback(() => {
    const Ctor = getRecognitionCtor();
    if (!Ctor) return;

    // Stop any other active instance (singleton)
    if (activeInstance) {
      activeInstance.abort();
      activeStopCallback?.();
      activeInstance = null;
      activeStopCallback = null;
    }

    const recognition = new Ctor();
    recognition.continuous = continuous;
    recognition.interimResults = true;
    recognition.lang = LANG_MAP[lang] || lang;
    recognition.maxAlternatives = 1;

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let interimTranscript = '';
      let finalTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          finalTranscript += result[0].transcript;
        } else {
          interimTranscript += result[0].transcript;
        }
      }

      if (finalTranscript) {
        if (mountedRef.current) setTranscript(finalTranscript);
        onTranscriptRef.current?.(finalTranscript, true);
      } else if (interimTranscript) {
        if (mountedRef.current) setTranscript(interimTranscript);
        onTranscriptRef.current?.(interimTranscript, false);
      }
    };

    recognition.onend = () => {
      if (activeInstance === recognition) {
        activeInstance = null;
        activeStopCallback = null;
      }
      recognitionRef.current = null;
      if (mountedRef.current) {
        setIsListening(false);
      }
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      // 'aborted' is expected when we call abort() ourselves
      if (event.error === 'aborted') return;
      if (activeInstance === recognition) {
        activeInstance = null;
        activeStopCallback = null;
      }
      recognitionRef.current = null;
      if (mountedRef.current) {
        setIsListening(false);
      }
    };

    recognitionRef.current = recognition;
    activeInstance = recognition;
    activeStopCallback = stop;

    recognition.start();
    if (mountedRef.current) {
      setIsListening(true);
      setTranscript('');
    }
  }, [continuous, lang, stop]);

  const toggle = useCallback(() => {
    if (isListening) {
      stop();
    } else {
      start();
    }
  }, [isListening, start, stop]);

  return { isListening, isSupported, transcript, start, stop, toggle };
}
