import { useMemo, useRef, useState } from 'react';
import { Bot, Send, X, RefreshCw, Sparkles, Minimize2, Mic, MicOff, Volume2 } from 'lucide-react';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/db/supabase';

type ChatRole = 'assistant' | 'user';

type ChatMessage = {
  id: string;
  role: ChatRole;
  text: string;
};

type AiResponse = {
  answer?: string;
  generatedAt?: string;
  mode?: 'free_ai' | 'fallback';
  error?: string;
};

type SpeechRecognitionLike = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  onresult: ((event: any) => void) | null;
  onerror: ((event: any) => void) | null;
  onend: (() => void) | null;
};

declare global {
  interface Window {
    SpeechRecognition?: new () => SpeechRecognitionLike;
    webkitSpeechRecognition?: new () => SpeechRecognitionLike;
  }
}

const WELCOME_MESSAGE: ChatMessage = {
  id: 'welcome',
  role: 'assistant',
  text: "Hi! I'm LeaveSync AI. Ask me anything related to this portal data.",
};

function makeId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

async function askPortalAi(question: string): Promise<AiResponse> {
  const { data, error } = await supabase.functions.invoke('ai-portal-insights', {
    body: { question },
  });

  if (error) {
    throw new Error(error.message || 'AI assistant function failed.');
  }

  return (data ?? {}) as AiResponse;
}

