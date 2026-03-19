import { createClient } from "https://esm.sh/@supabase/supabase-js@2.98.0";
import { encodeBase64 } from "https://deno.land/std@0.224.0/encoding/base64.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// ─── Plaud format detection ───────────────────────────────────────────────────

function isPlaudFormat(text: string): boolean {
  return (
    text.includes("## Summary") &&
    (text.includes("## Transcript") || text.includes("## Action Items"))
  );
}

interface PlaudParsed {
  title: string;
  date: string;
  general_summary: string;
  raw_transcript: string;
  topics: Array<{ title: string; notes: string[] }>;
  participants: string[];
  action_items: Array<{ description: string; assignee: string; priority: string }>;
}

function parsePlaudExport(text: string, fileName: string): PlaudParsed {
  // Title: H1 heading or cleaned filename
  const titleMatch = text.match(/^#\s+(.+)$/m);
  const title =
    titleMatch?.[1]?.trim() ||
    fileName.replace(/\.(txt|md|docx)$/i, "").replace(/[-_]/g, " ") ||
    "Plaud Note";

  // Date field
  const dateMatch = text.match(/^Date:\s*(.+)$/m);
  let date = new Date().toISOString();
  if (dateMatch?.[1]) {
    const parsed = new Date(dateMatch[1].trim());
    if (!isNaN(parsed.getTime())) date = parsed.toISOString();
  }

  // Sections: match from header to the next ## or end of string
  const sectionRe = (name: string) =>
    new RegExp(`^## ${name}\\s*\\n([\\s\\S]*?)(?=\\n## |\\s*$)`, "m");

  const summaryMatch = text.match(sectionRe("Summary"));
  const general_summary = summaryMatch?.[1]?.trim() ?? "";

  const transcriptMatch = text.match(sectionRe("Transcript"));
  const raw_transcript = transcriptMatch?.[1]?.trim() ?? "";

  const actionMatch = text.match(sectionRe("Action Items"));
  const actionText = actionMatch?.[1]?.trim() ?? "";

  // Action items: "- description (@Assignee Name)"
  const action_items: PlaudParsed["action_items"] = [];
  for (const line of actionText.split("\n")) {
    const clean = line.replace(/^[-*•]\s*/, "").trim();
    if (!clean) continue;
    const assigneeMatch = clean.match(/@([\w\u00C0-\u024F][\w\u00C0-\u024F\s]{0,39}?)(?:\s*$|\s+[-–(])/);
    const assignee = assigneeMatch?.[1]?.trim() ?? "Unassigned";
    const description = clean.replace(/@[\w\u00C0-\u024F][\w\u00C0-\u024F\s]{0,39}/, "").trim();
    if (description) {
      action_items.push({ description, assignee, priority: "MEDIUM" });
    }
  }

  // Participants: speaker names from "Name HH:MM:SS" transcript lines
  const participants = new Set<string>();
  for (const line of raw_transcript.split("\n")) {
    const speakerMatch = line.match(
      /^([A-Za-z\u00C0-\u024F][A-Za-z\u00C0-\u024F\s]{1,40}?)\s+\d{1,2}:\d{2}:\d{2}/
    );
    if (speakerMatch) participants.add(speakerMatch[1].trim());
  }

  const topics = general_summary
    ? [{ title: "Summary", notes: general_summary.split("\n").filter((l) => l.trim()) }]
    : [];

  return {
    title,
    date,
    general_summary,
    raw_transcript,
    topics,
    participants: [...participants],
    action_items,
  };
}

// ─── Main handler ─────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  // Verify caller
  const authHeader = req.headers.get("authorization") ?? "";
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
  if (authError || !user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

  const { file_path, file_name, source_hint } = await req.json();
  if (!file_path) {
    return new Response(JSON.stringify({ error: "file_path is required" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Create import record — use source_hint if provided (e.g. 'plaud')
  const initialSourceType = source_hint ?? "file_upload";
  const { data: importRecord, error: impErr } = await supabase
    .from("imports")
    .insert({
      source_type: initialSourceType,
      file_name: file_name ?? file_path,
      status: "processing",
      created_by: user.id,
    })
    .select()
    .single();

  if (impErr) {
    return new Response(JSON.stringify({ error: impErr.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    // Download file from storage
    const { data: fileData, error: dlErr } = await supabase.storage
      .from("meeting-uploads")
      .download(file_path);

    if (dlErr || !fileData) {
      throw new Error(`Failed to download file: ${dlErr?.message}`);
    }

    // Extract text based on file type
    const contentType = fileData.type;
    const lowerName = (file_name ?? file_path).toLowerCase();
    let extractedText = "";

    const arrayBuf = await fileData.arrayBuffer();
    const bytes = new Uint8Array(arrayBuf);

    const isBinaryFile =
      contentType.startsWith("image/") ||
      contentType === "application/pdf" ||
      lowerName.endsWith(".pdf") ||
      lowerName.endsWith(".docx") ||
      lowerName.endsWith(".pptx") ||
      lowerName.endsWith(".xlsx") ||
      lowerName.endsWith(".doc") ||
      lowerName.endsWith(".rtf") ||
      contentType.includes("officedocument") ||
      contentType === "application/rtf" ||
      contentType === "application/msword";

    if (isBinaryFile) {
      if (!OPENAI_API_KEY && !LOVABLE_API_KEY) {
        throw new Error("No AI API key configured.");
      }
      const b64 = encodeBase64(bytes);
      const mime = contentType || "application/octet-stream";
      const dataUrl = `data:${mime};base64,${b64}`;
      console.log("Sending binary file to AI vision, mime:", mime, "size:", bytes.length);
      extractedText = await callAI(
        [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "Extract ALL text content from this document. Return only the extracted text, preserving structure like headings, bullet points, and paragraphs. Include all languages present in the document. Nothing else.",
              },
              { type: "image_url", image_url: { url: dataUrl } },
            ],
          },
        ],
        OPENAI_API_KEY,
        LOVABLE_API_KEY,
        "google/gemini-2.5-flash"
      );
    } else {
      extractedText = new TextDecoder().decode(bytes);
    }

    console.log("Extracted text length:", extractedText.trim().length);
    console.log("Extracted text preview:", extractedText.substring(0, 300));

    if (!extractedText || extractedText.trim().length < 20) {
      throw new Error("Could not extract meaningful text from the uploaded file.");
    }

    // ── Detect Plaud format ──────────────────────────────────────────────────
    const plaudDetected = isPlaudFormat(extractedText) || source_hint === "plaud";
    const meetingSource = plaudDetected ? "plaud" : "file_upload";

    let meetingData: {
      title: string;
      date: string | null;
      general_summary: string;
      raw_transcript?: string;
      topics: Array<{ title: string; notes: string[] }>;
      participants: string[];
      action_items: Array<{ description: string; assignee: string; priority: string }>;
    };

    if (plaudDetected) {
      // ── Plaud parser (no AI needed) ────────────────────────────────────────
      console.log("Plaud format detected — using structured parser");
      meetingData = parsePlaudExport(extractedText, file_name ?? file_path);
    } else {
      // ── Generic AI parser ──────────────────────────────────────────────────
      if (!OPENAI_API_KEY && !LOVABLE_API_KEY) {
        throw new Error("No AI API key configured.");
      }
      const parsePrompt = `You are a meeting transcript parser that works with any language. Analyze the following text and extract structured meeting data. Write the summary, topics, and action items in the SAME LANGUAGE as the original text. Return ONLY valid JSON (no markdown, no code fences, no backticks), with this exact schema:
{
  "title": "string - meeting title or best guess",
  "date": "ISO date string or null",
  "general_summary": "string - 2-3 sentence overview in the original language",
  "topics": [{"title": "string", "notes": ["bullet point strings"]}],
  "participants": ["name strings"],
  "action_items": [{"description": "string", "assignee": "string or Unassigned", "priority": "LOW|MEDIUM|HIGH|CRITICAL"}]
}

Text to parse:
${extractedText.substring(0, 15000)}`;

      const parsed = await callAI(
        [{ role: "user", content: parsePrompt }],
        OPENAI_API_KEY,
        LOVABLE_API_KEY,
        "google/gemini-2.5-flash"
      );

      console.log("AI parse response preview:", parsed.substring(0, 300));

      let jsonStr = parsed;
      jsonStr = jsonStr.replace(/```(?:json)?\s*/g, "").replace(/```\s*/g, "");
      const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error("AI did not return valid JSON");
      meetingData = JSON.parse(jsonMatch[0]);
    }

    // ── Insert meeting ───────────────────────────────────────────────────────
    const { data: meeting, error: mErr } = await supabase
      .from("meetings")
      .insert({
        title: meetingData.title || file_name || "Uploaded Meeting",
        date: meetingData.date || new Date().toISOString(),
        general_summary: meetingData.general_summary || "",
        source: meetingSource,
        raw_transcript: (meetingData.raw_transcript ?? extractedText).substring(0, 50000),
        import_id: importRecord.id,
        created_by: user.id,
      })
      .select()
      .single();

    if (mErr || !meeting) throw new Error(mErr?.message ?? "Insert failed");

    let tasksCreated = 0;

    // Fetch all profiles for auto-matching
    const { data: allProfiles } = await supabase.from("profiles").select("id, full_name, email");
    const profilesMap = new Map<string, { id: string; full_name: string; email: string }>();
    for (const p of allProfiles ?? []) {
      if (p.full_name) profilesMap.set(p.full_name.toLowerCase().trim(), p);
      if (p.email) profilesMap.set(p.email.toLowerCase().trim(), p);
    }

    // Insert participants
    if (meetingData.participants?.length) {
      const participantRows = meetingData.participants.map((name: string) => {
        const matched = profilesMap.get(name.toLowerCase().trim());
        return {
          meeting_id: meeting.id,
          name,
          user_id: matched?.id ?? null,
          email: matched?.email ?? null,
        };
      });
      await supabase.from("meeting_participants").insert(participantRows);
    }

    // Insert topics
    if (meetingData.topics?.length) {
      await supabase.from("meeting_topics").insert(
        meetingData.topics.map((t: any) => ({
          meeting_id: meeting.id,
          title: t.title,
          notes: t.notes ?? [],
        }))
      );
    }

    // Insert action items as tasks
    if (meetingData.action_items?.length) {
      const tasks = meetingData.action_items.map((item: any) => {
        const assigneeName = item.assignee || "Unassigned";
        const matchedProfile = profilesMap.get(assigneeName.toLowerCase().trim());
        return {
          meeting_id: meeting.id,
          description: item.description,
          assignee_name: assigneeName,
          assignee_user_id: matchedProfile?.id ?? null,
          priority: ["LOW", "MEDIUM", "HIGH", "CRITICAL"].includes(item.priority)
            ? item.priority
            : "MEDIUM",
          status: "OPEN",
          created_by: user.id,
        };
      });
      const { data: inserted } = await supabase.from("tasks").insert(tasks).select();
      tasksCreated = inserted?.length ?? 0;
    }

    // Update import record — also correct source_type if auto-detected as plaud
    await supabase
      .from("imports")
      .update({
        status: "completed",
        meetings_created: 1,
        tasks_created: tasksCreated,
        source_type: meetingSource,
      })
      .eq("id", importRecord.id);

    return new Response(
      JSON.stringify({
        success: true,
        meeting_id: meeting.id,
        tasks_created: tasksCreated,
        source: meetingSource,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    await supabase
      .from("imports")
      .update({ status: "failed", error_message: String(err) })
      .eq("id", importRecord.id);

    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

async function callAI(
  messages: any[],
  openaiKey: string | undefined,
  lovableKey: string | undefined,
  model: string
): Promise<string> {
  if (lovableKey) {
    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${lovableKey}`,
      },
      body: JSON.stringify({ model, messages, max_tokens: 4000 }),
    });
    if (!res.ok) throw new Error(`Lovable AI error: ${res.status}`);
    const data = await res.json();
    return data.choices?.[0]?.message?.content ?? "";
  }

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${openaiKey}`,
    },
    body: JSON.stringify({ model: "gpt-4o-mini", messages, max_tokens: 4000 }),
  });
  if (!res.ok) throw new Error(`OpenAI error: ${res.status}`);
  const data = await res.json();
  return data.choices?.[0]?.message?.content ?? "";
}
