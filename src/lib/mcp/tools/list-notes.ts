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

export default defineTool({
  name: "list_notes",
  title: "List notes",
  description:
    "List the signed-in user's Pen Flow notes. Supports filtering by folder, favorites, pinned, or trashed, and a text search over title and content.",
  inputSchema: {
    search: z.string().trim().optional().describe("Case-insensitive text to match in title or content."),
    folder_id: z
      .string()
      .uuid()
      .nullable()
      .optional()
      .describe("Filter by folder id; pass null for notes without a folder."),
    favorite: z.boolean().optional(),
    pinned: z.boolean().optional(),
    trashed: z.boolean().optional().describe("Defaults to false — trashed notes are hidden."),
    limit: z.number().int().min(1).max(100).optional().describe("Default 50."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (input, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    const supabase = supabaseForUser(ctx);
    let q = supabase
      .from("notes")
      .select("id, title, emoji, mode, folder_id, pinned, favorite, trashed, tags, updated_at, created_at")
      .eq("user_id", ctx.getUserId()!)
      .eq("trashed", input.trashed ?? false)
      .order("updated_at", { ascending: false })
      .limit(input.limit ?? 50);

    if (input.folder_id === null) q = q.is("folder_id", null);
    else if (input.folder_id) q = q.eq("folder_id", input.folder_id);
    if (typeof input.favorite === "boolean") q = q.eq("favorite", input.favorite);
    if (typeof input.pinned === "boolean") q = q.eq("pinned", input.pinned);
    if (input.search) q = q.or(`title.ilike.%${input.search}%,content.ilike.%${input.search}%`);

    const { data, error } = await q;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
      structuredContent: { notes: data ?? [] },
    };
  },
});
