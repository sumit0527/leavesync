import { useEffect, useMemo, useRef, useState } from 'react';
import { Bot, Send, X, RefreshCw, Sparkles, Minimize2, Mic, Square, Wand2 } from 'lucide-react';
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
  transcript?: string;
  generatedAt?: string;
  mode?: string;
  error?: string;
};

const WELCOME_MESSAGE: ChatMessage = {
  id: 'welcome',
  role: 'assistant',
  text: 'Hi, ask me about LeaveSync portal data.',
};

const QUICK_INSIGHTS = [
  'Today portal summary',
  'Analytics report unit-wise',
  'Department-wise staff summary',
  'Pending applications unit-wise',
  'Who is on leave today?',
  'Low leave balance users',
  'Principal and UH status unit-wise',
  'Pending leaves older than 24 hours',
];

function makeId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = String(reader.result ?? '');
      resolve(result.includes(',') ? result.split(',')[1] : result);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

async function askPortalAi(payload: { question?: string; audioBase64?: string; audioMimeType?: string }, history: ChatMessage[]): Promise<AiResponse> {
  const compactHistory = history
    .filter((message) => message.id !== 'welcome')
    .slice(-8)
    .map((message) => ({ role: message.role, text: message.text }));

  const { data, error } = await supabase.functions.invoke('ai-portal-insights', {
    body: { ...payload, history: compactHistory },
  });

  if (error) throw new Error(error.message || 'AI assistant function failed.');
  return (data ?? {}) as AiResponse;
}

