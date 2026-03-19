import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Send, Bot, User, Loader2, Sparkles,
  MessageSquare, Plus, ChevronLeft, Clock, Trash2,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import { supabase } from "@/integrations/supabase/client";
import { format, parseISO } from "date-fns";

type Msg          = { role: "user" | "assistant"; content: string };
type Conversation = { id: string; title: string; updated_at: string };

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/project-chat`;

interface Props { projectId: string; projectName: string }

export function ProjectChatTab({ projectId, projectName }: Props) {
  const [messages,      setMessages]      = useState<Msg[]>([]);
  const [input,         setInput]         = useState("");
  const [isLoading,     setIsLoading]     = useState(false);
  const [ready,         setReady]         = useState(false);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConvId,  setActiveConvId]  = useState<string | null>(null);
  const [showHistory,   setShowHistory]   = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef  = useRef<HTMLInputElement>(null);

  /* ── helpers ─────────────────────────────────────────────────── */

  const fetchConversations = useCallback(async (): Promise<Conversation[]> => {
    const { data, error } = await supabase
      .from("chat_conversations")
      .select("id, title, updated_at")
      .eq("project_id", projectId)
      .order("updated_at", { ascending: false })
      .limit(50);
    if (error) { console.error("fetchConversations:", error.message); return []; }
    return (data ?? []) as Conversation[];
  }, [projectId]);

  const fetchMessages = useCallback(async (convId: string): Promise<Msg[]> => {
    const { data, error } = await supabase
      .from("chat_messages")
      .select("role, content")
      .eq("conversation_id", convId)
      .order("created_at", { ascending: true })
      .limit(200);
    if (error) { console.error("fetchMessages:", error.message); return []; }
    return (data ?? []).map((m: any) => ({ role: m.role as "user" | "assistant", content: m.content }));
  }, []);

  /* ── init: load conversations + open the most recent one ─────── */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const convs = await fetchConversations();
      if (cancelled) return;
      setConversations(convs);
      if (convs.length > 0) {
        const msgs = await fetchMessages(convs[0].id);
        if (!cancelled) { setActiveConvId(convs[0].id); setMessages(msgs); }
      }
      if (!cancelled) setReady(true);
    })();
    return () => { cancelled = true; };
  }, [projectId, fetchConversations, fetchMessages]);

  /* ── auto-scroll ─────────────────────────────────────────────── */
  useEffect(() => {
    if (scrollRef.current)
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  /* ── select conversation from history panel ───────────────────── */
  const openConversation = useCallback(async (conv: Conversation) => {
    setReady(false);
    const msgs = await fetchMessages(conv.id);
    setActiveConvId(conv.id);
    setMessages(msgs);
    setShowHistory(false);
    setReady(true);
    setTimeout(() => inputRef.current?.focus(), 50);
  }, [fetchMessages]);

  /* ── new conversation ─────────────────────────────────────────── */
  const startNew = useCallback(() => {
    setActiveConvId(null);
    setMessages([]);
    setShowHistory(false);
    setTimeout(() => inputRef.current?.focus(), 50);
  }, []);

  /* ── send message ─────────────────────────────────────────────── */
  const send = useCallback(async () => {
    const text = input.trim();
    if (!text || isLoading) return;

    const userMsg: Msg = { role: "user", content: text };
    setInput("");
    const history = [...messages, userMsg];
    setMessages(history);
    setIsLoading(true);

    let assistantText = "";
    let resolvedConvId = activeConvId;

    const appendChunk = (chunk: string) => {
      assistantText += chunk;
      setMessages(prev => {
        const last = prev[prev.length - 1];
        if (last?.role === "assistant")
          return prev.map((m, i) => i === prev.length - 1 ? { ...m, content: assistantText } : m);
        return [...prev, { role: "assistant", content: assistantText }];
      });
    };

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const resp = await fetch(CHAT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token ?? import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
        body: JSON.stringify({
          messages: history,
          projectId,
          conversationId: resolvedConvId,
          saveUserMessage: true,
        }),
      });

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({ error: "Request failed" }));
        throw new Error(err.error || `Error ${resp.status}`);
      }

      // Capture new conversation id from header
      const headerConvId = resp.headers.get("X-Conversation-Id");
      if (headerConvId && !resolvedConvId) {
        resolvedConvId = headerConvId;
        setActiveConvId(headerConvId);
      }

      // Stream SSE
      const reader  = resp.body!.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      const processLine = (line: string) => {
        if (!line.startsWith("data: ")) return;
        const raw = line.slice(6).trim();
        if (raw === "[DONE]") return;
        try {
          const d = JSON.parse(raw);
          const c = d.choices?.[0]?.delta?.content;
          if (c) appendChunk(c);
        } catch { /* partial chunk */ }
      };
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        let nl: number;
        while ((nl = buf.indexOf("\n")) !== -1) {
          const line = buf.slice(0, nl).replace(/\r$/, "");
          buf = buf.slice(nl + 1);
          processLine(line);
        }
      }
      buf.split("\n").forEach(processLine);

      // Refresh sidebar
      const convs = await fetchConversations();
      setConversations(convs);
    } catch (e: any) {
      console.error("Chat error:", e);
      setMessages(prev => {
        if (prev[prev.length - 1]?.role === "assistant") return prev;
        return [...prev, { role: "assistant", content: `⚠️ ${e.message || "Something went wrong."}` }];
      });
    } finally {
      setIsLoading(false);
      inputRef.current?.focus();
    }
  }, [input, isLoading, messages, projectId, activeConvId, fetchConversations]);

  /* ── key handler ─────────────────────────────────────────────── */
  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
  };

  /* ── suggestions ─────────────────────────────────────────────── */
  const suggestions = [
    "What's the current project status?",
    "Which tasks are overdue?",
    "Summarize the last meeting",
    "What topics were discussed recently?",
  ];

  const isEmpty = ready && messages.length === 0;

  /* ── render ──────────────────────────────────────────────────── */
  return (
    <div className="flex h-[calc(100vh-220px)] pt-5 gap-0">

      {/* ── History Sidebar ────────────────────────────────────── */}
      {showHistory && (
        <div className="w-60 shrink-0 flex flex-col border-r border-border mr-3 pr-3">
          {/* header */}
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-semibold">Conversations</span>
            <button onClick={() => setShowHistory(false)}
              className="text-muted-foreground hover:text-foreground transition-colors p-0.5 rounded">
              <ChevronLeft className="h-4 w-4" />
            </button>
          </div>

          {/* new conversation button */}
          <button onClick={startNew}
            className="flex items-center gap-2 text-xs px-3 py-2 mb-2 rounded-lg border border-dashed border-border text-muted-foreground hover:border-accent hover:text-accent transition-colors">
            <Plus className="h-3 w-3" />
            New conversation
          </button>

          {/* list */}
          <div className="flex-1 overflow-auto space-y-1 min-h-0">
            {conversations.length === 0
              ? <p className="text-xs text-muted-foreground text-center py-6">No history yet</p>
              : conversations.map(conv => (
                  <button key={conv.id} onClick={() => openConversation(conv)}
                    className={`w-full text-left px-3 py-2.5 rounded-lg text-xs transition-colors ${
                      activeConvId === conv.id
                        ? "bg-accent/15 text-accent font-medium"
                        : "hover:bg-muted/60 text-muted-foreground hover:text-foreground"
                    }`}>
                    <div className="truncate font-medium leading-tight">{conv.title}</div>
                    <div className="flex items-center gap-1 mt-1 text-[10px] opacity-50">
                      <Clock className="h-2.5 w-2.5" />
                      {format(parseISO(conv.updated_at), "MMM d, HH:mm")}
                    </div>
                  </button>
                ))
            }
          </div>
        </div>
      )}

      {/* ── Chat panel ─────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0">

        {/* toolbar */}
        <div className="flex items-center gap-2 mb-3">
          <button onClick={() => setShowHistory(v => !v)}
            className={`flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border transition-colors ${
              showHistory
                ? "border-accent bg-accent/10 text-accent"
                : "border-border text-muted-foreground hover:text-foreground hover:bg-muted/50"
            }`}>
            <MessageSquare className="h-3.5 w-3.5" />
            {conversations.length > 0
              ? `${conversations.length} conversation${conversations.length !== 1 ? "s" : ""}`
              : "History"}
          </button>

          <button onClick={startNew}
            className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors">
            <Plus className="h-3.5 w-3.5" />
            New chat
          </button>
        </div>

        {/* messages */}
        <div ref={scrollRef} className="flex-1 overflow-auto space-y-4 pb-4 pr-1">
          {!ready ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : isEmpty ? (
            <div className="flex flex-col items-center justify-center h-full text-center px-4">
              <div className="h-14 w-14 rounded-2xl bg-accent/10 flex items-center justify-center mb-4">
                <Sparkles className="h-7 w-7 text-accent" />
              </div>
              <h3 className="text-base font-semibold mb-1">AI Project Assistant</h3>
              <p className="text-sm text-muted-foreground mb-6 max-w-md">
                Ask me about <span className="font-medium text-foreground">{projectName}</span> — tasks, meetings, blockers, team activity, and more.
              </p>
              <div className="flex flex-wrap gap-2 justify-center max-w-lg">
                {suggestions.map(s => (
                  <button key={s}
                    onClick={() => { setInput(s); setTimeout(() => inputRef.current?.focus(), 50); }}
                    className="text-xs px-3 py-2 rounded-lg border border-border bg-card hover:bg-muted/60 text-muted-foreground hover:text-foreground transition-colors">
                    {s}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((msg, i) => (
              <div key={i} className={`flex gap-3 ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                {msg.role === "assistant" && (
                  <div className="h-7 w-7 rounded-lg bg-accent/10 flex items-center justify-center shrink-0 mt-0.5">
                    <Bot className="h-4 w-4 text-accent" />
                  </div>
                )}
                <div className={`rounded-xl px-4 py-3 max-w-[80%] text-sm ${
                  msg.role === "user"
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted/60 text-foreground"
                }`}>
                  {msg.role === "assistant"
                    ? <div className="prose prose-sm dark:prose-invert max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
                        <ReactMarkdown>{msg.content}</ReactMarkdown>
                      </div>
                    : <p>{msg.content}</p>
                  }
                </div>
                {msg.role === "user" && (
                  <div className="h-7 w-7 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                    <User className="h-4 w-4 text-primary" />
                  </div>
                )}
              </div>
            ))
          )}

          {isLoading && messages[messages.length - 1]?.role !== "assistant" && (
            <div className="flex gap-3">
              <div className="h-7 w-7 rounded-lg bg-accent/10 flex items-center justify-center shrink-0">
                <Bot className="h-4 w-4 text-accent" />
              </div>
              <div className="bg-muted/60 rounded-xl px-4 py-3 flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Thinking…</span>
              </div>
            </div>
          )}
        </div>

        {/* input */}
        <div className="border-t border-border pt-3">
          <div className="flex gap-2">
            <Input
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder="Ask about this project…"
              disabled={isLoading}
              className="flex-1 h-10 rounded-xl"
            />
            <Button
              onClick={send}
              size="icon"
              disabled={!input.trim() || isLoading}
              className="h-10 w-10 rounded-xl bg-accent hover:bg-accent/90 text-accent-foreground shrink-0">
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
