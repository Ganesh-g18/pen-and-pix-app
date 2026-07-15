import { createClient } from "@supabase/supabase-js";
import { defineTool, type ToolContext } from "@lovable.dev/mcp-js";
import { z } from "zod";
import type { Database, TablesUpdate } from "@/integrations/supabase/types";

function supabaseForUser(ctx: ToolContext) {
  return createClient<Database>(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_PUBLISHABLE_KEY!,
    {
      global: { headers: { Authorization: `Bearer ${ctx.getToken()}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    },
  );
}

export default defineTool({
  name: "update_note",
  title: "Update note",
  description:
    "Update fields on an existing InkFlow note. Only the provided fields are changed. Use trashed=true to move to trash.",
  inputSchema: {
    id: z.string().uuid(),
    title: z.string().trim().max(200).optional(),
    content: z.string().optional(),
    emoji: z.string().max(8).nullable().optional(),
    folder_id: z.string().uuid().nullable().optional(),
    tags: z.array(z.string().trim().min(1)).max(50).optional(),
    pinned: z.boolean().optional(),
    favorite: z.boolean().optional(),
    trashed: z.boolean().optional(),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  handler: async ({ id, ...patch }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    const cleaned: TablesUpdate<"notes"> = {};
    for (const [k, v] of Object.entries(patch)) {
      if (v !== undefined) (cleaned as Record<string, unknown>)[k] = v;
    }
    if (Object.keys(cleaned).length === 0) {
      return { content: [{ type: "text", text: "No fields to update" }], isError: true };
    }
    cleaned.updated_at = new Date().toISOString();

    const { data, error } = await supabaseForUser(ctx)
      .from("notes")
      .update(cleaned)
      .eq("id", id)
      .eq("user_id", ctx.getUserId()!)
      .select()
      .maybeSingle();
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    if (!data) return { content: [{ type: "text", text: "Note not found" }], isError: true };
    return {
      content: [{ type: "text", text: `Updated note ${data.id}` }],
      structuredContent: { note: data },
    };
  },
});
