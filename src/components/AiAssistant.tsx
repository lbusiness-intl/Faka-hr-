import { useState, useRef, useEffect, type FormEvent } from 'react';
import { Sparkles, X, Send, AlertCircle } from 'lucide-react';
import { useI18n } from '../lib/i18n';
import { useAuth } from '../lib/auth';
import { supabase } from '../lib/supabase';
import { Spinner } from './ui';

type Msg = { role: 'user' | 'assistant'; content: string };

/**
 * Floating AI assistant.
 *
 * Deliberate behaviour: if the backend reports AI_NOT_CONFIGURED (no
 * ANTHROPIC_API_KEY set on the project), the launcher hides itself for the
 * rest of the session instead of leaving a button that always errors. A
 * visible feature that never works is worse than no feature.
 */
export function AiAssistant() {
  const { t } = useI18n();
  const { activeTenant } = useAuth();
  const [open, setOpen] = useState(false);
  const [unavailable, setUnavailable] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, loading]);

  if (!activeTenant || unavailable) return null;

  async function send(e: FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || loading || !activeTenant) return;

    const next: Msg[] = [...messages, { role: 'user', content: text }];
    setMessages(next);
    setInput('');
    setError(null);
    setLoading(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-assistant`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.access_token ?? ''}`,
        },
        body: JSON.stringify({ tenantId: activeTenant.id, messages: next }),
      });
      const json = await res.json();

      if (json.error === 'AI_NOT_CONFIGURED') {
        setUnavailable(true);
        return;
      }
      if (!res.ok || json.ok === false) {
        setError(t('ai.error'));
        return;
      }
      setMessages([...next, { role: 'assistant', content: json.reply }]);
    } catch {
      setError(t('ai.error'));
    } finally {
      setLoading(false);
    }
  }

  const suggestions = [t('ai.suggest1'), t('ai.suggest2'), t('ai.suggest3')];

  return (
    <>
      {!open && (
        <button
          onClick={() => setOpen(true)}
          aria-label={t('ai.title')}
          className="fixed bottom-6 right-6 z-40 w-14 h-14 rounded-full bg-coral-500 hover:bg-coral-600 text-white shadow-2xl flex items-center justify-center transition-transform hover:scale-105"
        >
          <Sparkles size={22} />
        </button>
      )}

      {open && (
        <div className="fixed bottom-6 right-6 z-40 w-[calc(100vw-3rem)] sm:w-96 h-[32rem] max-h-[calc(100vh-3rem)] card shadow-2xl flex flex-col overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-white/10 shrink-0">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-coral-50 dark:bg-coral-500/10 text-coral-600 dark:text-coral-300 flex items-center justify-center">
                <Sparkles size={15} />
              </div>
              <div>
                <div className="font-display text-sm font-semibold text-slate-900 dark:text-white">{t('ai.title')}</div>
                <div className="text-[11px] text-slate-400 dark:text-white/40">{activeTenant.name}</div>
              </div>
            </div>
            <button onClick={() => setOpen(false)} aria-label={t('ai.close')} className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/10 transition-colors">
              <X size={16} />
            </button>
          </div>

          <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
            {messages.length === 0 && (
              <div className="text-center py-6">
                <p className="text-sm text-slate-500 dark:text-white/50">{t('ai.intro')}</p>
                <div className="mt-4 space-y-2">
                  {suggestions.map((s) => (
                    <button
                      key={s}
                      onClick={() => setInput(s)}
                      className="w-full text-left text-xs rounded-xl border border-slate-200 dark:border-white/10 px-3 py-2 text-slate-600 dark:text-white/60 hover:border-coral-200 dark:hover:border-coral-500/30 hover:text-slate-900 dark:hover:text-white transition-colors"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((m, i) => (
              <div key={i} className={m.role === 'user' ? 'flex justify-end' : 'flex justify-start'}>
                <div className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm whitespace-pre-wrap ${
                  m.role === 'user'
                    ? 'bg-coral-500 text-white'
                    : 'bg-slate-100 dark:bg-white/5 text-slate-800 dark:text-white/80'
                }`}>
                  {m.content}
                </div>
              </div>
            ))}

            {loading && (
              <div className="flex justify-start">
                <div className="rounded-2xl bg-slate-100 dark:bg-white/5 px-3.5 py-2.5">
                  <Spinner />
                </div>
              </div>
            )}

            {error && (
              <div className="flex items-start gap-2 text-xs text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-500/10 rounded-xl px-3 py-2">
                <AlertCircle size={14} className="shrink-0 mt-0.5" /> {error}
              </div>
            )}
          </div>

          <form onSubmit={send} className="p-3 border-t border-slate-200 dark:border-white/10 shrink-0">
            <div className="flex items-center gap-2 rounded-full border border-slate-200 dark:border-white/10 bg-white dark:bg-ink-800 pl-4 pr-1.5 py-1.5">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={t('ai.placeholder')}
                className="flex-1 min-w-0 bg-transparent border-0 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none"
              />
              <button
                type="submit"
                disabled={loading || !input.trim()}
                aria-label={t('ai.send')}
                className="w-8 h-8 rounded-full bg-coral-500 hover:bg-coral-600 disabled:opacity-40 disabled:cursor-not-allowed text-white flex items-center justify-center transition-colors shrink-0"
              >
                <Send size={14} />
              </button>
            </div>
            <p className="mt-2 text-[10px] text-center text-slate-400 dark:text-white/30">{t('ai.disclaimer')}</p>
          </form>
        </div>
      )}
    </>
  );
}
