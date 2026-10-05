import { useState, useRef, useEffect, useCallback } from "react";
import { ChatTeardropDots, PaperPlaneRight, X, Sparkle, ArrowCounterClockwise } from "@phosphor-icons/react";
import { STREAM_URL } from "@/lib/api";
import ReactMarkdownLite from "@/components/ReactMarkdownLite";
import { useSettings } from "@/contexts/SettingsContext";

const GREETING = {
  role: "assistant",
  content:
    "Hi, I'm Aria — the Synferrous assistant. Ask me about business analysis, building an AI product, automating a process, or just tell me what you're trying to solve.",
};

// Shown until the visitor sends their first message, so a new panel isn't
// a big empty box.
const STARTERS = [
  "What does a business analysis engagement look like?",
  "Can you help us build an AI MVP?",
  "How do you scope and price a project?",
];

const SESSION_KEY = "iris_session";
const storage = {
  get: (k) => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k, v) => { try { localStorage.setItem(k, v); } catch { /* private mode */ } },
  del: (k) => { try { localStorage.removeItem(k); } catch { /* private mode */ } },
};

/**
 * Only mounts when the backend reports the assistant is configured. A wrapper
 * rather than an early return inside the widget, because hooks can't be
 * called conditionally.
 */
export default function ChatWidget() {
  const { chat_enabled } = useSettings();
  return chat_enabled ? <ChatWidgetInner /> : null;
}

