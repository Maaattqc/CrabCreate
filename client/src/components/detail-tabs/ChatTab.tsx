import { useState, useEffect, useRef, useCallback } from 'react';
import { Send } from 'lucide-react';
import { getTicketChat, sendChatMessage } from '../../api/tickets';
import { useSocket } from '../../hooks/useSocket';
import { useLanguage } from '../../hooks/useLanguage';
import { useAIDesign } from '../../hooks/useAIDesign';
import { useSpeechToText } from '../../hooks/useSpeechToText';
import MicButton from '../common/MicButton';
import type { ChatMessage } from '../../types';

interface ChatTabProps {
  ticketId: number;
}

/* Typewriter hook: reveals text in chunks for a fast but visible effect */
function useTypewriter(text: string, speed = 4): { display: string; done: boolean } {
  const [charIdx, setCharIdx] = useState(0);
  // Reveal multiple chars per tick for longer messages
  const chunkSize = Math.max(1, Math.ceil(text.length / 80));

  useEffect(() => {
    setCharIdx(0);
  }, [text]);

  useEffect(() => {
    if (charIdx >= text.length) return;
    const timer = setTimeout(() => setCharIdx(i => Math.min(i + chunkSize, text.length)), speed);
    return () => clearTimeout(timer);
  }, [charIdx, text, speed, chunkSize]);

  return { display: text.slice(0, charIdx), done: charIdx >= text.length };
}

function AIMessageBubble({ msg, isLast, aiDesign }: {
  msg: ChatMessage;
  isLast: boolean;
  aiDesign: boolean;
}) {
  const { display, done } = useTypewriter(msg.message, aiDesign && isLast ? 18 : 0);
  const text = aiDesign && isLast ? display : msg.message;

  return (
    <div className="flex justify-start">
      <div className="max-w-[80%]">
        <div className="px-3 py-2 rounded-lg text-sm bg-subtle text-tx-tertiary">
          <div className="whitespace-pre-wrap break-words">
            {text}
            {aiDesign && isLast && !done && <span className="ai-typewriter-cursor" />}
          </div>
          <div className="text-[10px] text-tx-ghost mt-1">
            {new Date(msg.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ChatTab({ ticketId }: ChatTabProps) {
  const { t } = useLanguage();
  const { aiDesign } = useAIDesign();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { on, off } = useSocket();

  const handleTranscript = useCallback((text: string, isFinal: boolean) => {
    if (isFinal) setInput(prev => prev ? `${prev} ${text}` : text);
  }, []);
  const { isListening, isSupported, toggle: toggleMic } = useSpeechToText({ onTranscript: handleTranscript });

    const handleMicClick = useCallback(() => {
      inputRef.current?.focus();
      toggleMic();
    }, [toggleMic]);

  const fetchChat = () => {
    getTicketChat(ticketId).then(data => {
      setMessages(data.messages);
    }).catch(() => {});
  };

  useEffect(() => {
    fetchChat();
  }, [ticketId]);

  // Refresh on socket update
  useEffect(() => {
    on('ticket:updated', (data: { ticketId: number; chatUpdate?: boolean }) => {
      if (data.ticketId === ticketId && data.chatUpdate) {
        fetchChat();
      }
    });
    return () => off('ticket:updated');
  }, [ticketId, on, off]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || sending) return;
    const msg = input.trim();
    setInput('');
    setSending(true);

    // Optimistic add
    setMessages(prev => [...prev, { id: Date.now(), role: 'user', message: msg, created_at: new Date().toISOString() }]);

    try {
      await sendChatMessage(ticketId, msg);
    } catch (err) {
      console.error('Chat error:', err);
    } finally {
      setSending(false);
    }
  };

  const lastAiIdx = messages.reduce((acc, m, i) => m.role === 'ai' ? i : acc, -1);

  return (
    <div className="flex flex-col h-full min-h-[250px]">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 && (
          <div className="text-xs text-tx-ghost text-center py-8">{t.chatEmpty}</div>
        )}
        {messages.map((msg, i) => {
          if (msg.role === 'ai') {
            return (
              <AIMessageBubble
                key={msg.id || i}
                msg={msg}
                isLast={i === lastAiIdx}
                aiDesign={aiDesign}
              />
            );
          }
          return (
            <div key={msg.id || i} className="flex justify-end">
              <div className="max-w-[80%] px-3 py-2 rounded-lg text-sm bg-amber-500/20 text-amber-200">
                <div className="whitespace-pre-wrap break-words">{msg.message}</div>
                <div className="text-[10px] text-tx-ghost mt-1">
                  {new Date(msg.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="p-3 border-t border-th-border">
        <div className="flex gap-2">
          <input
            ref={inputRef}
            value={input}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setInput(e.target.value)}
            onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => e.key === 'Enter' && !e.shiftKey && handleSend()}
            placeholder={t.chatPlaceholder}
            className="flex-1 bg-subtle border border-th-border-strong rounded-lg px-3 py-2 text-sm text-tx-secondary focus:outline-none focus:border-amber-500/50"
            disabled={sending}
          />
          <MicButton isListening={isListening} isSupported={isSupported} onClick={handleMicClick} size={14} />
          <button
            onClick={handleSend}
            disabled={!input.trim() || sending}
            className="px-3 py-2 bg-gradient-to-r from-amber-500 to-red-500 text-white rounded-lg hover:from-amber-400 hover:to-red-400 disabled:opacity-50 transition-all"
          >
            <Send size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}
