import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const { taskIds, type, userId, projectId } = await req.json();

    if (type === "team_added") {
      // Notify user they were added to a project
      const { data: profile } = await supabase
        .from("profiles")
        .select("email, full_name")
        .eq("id", userId)
        .single();

      const { data: project } = await supabase
        .from("projects")
        .select("name")
        .eq("id", projectId)
        .single();

      console.log(`[send-task-notification] Team add notification: ${profile?.email} added to ${project?.name}`);

      return new Response(
        JSON.stringify({ success: true, message: `Notification logged for ${profile?.email}` }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!taskIds || !Array.isArray(taskIds) || taskIds.length === 0) {
      return new Response(
        JSON.stringify({ error: "taskIds array required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: tasks } = await supabase
      .from("tasks")
      .select("*, meetings(title)")
      .in("id", taskIds);

    if (!tasks || tasks.length === 0) {
      return new Response(
        JSON.stringify({ error: "No tasks found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Gather recipient emails
    const userIds = [...new Set(tasks.map((t: any) => t.assignee_user_id).filter(Boolean))];
    const { data: profiles } = userIds.length > 0
      ? await supabase.from("profiles").select("id, email, full_name").in("id", userIds)
      : { data: [] };

    const profileMap = new Map((profiles ?? []).map((p: any) => [p.id, p]));

    if (type === "summary") {
      // Log summary email for all unique assignees
      const recipients = [...new Set(tasks.map((t: any) => {
        const p = profileMap.get(t.assignee_user_id);
        return p?.email;
      }).filter(Boolean))];

      console.log(`[send-task-notification] Summary email for ${tasks.length} tasks to: ${recipients.join(", ")}`);
      console.log(`[send-task-notification] Tasks: ${tasks.map((t: any) => t.description).join("; ")}`);

      return new Response(
        JSON.stringify({ success: true, message: `Summary logged for ${recipients.length} recipients`, recipients }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Single task detail email
    const task = tasks[0];
    const recipient = profileMap.get(task.assignee_user_id);

    console.log(`[send-task-notification] Task email: "${task.description}" to ${recipient?.email ?? "no email"}`);

    return new Response(
      JSON.stringify({ success: true, message: `Notification logged for ${recipient?.email ?? "unknown"}` }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[send-task-notification] Error:", error);
    return new Response(
      JSON.stringify({ error: String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
