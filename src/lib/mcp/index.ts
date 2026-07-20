import { auth, defineMcp } from "@lovable.dev/mcp-js";
import listNotes from "./tools/list-notes";
import getNote from "./tools/get-note";
import createNote from "./tools/create-note";
import updateNote from "./tools/update-note";
import deleteNote from "./tools/delete-note";
import listFolders from "./tools/list-folders";

// The OAuth issuer MUST be the direct Supabase host (RFC 8414). Vite inlines
// VITE_SUPABASE_PROJECT_ID at build time; the fallback keeps the issuer
// well-formed during the throwaway manifest-extract eval.
const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "Pen Flow-mcp",
  title: "Pen Flow",
  version: "0.1.0",
  instructions:
    "Tools for Pen Flow — the signed-in user's notes and folders. Use list_notes/get_note to read, create_note/update_note to author, and delete_note to permanently remove. Prefer update_note with trashed=true over delete_note for reversible removal.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [listNotes, getNote, createNote, updateNote, deleteNote, listFolders],
});