export default function DirectorAiAssistant() {
  const [open, setOpen] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([WELCOME_MESSAGE]);
  const [recording, setRecording] = useState(false);
  const [voiceSupported, setVoiceSupported] = useState(false);

  const scrollRef = useRef<HTMLDivElement | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const voiceStopTimerRef = useRef<number | null>(null);
  const messagesRef = useRef<ChatMessage[]>([WELCOME_MESSAGE]);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  useEffect(() => {
    if (typeof navigator !== 'undefined') {
      setVoiceSupported(Boolean(navigator.mediaDevices?.getUserMedia && typeof MediaRecorder !== 'undefined'));
    }

    return () => {
      if (voiceStopTimerRef.current) window.clearTimeout(voiceStopTimerRef.current);
      mediaRecorderRef.current?.stop?.();
      mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  useEffect(() => {
    if (!open || minimized) return;
    const id = window.setTimeout(() => scrollRef.current?.scrollIntoView({ behavior: 'smooth' }), 60);
    return () => window.clearTimeout(id);
  }, [messages, busy, open, minimized]);

  const lastUpdated = useMemo(() => {
    if (!lastUpdatedAt) return 'Ready';
    return format(lastUpdatedAt, 'dd MMM, hh:mm a');
  }, [lastUpdatedAt]);

  const resetChat = () => {
    if (recording) stopVoiceRecording();
    setMessages([{ ...WELCOME_MESSAGE, id: 'welcome' }]);
    setInput('');
    setLastUpdatedAt(null);
  };

  const appendAssistant = (text: string) => {
    setMessages((prev) => [...prev, { id: makeId(), role: 'assistant', text }]);
  };

  const handleAiResult = (result: AiResponse, userText?: string) => {
    const answer = result.answer || result.error || 'I could not prepare an answer for this question.';
    if (result.transcript && !userText) {
      setMessages((prev) => [...prev, { id: makeId(), role: 'user', text: result.transcript || 'Voice question' }]);
    }
    appendAssistant(answer);
    setLastUpdatedAt(result.generatedAt ? new Date(result.generatedAt) : new Date());
  };

  const askQuestion = async (question: string) => {
    const cleanQuestion = question.trim();
    if (!cleanQuestion || busy) return;

    const userMessage: ChatMessage = { id: makeId(), role: 'user', text: cleanQuestion };
    const historySnapshot = [...messagesRef.current, userMessage];
    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setBusy(true);

    try {
      const result = await askPortalAi({ question: cleanQuestion }, historySnapshot);
      handleAiResult(result, cleanQuestion);
    } catch (error: any) {
      appendAssistant(
        `I could not answer from portal data right now. ${error?.message ?? 'Please try again.'}\n\nCheck that ai-portal-insights is deployed and GEMINI_API_KEY is saved in Supabase secrets.`,
      );
    } finally {
      setBusy(false);
    }
  };

  const startVoiceRecording = async () => {
    if (!voiceSupported || busy || recording) {
      if (!voiceSupported) appendAssistant('Voice input is not supported on this device/browser. Please type the question.');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;
      audioChunksRef.current = [];

      const preferredType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? 'audio/webm;codecs=opus' : 'audio/webm';
      const recorder = new MediaRecorder(stream, { mimeType: preferredType });
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) audioChunksRef.current.push(event.data);
      };

      recorder.onstop = async () => {
        const chunks = [...audioChunksRef.current];
        const mimeType = recorder.mimeType || preferredType;
        mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
        mediaStreamRef.current = null;
        setRecording(false);
        if (!chunks.length) return;

        setBusy(true);
        try {
          const audioBlob = new Blob(chunks, { type: mimeType });
          const audioBase64 = await blobToBase64(audioBlob);
          const result = await askPortalAi({ audioBase64, audioMimeType: mimeType }, messagesRef.current);
          handleAiResult(result);
        } catch (error: any) {
          appendAssistant(`Voice question failed. ${error?.message ?? 'Please type your question or try again.'}`);
        } finally {
          setBusy(false);
        }
      };

      recorder.start();
      setRecording(true);
      voiceStopTimerRef.current = window.setTimeout(() => stopVoiceRecording(), 12000);
    } catch {
      setRecording(false);
      appendAssistant('Microphone permission was blocked or voice could not start. Please allow microphone access or type your question.');
    }
  };

  const stopVoiceRecording = () => {
    if (voiceStopTimerRef.current) {
      window.clearTimeout(voiceStopTimerRef.current);
      voiceStopTimerRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    } else {
      setRecording(false);
      mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }
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
          className="group fixed bottom-5 right-4 z-50 flex h-[68px] w-[68px] items-center justify-center rounded-full bg-gradient-to-br from-primary via-orange-500 to-purple-600 p-[3px] shadow-2xl transition hover:scale-105 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 sm:bottom-6 sm:right-6"
          aria-label="Open LeaveSync AI"
        >
          <span className="absolute inset-0 rounded-full bg-primary/20 opacity-70 blur-md transition group-hover:opacity-100" />
          <span className="relative flex h-full w-full items-center justify-center overflow-hidden rounded-full bg-background">
            <span className="absolute left-1 top-2 h-7 w-7 rounded-full bg-primary/15 blur-md transition-transform duration-700 group-hover:translate-x-6" />
            <span className="absolute -right-1 -top-1 flex h-6 w-6 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground shadow">
              AI
            </span>
            <span className="relative flex h-12 w-12 items-center justify-center rounded-full bg-card shadow-inner">
              <Bot className="h-8 w-8 text-primary transition-transform duration-500 group-hover:-translate-y-0.5 group-hover:scale-105" />
              <Sparkles className="absolute -right-1 -top-1 h-4 w-4 animate-pulse text-orange-500" />
            </span>
          </span>
        </button>
      )}

      {open && (
        <div className="fixed bottom-3 right-3 z-50 w-[calc(100vw-1.25rem)] max-w-[460px] overflow-hidden rounded-2xl border border-border/80 bg-background shadow-2xl sm:bottom-5 sm:right-5">
          <div className="flex items-center justify-between gap-2 border-b bg-card px-3 py-3 sm:px-4">
            <div className="flex min-w-0 items-center gap-2 sm:gap-3">
              <div className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary via-orange-500 to-purple-600 p-[2px]">
                <div className="flex h-full w-full items-center justify-center rounded-full bg-background">
                  <Bot className="h-6 w-6 text-primary" />
                </div>
                <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-card bg-green-500" />
              </div>
              <div className="min-w-0">
                <div className="flex min-w-0 items-center gap-2">
                  <p className="truncate font-semibold">LeaveSync AI</p>
                  <Badge variant="secondary" className="shrink-0 text-[10px]">
                    Free
                  </Badge>
                </div>
                <p className="truncate text-[11px] text-muted-foreground sm:text-xs">Director/Viewer insights • {lastUpdated}</p>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <Button size="icon" variant="ghost" className="h-8 w-8" onClick={resetChat} disabled={busy} aria-label="Clear AI chat">
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
              <div className="border-b bg-card/70 px-3 py-2">
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {QUICK_INSIGHTS.map((question) => (
                    <button
                      type="button"
                      key={question}
                      onClick={() => askQuestion(question)}
                      disabled={busy}
                      className="shrink-0 rounded-full border bg-background px-3 py-1.5 text-[11px] font-medium text-muted-foreground transition hover:border-primary hover:text-primary disabled:opacity-50"
                    >
                      {question}
                    </button>
                  ))}
                </div>
              </div>

              <ScrollArea className="h-[410px] max-h-[57vh] bg-muted/20 px-3 py-3 sm:max-h-[60vh]">
                <div className="space-y-3">
                  {messages.map((message) => (
                    <div key={message.id} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                      <div
                        className={`max-w-[90%] whitespace-pre-wrap break-words rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed sm:max-w-[88%] ${
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
                        Analyzing portal data...
                      </div>
                    </div>
                  )}
                  {recording && (
                    <div className="flex justify-start">
                      <div className="flex items-center gap-2 rounded-2xl border border-destructive/30 bg-background px-3.5 py-2.5 text-sm text-muted-foreground">
                        <Mic className="h-4 w-4 animate-pulse text-destructive" />
                        Listening... tap stop when done.
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
                    placeholder="Ask portal data..."
                    rows={1}
                    className="max-h-24 min-h-10 flex-1 resize-none rounded-xl border border-input bg-background px-3 py-2 text-sm outline-none ring-offset-background placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' && !event.shiftKey) {
                        event.preventDefault();
                        askQuestion(input);
                      }
                    }}
                  />
                  {voiceSupported && (
                    <Button
                      type="button"
                      size="icon"
                      variant={recording ? 'destructive' : 'outline'}
                      className="h-10 w-10 shrink-0 rounded-xl"
                      onClick={recording ? stopVoiceRecording : startVoiceRecording}
                      disabled={busy && !recording}
                      aria-label={recording ? 'Stop voice question' : 'Ask by voice'}
                      title={recording ? 'Stop voice question' : 'Ask by voice'}
                    >
                      {recording ? <Square className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                    </Button>
                  )}
                  <Button type="submit" size="icon" className="h-10 w-10 shrink-0 rounded-xl" disabled={busy || !input.trim()}>
                    {busy ? <Wand2 className="h-4 w-4 animate-pulse" /> : <Send className="h-4 w-4" />}
                  </Button>
                </form>
                <p className="mt-2 text-[10px] leading-snug text-muted-foreground sm:text-[11px]">
                  Read-only. Follow-up memory works in this chat only; refresh clears it. Voice uses Gemini with your free key.
                </p>
              </div>
            </>
          )}
        </div>
      )}
    </>
  );
}