export default function DirectorAiAssistant() {
  const [open, setOpen] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([WELCOME_MESSAGE]);
  const [listening, setListening] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(false);

  const scrollRef = useRef<HTMLDivElement | null>(null);

  const lastUpdated = useMemo(() => {
    if (!lastUpdatedAt) return 'Ready';
    return format(lastUpdatedAt, 'dd MMM, hh:mm a');
  }, [lastUpdatedAt]);

  const resetChat = () => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    setMessages([{ ...WELCOME_MESSAGE, id: 'welcome' }]);
    setInput('');
    setLastUpdatedAt(null);
  };

  const speakAnswer = (text: string) => {
    if (!voiceEnabled || typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    const shortText = text.replace(/•/g, '').slice(0, 700);
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(shortText);
    utterance.lang = 'en-IN';
    utterance.rate = 0.95;
    window.speechSynthesis.speak(utterance);
  };

  const startVoiceInput = () => {
    if (typeof window === 'undefined') return;
    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Recognition) {
      setMessages((prev) => [
        ...prev,
        {
          id: makeId(),
          role: 'assistant',
          text: 'Voice input is not supported in this browser. Please type your question.',
        },
      ]);
      return;
    }

    const recognition = new Recognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = 'en-IN';
    recognition.onresult = (event: any) => {
      const transcript = String(event?.results?.[0]?.[0]?.transcript ?? '').trim();
      if (transcript) {
        setInput(transcript);
        askQuestion(transcript);
      }
    };
    recognition.onerror = () => setListening(false);
    recognition.onend = () => setListening(false);
    setListening(true);
    recognition.start();
  };

  const askQuestion = async (question: string) => {
    const cleanQuestion = question.trim();
    if (!cleanQuestion || busy) return;

    setMessages((prev) => [...prev, { id: makeId(), role: 'user', text: cleanQuestion }]);
    setInput('');
    setBusy(true);

    try {
      const result = await askPortalAi(cleanQuestion);
      const answer = result.answer || result.error || 'I could not prepare an answer for this question.';
      setMessages((prev) => [...prev, { id: makeId(), role: 'assistant', text: answer }]);
      speakAnswer(answer);
      setLastUpdatedAt(result.generatedAt ? new Date(result.generatedAt) : new Date());
      setTimeout(() => scrollRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
    } catch (error: any) {
      setMessages((prev) => [
        ...prev,
        {
          id: makeId(),
          role: 'assistant',
          text:
            `I could not answer from portal data right now. ${error?.message ?? 'Please try again.'}\n\n` +
            'Check that the ai-portal-insights Edge Function is deployed and the free AI key is saved in Supabase secrets.',
        },
      ]);
    } finally {
      setBusy(false);
    }
  };

  const refreshData = async () => {
    // This refresh button intentionally clears the current chat.
    // Browser page refresh also starts with a clean conversation because no chat history is stored.
    resetChat();
  };

  return (
    <>
      {!open && (
        <button
          type="button"
          onClick={() => {
            setOpen(true);
            setMinimized(false);
          }}
          className="fixed bottom-5 right-4 z-50 flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-orange-500 via-primary to-purple-600 p-[3px] shadow-2xl transition hover:scale-105 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 sm:bottom-6 sm:right-6"
          aria-label="Open LeaveSync AI"
        >
          <span className="relative flex h-full w-full items-center justify-center rounded-full bg-background">
            <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[9px] font-bold text-primary-foreground shadow">
              AI
            </span>
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-card shadow-inner">
              <Bot className="h-7 w-7 text-primary" />
            </span>
          </span>
        </button>
      )}

      {open && (
        <div className="fixed bottom-3 right-3 z-50 w-[calc(100vw-1.5rem)] max-w-[430px] overflow-hidden rounded-2xl border border-border/80 bg-background shadow-2xl sm:bottom-5 sm:right-5">
          <div className="flex items-center justify-between border-b bg-card px-4 py-3">
            <div className="flex min-w-0 items-center gap-3">
              <div className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-orange-500 via-primary to-purple-600 p-[2px]">
                <div className="flex h-full w-full items-center justify-center rounded-full bg-background">
                  <Bot className="h-6 w-6 text-primary" />
                </div>
                <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-card bg-green-500" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <p className="truncate font-semibold">LeaveSync AI</p>
                  <Badge variant="secondary" className="text-[10px]">
                    Free
                  </Badge>
                </div>
                <p className="truncate text-xs text-muted-foreground">Portal data assistant • {lastUpdated}</p>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <Button size="icon" variant="ghost" className="h-8 w-8" onClick={refreshData} disabled={busy} aria-label="Clear AI chat">
                <RefreshCw className={`h-4 w-4 ${busy ? 'animate-spin' : ''}`} />
              </Button>
              <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setMinimized((value) => !value)} aria-label="Minimize AI chat">
                <Minimize2 className="h-4 w-4" />
              </Button>
              <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setOpen(false)} aria-label="Close AI chat">
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {!minimized && (
            <>
              <ScrollArea className="h-[410px] max-h-[60vh] bg-muted/20 px-3 py-3">
                <div className="space-y-3">
                  {messages.map((message) => (
                    <div key={message.id} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                      <div
                        className={`max-w-[88%] whitespace-pre-wrap rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
                          message.role === 'user'
                            ? 'bg-primary text-primary-foreground'
                            : 'border border-border/80 bg-background text-foreground'
                        }`}
                      >
                        {message.text}
                      </div>
                    </div>
                  ))}
                  {busy && (
                    <div className="flex justify-start">
                      <div className="flex items-center gap-2 rounded-2xl border border-border/80 bg-background px-3.5 py-2.5 text-sm text-muted-foreground">
                        <Sparkles className="h-4 w-4 animate-pulse text-primary" />
                        Reading live portal data...
                      </div>
                    </div>
                  )}
                  <div ref={scrollRef} />
                </div>
              </ScrollArea>

              <div className="border-t bg-card p-3">
                <form
                  className="flex items-end gap-2"
                  onSubmit={(event) => {
                    event.preventDefault();
                    askQuestion(input);
                  }}
                >
                  <textarea
                    value={input}
                    onChange={(event) => setInput(event.target.value)}
                    placeholder="Ask about LeaveSync portal data..."
                    rows={1}
                    className="max-h-24 min-h-10 flex-1 resize-none rounded-xl border border-input bg-background px-3 py-2 text-sm outline-none ring-offset-background placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' && !event.shiftKey) {
                        event.preventDefault();
                        askQuestion(input);
                      }
                    }}
                  />
                  <Button
                    type="button"
                    size="icon"
                    variant="outline"
                    className="h-10 w-10 shrink-0 rounded-xl"
                    onClick={startVoiceInput}
                    disabled={busy || listening}
                    aria-label="Ask by voice"
                    title="Ask by voice"
                  >
                    {listening ? <MicOff className="h-4 w-4 text-destructive" /> : <Mic className="h-4 w-4" />}
                  </Button>
                  <Button
                    type="button"
                    size="icon"
                    variant={voiceEnabled ? 'default' : 'outline'}
                    className="h-10 w-10 shrink-0 rounded-xl"
                    onClick={() => setVoiceEnabled((value) => !value)}
                    aria-label="Toggle voice reply"
                    title="Toggle voice reply"
                  >
                    <Volume2 className="h-4 w-4" />
                  </Button>
                  <Button type="submit" size="icon" className="h-10 w-10 shrink-0 rounded-xl" disabled={busy || !input.trim()}>
                    <Send className="h-4 w-4" />
                  </Button>
                </form>
                <p className="mt-2 text-[11px] text-muted-foreground">
                  Read-only assistant. Mic uses browser voice input. No chat history is stored after refresh.
                </p>
              </div>
            </>
          )}
        </div>
      )}
    </>
  );
}
