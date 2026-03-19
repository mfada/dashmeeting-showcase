import { createClient } from "https://esm.sh/@supabase/supabase-js@2.98.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  // Verify caller is authenticated
  const authHeader = req.headers.get("authorization") ?? "";
  const { data: { user }, error: authError } = await supabase.auth.getUser(
    authHeader.replace("Bearer ", "")
  );
  if (authError || !user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const FIREFLIES_API_KEY = Deno.env.get("FIREFLIES_API_KEY");
  if (!FIREFLIES_API_KEY) {
    return new Response(
      JSON.stringify({
        error: "Fireflies API key not configured. Please add it in Settings.",
      }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }

  // Create import record
  const { data: importRecord, error: importError } = await supabase
    .from("imports")
    .insert({
      source_type: "fireflies",
      status: "processing",
      created_by: user.id,
    })
    .select()
    .single();

  if (importError) {
    return new Response(JSON.stringify({ error: importError.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    // Fetch all profiles for auto-matching assignees
    const { data: allProfiles } = await supabase.from("profiles").select("id, full_name, email");
    const profilesMap = new Map<string, { id: string; full_name: string; email: string }>();
    for (const p of allProfiles ?? []) {
      if (p.full_name) profilesMap.set(p.full_name.toLowerCase().trim(), p);
      if (p.email) profilesMap.set(p.email.toLowerCase().trim(), p);
      const firstName = (p.full_name ?? "").split(" ")[0]?.toLowerCase().trim();
      if (firstName && firstName.length > 2) profilesMap.set(firstName, p);
    }

    // Fetch recent transcripts from Fireflies GraphQL API
    const query = `{
      transcripts(limit: 10) {
        id
        title
        date
        duration
        participants
        summary { overview action_items keywords }
        sentences { speaker_name text }
      }
    }`;

    const ffRes = await fetch("https://api.fireflies.ai/graphql", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${FIREFLIES_API_KEY}`,
      },
      body: JSON.stringify({ query }),
    });

    if (!ffRes.ok) {
      throw new Error(`Fireflies API returned ${ffRes.status}`);
    }

    const ffData = await ffRes.json();
    if (ffData.errors) {
      throw new Error(ffData.errors[0]?.message ?? "Fireflies API error");
    }

    const transcripts = ffData.data?.transcripts ?? [];
    let meetingsCreated = 0;
    let tasksCreated = 0;

    for (const t of transcripts) {
      // Skip if already imported
      const { data: existing } = await supabase
        .from("meetings")
        .select("id")
        .eq("fireflies_meeting_id", t.id)
        .maybeSingle();

      if (existing) continue;

      // Build raw transcript
      const rawTranscript = (t.sentences ?? [])
        .map((s: any) => `${s.speaker_name}: ${s.text}`)
        .join("\n");

      // Insert meeting
      const { data: meeting, error: mErr } = await supabase
        .from("meetings")
        .insert({
          title: t.title ?? "Untitled Meeting",
          date: t.date
            ? new Date(Number(t.date)).toISOString()
            : new Date().toISOString(),
          general_summary: t.summary?.overview ?? "",
          source: "fireflies",
          fireflies_meeting_id: t.id,
          raw_transcript: rawTranscript,
          import_id: importRecord.id,
          created_by: user.id,
        })
        .select()
        .single();

      if (mErr || !meeting) continue;
      meetingsCreated++;

      // Insert participants with auto-matching to profiles
      const participants = t.participants ?? [];
      if (participants.length > 0) {
        const participantRows = participants.map((name: string) => {
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

      // Insert topics from keywords
      if (t.summary?.keywords?.length) {
        await supabase.from("meeting_topics").insert(
          t.summary.keywords.map((kw: string) => ({
            meeting_id: meeting.id,
            title: kw,
            notes: [],
          }))
        );
      }

      // Pre-process action items: detect names as assignee markers (not tasks)
      const rawActionItems = Array.isArray(t.summary?.action_items)
        ? t.summary.action_items
        : typeof t.summary?.action_items === "string"
          ? t.summary.action_items.split("\n").map((s: string) => s.trim()).filter(Boolean)
          : [];

      // Build a combined set of known names from profiles AND participants
      const knownNamesSet = new Set<string>();
      for (const [key] of profilesMap.entries()) {
        knownNamesSet.add(key.toLowerCase().trim());
      }
      for (const pName of participants) {
        const lower = String(pName).toLowerCase().trim();
        knownNamesSet.add(lower);
        // Also add first name
        const firstName = lower.split(/\s+/)[0];
        if (firstName && firstName.length > 2) knownNamesSet.add(firstName);
      }

      // Heuristic: detect if a string looks like a proper name (2-3 capitalized words, no verbs/punctuation)
      const looksLikeProperName = (text: string): boolean => {
        const words = text.trim().split(/\s+/);
        if (words.length < 1 || words.length > 4) return false;
        // All words should start with uppercase and contain only letters/hyphens/apostrophes
        return words.every(w => /^[A-Z][a-zA-Z'-]*$/.test(w));
      };

      const namePattern = /^\*\*(.+?)\*\*$/;
      const processedItems: { text: string; markerName: string | null }[] = [];
      let currentMarkerName: string | null = null;

      for (const item of rawActionItems) {
        const cleaned = item.replace(/^[-•]\s*/, "").trim();
        const strippedMarkdown = cleaned.replace(/\*\*/g, "").trim();

        // Check 1: Bold name pattern **Name**
        const nameMatch = cleaned.match(namePattern);
        if (nameMatch) {
          currentMarkerName = nameMatch[1].trim();
          continue;
        }

        // Check 2: Is the stripped text a known name (profile or participant)?
        if (knownNamesSet.has(strippedMarkdown.toLowerCase())) {
          currentMarkerName = strippedMarkdown;
          continue;
        }

        // Check 3: Looks like a proper name heuristically (2-3 capitalized words)
        if (strippedMarkdown.split(/\s+/).length <= 3 && looksLikeProperName(strippedMarkdown)) {
          currentMarkerName = strippedMarkdown;
          continue;
        }

        // Strip ** from the description text before storing
        const cleanDescription = cleaned.replace(/\*\*/g, "").trim();
        if (cleanDescription) {
          processedItems.push({ text: cleanDescription, markerName: currentMarkerName });
        }
      }

      if (processedItems.length > 0) {
        // Build known people list for AI
        const knownPeople = (allProfiles ?? []).map((p) => ({
          id: p.id,
          name: p.full_name ?? "",
          email: p.email ?? "",
        }));

        // Use AI to assign ALL items (not just those without markers)
        let aiAssignments: Record<number, string> = {};
        const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

        if (LOVABLE_API_KEY && rawTranscript && processedItems.length > 0) {
          try {
            const transcriptSnippet = rawTranscript.length > 4000
              ? rawTranscript.slice(-4000)
              : rawTranscript;

            const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
              method: "POST",
              headers: {
                Authorization: `Bearer ${LOVABLE_API_KEY}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                model: "google/gemini-2.5-flash",
                messages: [
                  {
                    role: "system",
                    content: `You are an assistant that determines who should be assigned to each action item from a meeting transcript. For each action item (by index), return the name of the person most likely responsible based on the conversation context. Use the tool provided.`,
                  },
                  {
                    role: "user",
                    content: `Meeting participants: ${JSON.stringify(participants)}\n\nKnown people in the system:\n${knownPeople.map((p) => `- ${p.name} (${p.email})`).join("\n")}\n\nTranscript excerpt:\n${transcriptSnippet}\n\nAction items (with current assignee hints where available):\n${processedItems.map((item, i) => `${i}: ${item.text}${item.markerName ? ` [hint: ${item.markerName}]` : ""}`).join("\n")}\n\nFor each action item index, determine who should be assigned. Use the hint if provided but also verify against the transcript context.`,
                  },
                ],
                tools: [
                  {
                    type: "function",
                    function: {
                      name: "assign_action_items",
                      description: "Assign each action item to a person",
                      parameters: {
                        type: "object",
                        properties: {
                          assignments: {
                            type: "array",
                            items: {
                              type: "object",
                              properties: {
                                index: { type: "number", description: "Action item index" },
                                assignee_name: { type: "string", description: "Full name of the person to assign" },
                              },
                              required: ["index", "assignee_name"],
                              additionalProperties: false,
                            },
                          },
                        },
                        required: ["assignments"],
                        additionalProperties: false,
                      },
                    },
                  },
                ],
                tool_choice: { type: "function", function: { name: "assign_action_items" } },
              }),
            });

            if (aiRes.ok) {
              const aiData = await aiRes.json();
              const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
              if (toolCall?.function?.arguments) {
                const parsed = JSON.parse(toolCall.function.arguments);
                for (const a of parsed.assignments ?? []) {
                  aiAssignments[a.index] = a.assignee_name;
                }
              }
            }
          } catch (aiErr) {
            console.error("AI assignee detection failed, falling back to text matching:", aiErr);
          }
        }

        const tasks = processedItems.map((item, idx) => {
          let assigneeName = "Unassigned";
          let assigneeUserId: string | null = null;

          // Priority 1: AI assignment (runs for ALL items now, with marker hints)
          const aiName = aiAssignments[idx];
          if (aiName) {
            const matched = profilesMap.get(aiName.toLowerCase().trim());
            if (matched) {
              assigneeName = matched.full_name ?? matched.email;
              assigneeUserId = matched.id;
            } else {
              assigneeName = aiName;
            }
          }

          // Priority 2: marker name (if AI didn't assign or no AI)
          if (!assigneeUserId && item.markerName) {
            const matched = profilesMap.get(item.markerName.toLowerCase().trim());
            if (matched) {
              assigneeName = matched.full_name ?? matched.email;
              assigneeUserId = matched.id;
            } else {
              assigneeName = item.markerName;
            }
          }

          // Priority 3: text-based matching fallback
          if (!assigneeUserId) {
            for (const [key, profile] of profilesMap.entries()) {
              if (item.text.toLowerCase().includes(key) && key.length > 2) {
                assigneeName = profile.full_name ?? profile.email;
                assigneeUserId = profile.id;
                break;
              }
            }
          }

          return {
            meeting_id: meeting.id,
            description: item.text,
            assignee_name: assigneeName,
            assignee_user_id: assigneeUserId,
            priority: "MEDIUM",
            status: "OPEN",
          };
        });
        const { data: inserted } = await supabase
          .from("tasks")
          .insert(tasks)
          .select();
        tasksCreated += inserted?.length ?? 0;
      }
    }

    // Update import record
    await supabase
      .from("imports")
      .update({
        status: "completed",
        meetings_created: meetingsCreated,
        tasks_created: tasksCreated,
      })
      .eq("id", importRecord.id);

    return new Response(
      JSON.stringify({
        success: true,
        meetings_created: meetingsCreated,
        tasks_created: tasksCreated,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
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
