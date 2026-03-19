import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sparkles, Send, Bot, User, Loader2, X, Minimize2, Maximize2 } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "react-router-dom";

type Msg = { role: "user" | "assistant"; content: string };

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/project-chat`;

function useCurrentProjectId(): string | null {
  const location = useLocation();
  const match = location.pathname.match(/\/projects\/([^/]+)/);
  return match ? match[1] : null;
}

function useCurrentProjectName(projectId: string | null) {
  return useQuery({
    queryKey: ["project-name", projectId],
    enabled: !!projectId,
    queryFn: async () => {
      if (!projectId) return null;
      const { data } = await supabase.from("projects").select("name").eq("id", projectId).single();
      return data?.name ?? "Project";
    },
  });
}

function useChatHistory(projectId: string | null) {
  return useQuery({
    queryKey: ["chat-history", projectId],
    enabled: !!projectId,
    queryFn: async (): Promise<Msg[]> => {
      if (!projectId) return [];
      const { data, error } = await supabase
        .from("chat_messages")
        .select("role, content")
        .eq("project_id", projectId)
        .order("created_at", { ascending: true })
        .limit(50);
      if (error) throw error;
      return (data ?? []).map((m: any) => ({ role: m.role as "user" | "assistant", content: m.content }));
    },
  });
}

export function FloatingChatWidget() {
  const { isAdmin } = useAuth();
  const projectId = useCurrentProjectId();
  const { data: projectName } = useCurrentProjectName(projectId);
  const { data: history } = useChatHistory(projectId);

  const [isOpen, setIsOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [loadedProjectId, setLoadedProjectId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Load history when project changes
  useEffect(() => {
    if (projectId && history && projectId !== loadedProjectId) {
      setMessages(history);
      setLoadedProjectId(projectId);
    }
  }, [projectId, history, loadedProjectId]);

  // Reset when project changes
  useEffect(() => {
    if (projectId !== loadedProjectId) {
      setMessages([]);
    }
  }, [projectId, loadedProjectId]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    if (isOpen && inputRef.current) inputRef.current.focus();
  }, [isOpen]);

  const send = useCallback(async () => {
    const text = input.trim();
    if (!text || isLoading || !projectId) return;

    const userMsg: Msg = { role: "user", content: text };
    setInput("");
    setMessages(prev => [...prev, userMsg]);
    setIsLoading(true);

    let assistantSoFar = "";

    const upsertAssistant = (chunk: string) => {
      assistantSoFar += chunk;
      setMessages(prev => {
        const last = prev[prev.length - 1];
        if (last?.role === "assistant") {
          return prev.map((m, i) => (i === prev.length - 1 ? { ...m, content: assistantSoFar } : m));
        }
        return [...prev, { role: "assistant", content: assistantSoFar }];
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
          messages: [...messages, userMsg],
          projectId,
          saveUserMessage: true,
        }),
      });

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({ error: "Request failed" }));
        throw new Error(err.error || `Error ${resp.status}`);
      }

      if (!resp.body) throw new Error("No response stream");

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let textBuffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        textBuffer += decoder.decode(value, { stream: true });

        let newlineIndex: number;
        while ((newlineIndex = textBuffer.indexOf("\n")) !== -1) {
          let line = textBuffer.slice(0, newlineIndex);
          textBuffer = textBuffer.slice(newlineIndex + 1);

          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (line.startsWith(":") || line.trim() === "") continue;
          if (!line.startsWith("data: ")) continue;

          const jsonStr = line.slice(6).trim();
          if (jsonStr === "[DONE]") break;

          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) upsertAssistant(content);
          } catch {
            textBuffer = line + "\n" + textBuffer;
            break;
          }
        }
      }

      // Flush remaining
      if (textBuffer.trim()) {
        for (let raw of textBuffer.split("\n")) {
          if (!raw) continue;
          if (raw.endsWith("\r")) raw = raw.slice(0, -1);
          if (raw.startsWith(":") || raw.trim() === "") continue;
          if (!raw.startsWith("data: ")) continue;
          const jsonStr = raw.slice(6).trim();
          if (jsonStr === "[DONE]") continue;
          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) upsertAssistant(content);
          } catch { /* ignore */ }
        }
      }
    } catch (e: any) {
      console.error("Chat error:", e);
      setMessages(prev => [
        ...prev,
        ...(prev[prev.length - 1]?.role === "assistant"
          ? []
          : [{ role: "assistant" as const, content: `⚠️ ${e.message || "Something went wrong."}` }]),
      ]);
    } finally {
      setIsLoading(false);
      inputRef.current?.focus();
    }
  }, [input, isLoading, messages, projectId]);

  // Only show for admins when on a project page
  if (!isAdmin || !projectId) return null;

  const suggestions = [
    "What's the project status?",
    "Any overdue tasks?",
    "Show blocked items",
    "Summarize activity",
  ];

  const panelWidth = isExpanded ? "w-[560px]" : "w-[380px]";
  const panelHeight = isExpanded ? "h-[600px]" : "h-[480px]";

  return (
    <>
      {/* Chat Panel */}
      {isOpen && (
        <div className={`fixed bottom-20 right-5 z-50 ${panelWidth} ${panelHeight} bg-card border border-border rounded-2xl shadow-2xl flex flex-col overflow-hidden transition-all duration-200`}>
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-card shrink-0">
            <div className="flex items-center gap-2">
              <div className="h-7 w-7 rounded-lg bg-accent/10 flex items-center justify-center">
                <Sparkles className="h-4 w-4 text-accent" />
              </div>
              <div>
                <p className="text-sm font-semibold leading-tight">AI Assistant</p>
                <p className="text-[10px] text-muted-foreground leading-tight">{projectName ?? "Project"}</p>
              </div>
            </div>
            <div className="flex items-center gap-0.5">
              <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground" onClick={() => setIsExpanded(!isExpanded)}>
                {isExpanded ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
              </Button>
              <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground" onClick={() => setIsOpen(false)}>
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>

          {/* Messages */}
          <div ref={scrollRef} className="flex-1 overflow-auto px-4 py-3 space-y-3">
            {messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center">
                <div className="h-12 w-12 rounded-2xl bg-accent/10 flex items-center justify-center mb-3">
                  <Sparkles className="h-6 w-6 text-accent" />
                </div>
                <p className="text-sm font-medium mb-1">How can I help?</p>
                <p className="text-xs text-muted-foreground mb-4 max-w-[240px]">
                  Ask about <span className="font-medium text-foreground">{projectName}</span> — tasks, blockers, status, and more.
                </p>
                <div className="flex flex-wrap gap-1.5 justify-center">
                  {suggestions.map(s => (
                    <button
                      key={s}
                      onClick={() => setInput(s)}
                      className="text-[11px] px-2.5 py-1.5 rounded-lg border border-border bg-card hover:bg-muted/60 text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              messages.map((msg, i) => (
                <div key={i} className={`flex gap-2 ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                  {msg.role === "assistant" && (
                    <div className="h-6 w-6 rounded-md bg-accent/10 flex items-center justify-center shrink-0 mt-0.5">
                      <Bot className="h-3.5 w-3.5 text-accent" />
                    </div>
                  )}
                  <div
                    className={`rounded-xl px-3 py-2 max-w-[85%] text-[13px] leading-relaxed ${
                      msg.role === "user"
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted/60 text-foreground"
                    }`}
                  >
                    {msg.role === "assistant" ? (
                      <div className="prose prose-sm dark:prose-invert max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0 text-[13px]">
                        <ReactMarkdown>{msg.content}</ReactMarkdown>
                      </div>
                    ) : (
                      <p>{msg.content}</p>
                    )}
                  </div>
                  {msg.role === "user" && (
                    <div className="h-6 w-6 rounded-md bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                      <User className="h-3.5 w-3.5 text-primary" />
                    </div>
                  )}
                </div>
              ))
            )}
            {isLoading && messages[messages.length - 1]?.role !== "assistant" && (
              <div className="flex gap-2">
                <div className="h-6 w-6 rounded-md bg-accent/10 flex items-center justify-center shrink-0">
                  <Bot className="h-3.5 w-3.5 text-accent" />
                </div>
                <div className="bg-muted/60 rounded-xl px-3 py-2 flex items-center gap-2">
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">Thinking…</span>
                </div>
              </div>
            )}
          </div>

          {/* Input */}
          <div className="border-t border-border px-3 py-2.5 shrink-0">
            <form onSubmit={e => { e.preventDefault(); send(); }} className="flex gap-2">
              <Input
                ref={inputRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                placeholder="Ask about this project…"
                disabled={isLoading}
                className="flex-1 h-9 rounded-lg text-sm"
              />
              <Button
                type="submit"
                size="icon"
                disabled={!input.trim() || isLoading}
                className="h-9 w-9 rounded-lg bg-accent hover:bg-accent/90 text-accent-foreground shrink-0"
              >
                <Send className="h-3.5 w-3.5" />
              </Button>
            </form>
          </div>
        </div>
      )}

      {/* Floating Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-5 right-5 z-50 h-12 w-12 rounded-full bg-accent text-accent-foreground shadow-lg hover:shadow-xl hover:scale-105 transition-all flex items-center justify-center"
      >
        {isOpen ? (
          <X className="h-5 w-5" />
        ) : (
          <Sparkles className="h-5 w-5" />
        )}
      </button>
    </>
  );
}
