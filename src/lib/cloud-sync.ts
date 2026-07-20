import { supabase } from "@/integrations/supabase/client";
import { useStore, type Note, type Folder } from "@/lib/store";
import type { User } from "@supabase/supabase-js";

export type CloudStatus = "idle" | "syncing" | "synced" | "offline" | "error";

let status: CloudStatus = "idle";
const listeners = new Set<(s: CloudStatus) => void>();
let currentUserId: string | null = null;
let lastSyncAt: number | null = null;
const pending = new Set<string>();
let flushTimer: ReturnType<typeof setTimeout> | null = null;
let unsub: (() => void) | null = null;

export function subscribeStatus(fn: (s: CloudStatus) => void) {
  listeners.add(fn);
  fn(status);
  return () => {
    listeners.delete(fn);
  };
}
export function getLastSync() {
  return lastSyncAt;
}
function setStatus(s: CloudStatus) {
  status = s;
  listeners.forEach((fn) => fn(s));
}

function noteToRow(n: Note, userId: string) {
  return {
    id: n.id,
    user_id: userId,
    title: n.title,
    emoji: n.emoji ?? null,
    mode: n.mode,
    paper: n.paper,
    content: n.content,
    strokes: n.strokes as unknown as never,
    text_blocks: (n.textBlocks ?? []) as unknown as never,
    paper_options: (n.paperOptions ?? null) as unknown as never,
    folder_id: n.folderId,
    tags: n.tags,
    pinned: n.pinned,
    favorite: n.favorite,
    trashed: n.trashed,
    created_at: new Date(n.createdAt).toISOString(),
    updated_at: new Date(n.updatedAt).toISOString(),
  };
}

function rowToNote(r: Record<string, unknown>): Note {
  return {
    id: r.id as string,
    title: (r.title as string) ?? "Untitled note",
    emoji: (r.emoji as string) ?? undefined,
    mode: (r.mode as Note["mode"]) ?? "text",
    paper: (r.paper as Note["paper"]) ?? "blank",
    paperOptions: (r.paper_options as Note["paperOptions"]) ?? undefined,
    content: (r.content as string) ?? "",
    strokes: (r.strokes as Note["strokes"]) ?? [],
    textBlocks: (r.text_blocks as Note["textBlocks"]) ?? [],
    folderId: (r.folder_id as string) ?? null,
    tags: (r.tags as string[]) ?? [],
    pinned: Boolean(r.pinned),
    favorite: Boolean(r.favorite),
    trashed: Boolean(r.trashed),
    createdAt: new Date(r.created_at as string).getTime(),
    updatedAt: new Date(r.updated_at as string).getTime(),
  };
}

async function pullFromCloud(userId: string) {
  setStatus("syncing");
  const [notesRes, foldersRes] = await Promise.all([
    supabase.from("notes").select("*").eq("user_id", userId),
    supabase.from("folders").select("*").eq("user_id", userId),
  ]);
  if (notesRes.error || foldersRes.error) {
    setStatus("error");
    return;
  }
  const notes = (notesRes.data ?? []).map((r) => rowToNote(r as Record<string, unknown>));
  const folders: Folder[] = (foldersRes.data ?? []).map((f) => ({
    id: f.id as string,
    name: f.name as string,
    emoji: (f.emoji as string) ?? "📁",
    color: (f.color as string) ?? "#8ab4ff",
  }));
  useStore.getState().hydrateFromCloud(notes, folders);
  lastSyncAt = Date.now();
  setStatus("synced");
}

async function pushAll(userId: string) {
  const state = useStore.getState();
  const noteRows = Object.values(state.notes).map((n) => noteToRow(n, userId));
  const folderRows = state.folders.map((f) => ({
    id: f.id,
    user_id: userId,
    name: f.name,
    emoji: f.emoji,
    color: f.color,
  }));
  if (folderRows.length) await supabase.from("folders").upsert(folderRows);
  if (noteRows.length) await supabase.from("notes").upsert(noteRows);
  lastSyncAt = Date.now();
}

async function flushPending() {
  if (!currentUserId || pending.size === 0) return;
  const ids = Array.from(pending);
  pending.clear();
  const state = useStore.getState();
  const rows = ids
    .filter((id) => state.notes[id])
    .map((id) => noteToRow(state.notes[id], currentUserId!));
  const deletions = ids.filter((id) => !state.notes[id]);
  setStatus("syncing");
  try {
    if (rows.length) await supabase.from("notes").upsert(rows);
    if (deletions.length) await supabase.from("notes").delete().in("id", deletions);
    lastSyncAt = Date.now();
    setStatus("synced");
  } catch {
    setStatus("error");
  }
}

function scheduleFlush() {
  if (flushTimer) clearTimeout(flushTimer);
  flushTimer = setTimeout(flushPending, 600);
}

/** Force an immediate flush of any pending changes to the cloud. */
export async function flushNow() {
  if (flushTimer) { clearTimeout(flushTimer); flushTimer = null; }
  if (!currentUserId) return;
  await flushPending();
}

export function isCloudActive() {
  return currentUserId !== null;
}


/** Import local (guest) notes and folders into the cloud for the given user. */
export async function importGuestData(userId: string) {
  setStatus("syncing");
  await pushAll(userId);
  setStatus("synced");
}

/** Wipe local notes/folders after successful migration. */
export function clearLocalGuestData() {
  useStore.getState().clearAll();
}

export function hasLocalGuestData() {
  const s = useStore.getState();
  return Object.keys(s.notes).length > 0;
}

/** Start cloud sync for the logged-in user. Pulls, then keeps upserting store diffs. */
export async function startCloudSync(user: User) {
  if (currentUserId === user.id) return;
  stopCloudSync();
  currentUserId = user.id;

  await pullFromCloud(user.id);

  // Push everything (in case guest data existed but wasn't explicitly migrated)
  // — handled via importGuestData path from the modal instead. Skip here.

  let prevNotes = useStore.getState().notes;
  let prevFolders = useStore.getState().folders;
  unsub = useStore.subscribe((state) => {
    // Diff notes
    for (const [id, n] of Object.entries(state.notes)) {
      if (prevNotes[id] !== n) pending.add(id);
    }
    for (const id of Object.keys(prevNotes)) {
      if (!state.notes[id]) pending.add(id);
    }
    // Folders (upsert-all when changed)
    if (state.folders !== prevFolders && currentUserId) {
      const rows = state.folders.map((f) => ({
        id: f.id,
        user_id: currentUserId!,
        name: f.name,
        emoji: f.emoji,
        color: f.color,
      }));
      supabase.from("folders").upsert(rows).then(() => {});
    }
    prevNotes = state.notes;
    prevFolders = state.folders;
    if (pending.size) scheduleFlush();
  });

  if (typeof window !== "undefined") {
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
  }
}

function handleOnline() {
  if (currentUserId) setStatus("synced");
}
function handleOffline() {
  setStatus("offline");
}

export function stopCloudSync() {
  if (unsub) unsub();
  unsub = null;
  currentUserId = null;
  pending.clear();
  if (flushTimer) clearTimeout(flushTimer);
  if (typeof window !== "undefined") {
    window.removeEventListener("online", handleOnline);
    window.removeEventListener("offline", handleOffline);
  }
  setStatus("idle");
}
