import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const authHeader = req.headers.get("Authorization");
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader ?? "" } },
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { messages, projectId, saveUserMessage } = await req.json();

    if (!projectId) {
      return new Response(JSON.stringify({ error: "projectId is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const serviceClient = createClient(
      supabaseUrl,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Persist user message if flagged
    if (saveUserMessage && messages.length > 0) {
      const lastUserMsg = messages[messages.length - 1];
      if (lastUserMsg.role === "user") {
        await serviceClient.from("chat_messages").insert({
          project_id: projectId,
          user_id: user.id,
          role: "user",
          content: lastUserMsg.content,
        });
      }
    }

    // Fetch project context
    const [
      { data: project },
      { data: tasks },
      { data: members },
      { data: meetings },
    ] = await Promise.all([
      serviceClient.from("projects").select("*").eq("id", projectId).single(),
      serviceClient.from("tasks").select("*").eq("project_id", projectId).order("created_at", { ascending: false }).limit(50),
      serviceClient
        .from("project_members")
        .select("*, profiles:user_id(full_name, email)")
        .eq("project_id", projectId),
      serviceClient.from("meetings").select("id, title, date, general_summary").eq("project_id", projectId).order("date", { ascending: false }).limit(10),
    ]);

    const tasksList = (tasks ?? []);
    const tasksByStatus = {
      OPEN: tasksList.filter((t: any) => t.status === "OPEN").length,
      IN_PROGRESS: tasksList.filter((t: any) => t.status === "IN_PROGRESS").length,
      BLOCKED: tasksList.filter((t: any) => t.status === "BLOCKED").length,
      COMPLETED: tasksList.filter((t: any) => t.status === "COMPLETED").length,
    };

    const overdueTasks = tasksList.filter(
      (t: any) => t.status !== "COMPLETED" && t.due_date && new Date(t.due_date) < new Date()
    );

    const memberNames = (members ?? []).map((m: any) => {
      const profile = m.profiles;
      return profile?.full_name || profile?.email || "Unknown";
    });

    const projectContext = `
## Current Project Context

**Project:** ${project?.name ?? "Unknown"}
**Description:** ${project?.description || "No description"}
**Status:** ${project?.status ?? "unknown"}

### Task Summary (${tasksList.length} total)
- Open: ${tasksByStatus.OPEN}
- In Progress: ${tasksByStatus.IN_PROGRESS}
- Blocked: ${tasksByStatus.BLOCKED}
- Completed: ${tasksByStatus.COMPLETED}

${overdueTasks.length > 0 ? `### ⚠️ Overdue Tasks (${overdueTasks.length})
${overdueTasks.map((t: any) => `- "${t.description}" (assigned to ${t.assignee_name}, due ${t.due_date})`).join("\n")}` : "### ✅ No overdue tasks"}

### Recent Tasks
${tasksList.slice(0, 15).map((t: any) => `- [${t.status}] "${t.description}" — ${t.assignee_name}${t.due_date ? ` (due: ${t.due_date})` : ""} [Priority: ${t.priority}]`).join("\n")}

### Team Members (${memberNames.length})
${memberNames.join(", ") || "No members yet"}

### Recent Meetings (${(meetings ?? []).length})
${(meetings ?? []).slice(0, 5).map((m: any) => `- "${m.title}" (${m.date})${m.general_summary ? ` — ${m.general_summary.slice(0, 100)}...` : ""}`).join("\n") || "No meetings yet"}
`.trim();

    const systemPrompt = `You are a project management AI assistant for the project "${project?.name ?? "Unknown"}". You help admins understand project status, track tasks, identify blockers, and provide actionable insights.

You have access to real-time project data provided below. Use it to answer questions accurately. Be concise, professional, and proactive about flagging issues.

When discussing tasks, mention specific names, due dates, and statuses. If there are overdue or blocked items, highlight them. Provide recommendations when asked.

Format your responses using markdown for readability — use headers, bullet points, and bold text where appropriate.

${projectContext}`;

    // Call AI gateway with streaming
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          ...messages,
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Please add credits in Settings → Workspace → Usage." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      return new Response(JSON.stringify({ error: "AI service unavailable" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Stream the response but also collect to persist assistant message
    const reader = response.body!.getReader();
    let fullContent = "";

    const stream = new ReadableStream({
      async pull(controller) {
        const { done, value } = await reader.read();
        if (done) {
          // Persist assistant response
          if (fullContent.trim()) {
            await serviceClient.from("chat_messages").insert({
              project_id: projectId,
              user_id: user.id,
              role: "assistant",
              content: fullContent,
            });
          }
          controller.close();
          return;
        }

        // Collect content for persistence
        const text = new TextDecoder().decode(value);
        for (const line of text.split("\n")) {
          if (!line.startsWith("data: ") || line.includes("[DONE]")) continue;
          try {
            const parsed = JSON.parse(line.slice(6));
            const delta = parsed.choices?.[0]?.delta?.content;
            if (delta) fullContent += delta;
          } catch {}
        }

        controller.enqueue(value);
      },
    });

    return new Response(stream, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("project-chat error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