function ChatWidgetInner() {
  const [open, setOpen] = useState(false);
  const [sessionId, setSessionId] = useState(() => storage.get(SESSION_KEY));
  const [messages, setMessages] = useState([GREETING]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const scrollerRef = useRef(null);
  const inputRef = useRef(null);
  const launcherRef = useRef(null);

  const isPhone = () => window.matchMedia("(max-width: 639px)").matches;

  useEffect(() => {
    if (scrollerRef.current) scrollerRef.current.scrollTop = scrollerRef.current.scrollHeight;
  }, [messages, open]);

  // Escape closes; focus moves into the panel on open and back to the
  // launcher on close; on phones the page behind the sheet can't scroll.
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === "Escape") close(); };
    document.addEventListener("keydown", onKey);
    // Don't pop the keyboard over the conversation on phones.
    if (!isPhone()) setTimeout(() => inputRef.current?.focus(), 50);
    const prev = document.body.style.overflow;
    if (isPhone()) document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const close = useCallback(() => {
    setOpen(false);
    setTimeout(() => launcherRef.current?.focus(), 0);
  }, []);

  const replaceLast = (content) =>
    setMessages((m) => {
      const next = [...m];
      next[next.length - 1] = { role: "assistant", content };
      return next;
    });

  const send = async (raw) => {
    const text = (raw ?? input).trim();
    if (!text || busy) return;
    setInput("");
    setMessages((m) => [...m, { role: "user", content: text }, { role: "assistant", content: "" }]);
    setBusy(true);

    try {
      const res = await fetch(STREAM_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session_id: sessionId, message: text }),
      });

      // A rate-limit or validation error comes back as JSON, not a stream.
      // Previously this fell through and left an empty bubble.
      if (!res.ok) {
        if (res.status === 429) {
          replaceLast("You're sending messages quite quickly — please give it a few minutes and try again.");
        } else {
          let detail = "";
          try { detail = (await res.json())?.detail; } catch { /* not JSON */ }
          replaceLast(typeof detail === "string" && detail ? detail : "Sorry, I hit a snag. Please try again.");
        }
        return;
      }
      if (!res.body) throw new Error("No stream body");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let received = false;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const events = buffer.split("\n\n");
        buffer = events.pop() || "";
        for (const evt of events) {
          const lines = evt.split("\n");
          const eventType = lines.find((l) => l.startsWith("event: "))?.slice(7);
          const dataLine = lines.find((l) => l.startsWith("data: "))?.slice(6) || "";
          if (eventType === "session") {
            setSessionId(dataLine);
            storage.set(SESSION_KEY, dataLine);
          } else if (eventType === "delta") {
            received = true;
            const chunk = dataLine.replace(/\\n/g, "\n");
            setMessages((m) => {
              const next = [...m];
              next[next.length - 1] = { role: "assistant", content: next[next.length - 1].content + chunk };
              return next;
            });
          } else if (eventType === "error") {
            received = true;
            replaceLast("Sorry, I hit a snag. Please try again.");
          }
        }
      }
      if (!received) replaceLast("I didn't get a reply that time — please try again.");
    } catch (e) {
      replaceLast("Connection issue — please check your network and retry.");
    } finally {
      setBusy(false);
    }
  };

  const reset = () => {
    storage.del(SESSION_KEY);
    setSessionId(null);
    setMessages([GREETING]);
    setInput("");
  };

  const showStarters = messages.length === 1 && !busy;

  return (
    <>
      {/* Launcher. Hidden on phones while the full-screen sheet is open,
          where the sheet's own close button takes over. */}
      <button
        ref={launcherRef}
        data-testid="chat-widget-toggle"
        onClick={() => (open ? close() : setOpen(true))}
        className={`fixed right-5 z-[60] w-14 h-14 rounded-full shadow-2xl flex items-center justify-center transition-all duration-300 ${
          open ? "bg-navy-950 text-[var(--off-white)] max-sm:hidden" : "bg-gold text-[var(--navy-950)] hover:scale-105"
        }`}
        style={{ bottom: "calc(1.25rem + env(safe-area-inset-bottom))" }}
        aria-label={open ? "Close chat" : "Chat with Aria"}
        aria-expanded={open}
        aria-controls="aria-chat"
      >
        {open ? <X size={22} weight="bold" /> : <ChatTeardropDots size={24} weight="fill" />}
      </button>

      {open && (
        <div
          id="aria-chat"
          role="dialog"
          aria-label="Chat with Aria"
          data-testid="chat-widget-panel"
          className={[
            "fixed z-[60] flex flex-col bg-white shadow-2xl overflow-hidden",
            // Phone: full-screen sheet. dvh tracks the visible viewport as
            // Safari's toolbars and the keyboard come and go.
            "inset-0 h-[100dvh]",
            // Larger screens: floating panel above the launcher, capped so its
            // top can never go off-screen (the old fixed 520px + 176px offset
            // did, on any laptop-height window).
            "sm:inset-auto sm:right-5 sm:bottom-24 sm:w-[380px] sm:h-[min(600px,calc(100dvh-8rem))] sm:border sm:border-[var(--line)]",
          ].join(" ")}
        >
          <div
            className="px-4 py-3 bg-navy-950 text-[var(--off-white)] flex items-center gap-3 shrink-0"
            style={{ paddingTop: "max(0.75rem, env(safe-area-inset-top))" }}
          >
            <div className="w-9 h-9 rounded-full bg-gold text-[var(--navy-950)] flex items-center justify-center shrink-0">
              <Sparkle size={18} weight="fill" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold">Aria</div>
              <div className="text-[10px] font-mono uppercase tracking-wider on-dark-muted truncate">Synferrous assistant</div>
            </div>
            {messages.length > 1 && (
              <button onClick={reset} disabled={busy} title="Start a new conversation" aria-label="Start a new conversation"
                className="w-10 h-10 flex items-center justify-center on-dark-muted hover:text-[var(--gold)] disabled:opacity-40">
                <ArrowCounterClockwise size={18} />
              </button>
            )}
            <button onClick={close} aria-label="Close chat" data-testid="chat-close"
              className="w-10 h-10 -mr-1 flex items-center justify-center on-dark-muted hover:text-[var(--gold)]">
              <X size={20} weight="bold" />
            </button>
          </div>

          <div ref={scrollerRef} className="flex-1 overflow-y-auto overscroll-contain px-4 py-4 space-y-3 bg-[var(--paper-surface)]"
            aria-live="polite">
            {messages.map((m, i) => {
              const pending = busy && i === messages.length - 1 && !m.content;
              return (
                <div key={i} data-testid={`chat-msg-${m.role}-${i}`} className={m.role === "user" ? "iris-bubble-user" : "iris-bubble"}>
                  {pending ? (
                    <span className="inline-flex gap-1 py-1" aria-label="Aria is typing">
                      {[0, 1, 2].map((d) => (
                        <span key={d} className="w-1.5 h-1.5 rounded-full bg-current opacity-60 animate-bounce"
                          style={{ animationDelay: `${d * 120}ms` }} />
                      ))}
                    </span>
                  ) : m.role === "assistant" ? (
                    <div className="text-sm leading-relaxed"><ReactMarkdownLite text={m.content} /></div>
                  ) : (
                    <div className="text-sm whitespace-pre-wrap leading-relaxed">{m.content}</div>
                  )}
                </div>
              );
            })}

            {showStarters && (
              <div className="pt-2 space-y-2" data-testid="chat-starters">
                <div className="text-[10px] font-mono uppercase tracking-wider text-[var(--ink-soft)]">Try asking</div>
                {STARTERS.map((q) => (
                  <button key={q} onClick={() => send(q)}
                    className="block w-full text-left text-sm px-3.5 py-2.5 bg-white border border-[var(--line)] hover:border-[var(--gold)] transition-colors">
                    {q}
                  </button>
                ))}
              </div>
            )}
          </div>

          <form
            className="border-t border-[var(--line)] p-3 flex items-center gap-2 bg-white shrink-0"
            style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
            onSubmit={(e) => { e.preventDefault(); send(); }}
          >
            <input
              ref={inputRef}
              data-testid="chat-input"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask Aria anything…"
              aria-label="Message Aria"
              autoComplete="off"
              enterKeyHint="send"
              maxLength={4000}
              className="flex-1 min-w-0 bg-[var(--paper-surface)] border border-[var(--line)] px-3 py-2.5 text-sm focus:outline-none focus:border-[var(--navy-950)]"
              disabled={busy}
            />
            <button
              data-testid="chat-send"
              type="submit"
              disabled={busy || !input.trim()}
              className="w-11 h-11 shrink-0 bg-gold text-[var(--navy-950)] flex items-center justify-center disabled:bg-[var(--paper-muted)] disabled:text-[var(--ink-soft)] transition-colors"
              aria-label="Send"
            >
              <PaperPlaneRight size={18} weight="fill" />
            </button>
          </form>
        </div>
      )}
    </>
  );
}
