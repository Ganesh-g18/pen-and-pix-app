import { createClient } from "@supabase/supabase-js";
import { defineTool, type ToolContext } from "@lovable.dev/mcp-js";
import { z } from "zod";
import type { Database } from "@/integrations/supabase/types";

function supabaseForUser(ctx: ToolContext) {
  return createClient<Database>(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, {
    global: { headers: { Authorization: `Bearer ${ctx.getToken()}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function uuid() {
  return globalThis.crypto.randomUUID();
}

export default defineTool({
  name: "create_note",
  title: "Create note",
  description: "Create a new text note in Pen Flow for the signed-in user.",
  inputSchema: {
    title: z.string().trim().max(200).optional().describe("Note title. Defaults to 'Untitled note'."),
    content: z.string().optional().describe("Note body (plain text or markdown)."),
    emoji: z.string().max(8).optional(),
    folder_id: z.string().uuid().nullable().optional(),
    tags: z.array(z.string().trim().min(1)).max(50).optional(),
    pinned: z.boolean().optional(),
    favorite: z.boolean().optional(),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  handler: async (input, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    const id = uuid();
    const { data, error } = await supabaseForUser(ctx)
      .from("notes")
      .insert({
        id,
        user_id: ctx.getUserId()!,
        title: input.title ?? "Untitled note",
        content: input.content ?? "",
        emoji: input.emoji ?? null,
        folder_id: input.folder_id ?? null,
        tags: input.tags ?? [],
        pinned: input.pinned ?? false,
        favorite: input.favorite ?? false,
        mode: "text",
      })
      .select()
      .single();
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: `Created note ${data.id}` }],
      structuredContent: { note: data },
    };
  },
});
