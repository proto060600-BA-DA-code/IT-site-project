import { useState, useRef, useEffect } from "react";
import { ChatTeardropDots, PaperPlaneRight, X, Sparkle } from "@phosphor-icons/react";
import { STREAM_URL } from "@/lib/api";

export default function ChatWidget() {
  const [open, setOpen] = useState(false);
  const [sessionId, setSessionId] = useState(() => localStorage.getItem("iris_session") || null);
  const [messages, setMessages] = useState([
    { role: "assistant", content: "Hi, I'm Aria — the AscendAI assistant. Ask me about business analysis, building an AI product, automating a process, or just tell me what you're trying to solve." },
  ]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const scrollerRef = useRef(null);

  useEffect(() => {
    if (scrollerRef.current) {
      scrollerRef.current.scrollTop = scrollerRef.current.scrollHeight;
    }
  }, [messages, open]);

  const send = async () => {
    const text = input.trim();
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
      if (!res.body) throw new Error("No stream body");
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
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
            localStorage.setItem("iris_session", dataLine);
          } else if (eventType === "delta") {
            const chunk = dataLine.replace(/\\n/g, "\n");
            setMessages((m) => {
              const next = [...m];
              next[next.length - 1] = { role: "assistant", content: next[next.length - 1].content + chunk };
              return next;
            });
          } else if (eventType === "error") {
            setMessages((m) => {
              const next = [...m];
              next[next.length - 1] = { role: "assistant", content: "Sorry, I hit a snag. Please try again." };
              return next;
            });
          }
        }
      }
    } catch (e) {
      setMessages((m) => {
        const next = [...m];
        next[next.length - 1] = { role: "assistant", content: "Connection issue — please retry." };
        return next;
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <button
        data-testid="chat-widget-toggle"
        onClick={() => setOpen(!open)}
        className={`fixed bottom-24 right-6 z-[60] w-14 h-14 rounded-full shadow-2xl flex items-center justify-center transition-all duration-300 ${
          open ? "bg-[var(--brand-teal)] text-white" : "bg-[var(--brand-amber-light)] text-[var(--ink)] hover:scale-105"
        }`}
        aria-label="Chat with Aria"
      >
        {open ? <X size={22} weight="bold" /> : <ChatTeardropDots size={24} weight="fill" />}
      </button>

      {open && (
        <div
          data-testid="chat-widget-panel"
          className="fixed bottom-44 right-6 z-[60] w-[360px] max-w-[calc(100vw-3rem)] h-[520px] bg-white border border-[var(--line)] shadow-2xl flex flex-col"
        >
          <div className="px-4 py-3 bg-[var(--brand-teal)] text-white flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-[var(--brand-amber-light)] text-[var(--brand-teal)] flex items-center justify-center">
              <Sparkle size={18} weight="fill" />
            </div>
            <div className="flex-1">
              <div className="text-sm font-semibold">Aria</div>
              <div className="text-[10px] font-mono uppercase tracking-wider text-white/70">AscendAI Assistant · Online</div>
            </div>
          </div>

          <div ref={scrollerRef} className="flex-1 overflow-y-auto no-scrollbar px-4 py-4 space-y-3 bg-[var(--paper-surface)]">
            {messages.map((m, i) => (
              <div key={i} data-testid={`chat-msg-${m.role}-${i}`} className={m.role === "user" ? "iris-bubble-user" : "iris-bubble"}>
                <div className="text-sm whitespace-pre-wrap leading-relaxed">{m.content || (busy && i === messages.length - 1 ? "…" : "")}</div>
              </div>
            ))}
          </div>

          <form
            className="border-t border-[var(--line)] p-3 flex items-center gap-2 bg-white"
            onSubmit={(e) => { e.preventDefault(); send(); }}
          >
            <input
              data-testid="chat-input"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask Aria anything…"
              className="flex-1 bg-[var(--paper-surface)] border border-[var(--line)] px-3 py-2 text-sm focus:outline-none focus:border-[var(--brand-teal)]"
              disabled={busy}
            />
            <button
              data-testid="chat-send"
              type="submit"
              disabled={busy || !input.trim()}
              className="w-10 h-10 bg-[var(--brand-teal)] text-white flex items-center justify-center disabled:opacity-40"
              aria-label="Send"
            >
              <PaperPlaneRight size={16} weight="fill" />
            </button>
          </form>
        </div>
      )}
    </>
  );
}
