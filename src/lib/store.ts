import { create } from "zustand";
import { persist } from "zustand/middleware";

export type PaperType = "blank" | "grid" | "dots" | "lined";
export type NoteMode = "text" | "canvas";

export type PenStyle = "ballpoint" | "fountain" | "marker" | "pencil";

export interface Stroke {
  id: string;
  tool: "pen" | "highlighter" | "marker";
  penStyle?: PenStyle;
  color: string;
  size: number;
  opacity: number;
  points: number[]; // flat [x,y,pressure, x,y,pressure, ...]
}

export interface Note {
  id: string;
  title: string;
  emoji?: string;
  mode: NoteMode;
  paper: PaperType;
  content: string; // tiptap HTML
  strokes: Stroke[];
  folderId: string | null;
  tags: string[];
  pinned: boolean;
  favorite: boolean;
  trashed: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface Folder {
  id: string;
  name: string;
  emoji: string;
  color: string;
}

export type ThemeMode = "light" | "dark" | "system";
export type Density = "compact" | "comfortable" | "spacious";
export type FontSize = "sm" | "md" | "lg";

export interface Settings {
  themeMode: ThemeMode;
  accentColor: string; // hex
  fontSize: FontSize;
  density: Density;
  animations: boolean;
  glassmorphism: boolean;
  // Note prefs
  defaultPen: "pen" | "highlighter" | "marker";
  defaultPenColor: string;
  defaultPenThickness: number;
  defaultHighlighter: string;
  defaultPaper: PaperType;
  defaultPageSize: "A4" | "Letter" | "Legal" | "Infinite";
  autoSaveInterval: number; // seconds
  infiniteCanvas: boolean;
  shapeRecognition: boolean;
  handwritingSmoothing: boolean;
  rememberLastTool: boolean;
  // Notifications
  notifyEmail: boolean;
  notifyProductUpdates: boolean;
  notifySharedNotes: boolean;
  notifyCollabInvites: boolean;
  notifySecurity: boolean;
  notifySyncStatus: boolean;
  // Locale
  language: string;
  timeZone: string;
  dateFormat: string;
  timeFormat: "12" | "24";
  units: "metric" | "imperial";
  // Privacy
  privateProfile: boolean;
  allowCollabRequests: boolean;
  anonymousAnalytics: boolean;
  crashReports: boolean;
  personalization: boolean;
  // Profile
  displayName: string;
  username: string;
  avatarUrl: string;
}

interface State {
  notes: Record<string, Note>;
  folders: Folder[];
  activeFolderId: string | null;
  query: string;
  theme: "light" | "dark";
  guestMode: boolean;
  signInReminderDismissedAt: number | null;
  signInReminderShown: boolean;
  settings: Settings;
  createNote: (partial?: Partial<Note>) => string;
  updateNote: (id: string, patch: Partial<Note>) => void;
  deleteNote: (id: string, permanent?: boolean) => void;
  restoreNote: (id: string) => void;
  togglePin: (id: string) => void;
  toggleFavorite: (id: string) => void;
  addFolder: (name: string, emoji?: string) => string;
  deleteFolder: (id: string) => void;
  setActiveFolder: (id: string | null) => void;
  setQuery: (q: string) => void;
  toggleTheme: () => void;
  addStroke: (id: string, stroke: Stroke) => void;
  undoStroke: (id: string) => void;
  redoStroke: (id: string) => void;
  clearStrokes: (id: string) => void;
  commitErase: (id: string, prev: Stroke[], next: Stroke[]) => void;


  setGuestMode: (v: boolean) => void;
  dismissSignInReminder: () => void;
  markSignInReminderShown: () => void;
  hydrateFromCloud: (notes: Note[], folders: Folder[]) => void;
  clearAll: () => void;
  updateSettings: (patch: Partial<Settings>) => void;
  resetSettings: () => void;
}


const uid = () => Math.random().toString(36).slice(2, 10);

// Ephemeral per-note stroke history for undo/redo (snapshot-based).
const undoHistory: Map<string, Stroke[][]> = new Map();
const redoHistory: Map<string, Stroke[][]> = new Map();

const pushUndo = (id: string, snapshot: Stroke[]) => {
  const stack = undoHistory.get(id) ?? [];
  stack.push(snapshot);
  if (stack.length > 100) stack.shift();
  undoHistory.set(id, stack);
  redoHistory.set(id, []); // any new action clears redo
};



const seedFolders: Folder[] = [
  { id: "f-personal", name: "Personal", emoji: "🌿", color: "#7c9cff" },
  { id: "f-work", name: "Work", emoji: "💼", color: "#ffb37c" },
  { id: "f-study", name: "Study", emoji: "📚", color: "#a97cff" },
];

const defaultSettings: Settings = {
  themeMode: "light",
  accentColor: "#7c5cff",
  fontSize: "md",
  density: "comfortable",
  animations: true,
  glassmorphism: true,
  defaultPen: "pen",
  defaultPenColor: "#111827",
  defaultPenThickness: 2,
  defaultHighlighter: "#fde68a",
  defaultPaper: "blank",
  defaultPageSize: "A4",
  autoSaveInterval: 5,
  infiniteCanvas: false,
  shapeRecognition: false,
  handwritingSmoothing: true,
  rememberLastTool: true,
  notifyEmail: true,
  notifyProductUpdates: true,
  notifySharedNotes: true,
  notifyCollabInvites: true,
  notifySecurity: true,
  notifySyncStatus: false,
  language: "en-US",
  timeZone: "auto",
  dateFormat: "YYYY-MM-DD",
  timeFormat: "24",
  units: "metric",
  privateProfile: false,
  allowCollabRequests: true,
  anonymousAnalytics: true,
  crashReports: true,
  personalization: false,
  displayName: "",
  username: "",
  avatarUrl: "",
};

export const useStore = create<State>()(
  persist(
    (set, get) => ({
      notes: {},
      folders: seedFolders,
      activeFolderId: null,
      query: "",
      theme: "light",
      guestMode: false,
      signInReminderDismissedAt: null,
      signInReminderShown: false,
      settings: defaultSettings,

      updateSettings: (patch) => set((s) => ({ settings: { ...s.settings, ...patch } })),
      resetSettings: () => set({ settings: defaultSettings }),

      setGuestMode: (v) => set({ guestMode: v }),
      dismissSignInReminder: () => set({ signInReminderDismissedAt: Date.now() }),
      markSignInReminderShown: () => set({ signInReminderShown: true }),
      hydrateFromCloud: (notes, folders) =>
        set((s) => {
          const merged = { ...s.notes };
          for (const n of notes) merged[n.id] = n;
          const folderIds = new Set(s.folders.map((f) => f.id));
          const mergedFolders = [...s.folders];
          for (const f of folders) if (!folderIds.has(f.id)) mergedFolders.push(f);
          return { notes: merged, folders: mergedFolders };
        }),
      clearAll: () => set({ notes: {}, folders: seedFolders, guestMode: false }),

      createNote: (partial) => {
        const id = uid();
        const now = Date.now();
        const note: Note = {
          id,
          title: "Untitled note",
          emoji: "✍️",
          mode: "text",
          paper: "blank",
          content: "",
          strokes: [],
          folderId: get().activeFolderId,
          tags: [],
          pinned: false,
          favorite: false,
          trashed: false,
          createdAt: now,
          updatedAt: now,
          ...partial,
        };
        set((s) => ({ notes: { ...s.notes, [id]: note } }));
        return id;
      },

      updateNote: (id, patch) =>
        set((s) => {
          const n = s.notes[id];
          if (!n) return s;
          return { notes: { ...s.notes, [id]: { ...n, ...patch, updatedAt: Date.now() } } };
        }),

      deleteNote: (id, permanent) =>
        set((s) => {
          if (permanent) {
            const { [id]: _, ...rest } = s.notes;
            return { notes: rest };
          }
          const n = s.notes[id];
          if (!n) return s;
          return { notes: { ...s.notes, [id]: { ...n, trashed: true, updatedAt: Date.now() } } };
        }),

      restoreNote: (id) =>
        set((s) => {
          const n = s.notes[id];
          if (!n) return s;
          return { notes: { ...s.notes, [id]: { ...n, trashed: false } } };
        }),

      togglePin: (id) =>
        set((s) => {
          const n = s.notes[id];
          if (!n) return s;
          return { notes: { ...s.notes, [id]: { ...n, pinned: !n.pinned } } };
        }),

      toggleFavorite: (id) =>
        set((s) => {
          const n = s.notes[id];
          if (!n) return s;
          return { notes: { ...s.notes, [id]: { ...n, favorite: !n.favorite } } };
        }),

      addFolder: (name, emoji = "📁") => {
        const id = "f-" + uid();
        set((s) => ({ folders: [...s.folders, { id, name, emoji, color: "#8ab4ff" }] }));
        return id;
      },

      deleteFolder: (id) =>
        set((s) => ({
          folders: s.folders.filter((f) => f.id !== id),
          notes: Object.fromEntries(
            Object.entries(s.notes).map(([nid, n]) => [
              nid,
              n.folderId === id ? { ...n, folderId: null } : n,
            ]),
          ),
        })),

      setActiveFolder: (id) => set({ activeFolderId: id }),
      setQuery: (q) => set({ query: q }),
      toggleTheme: () => set((s) => ({ theme: s.theme === "dark" ? "light" : "dark" })),

      addStroke: (id, stroke) =>
        set((s) => {
          const n = s.notes[id];
          if (!n) return s;
          pushUndo(id, n.strokes);
          return {
            notes: {
              ...s.notes,
              [id]: { ...n, strokes: [...n.strokes, stroke], updatedAt: Date.now() },
            },
          };
        }),

      undoStroke: (id) =>
        set((s) => {
          const n = s.notes[id];
          if (!n) return s;
          const stack = undoHistory.get(id);
          if (!stack || stack.length === 0) return s;
          const prev = stack.pop()!;
          const redo = redoHistory.get(id) ?? [];
          redo.push(n.strokes);
          if (redo.length > 100) redo.shift();
          redoHistory.set(id, redo);
          return {
            notes: {
              ...s.notes,
              [id]: { ...n, strokes: prev, updatedAt: Date.now() },
            },
          };
        }),

      redoStroke: (id) =>
        set((s) => {
          const n = s.notes[id];
          if (!n) return s;
          const redo = redoHistory.get(id);
          if (!redo || redo.length === 0) return s;
          const next = redo.pop()!;
          const undo = undoHistory.get(id) ?? [];
          undo.push(n.strokes);
          if (undo.length > 100) undo.shift();
          undoHistory.set(id, undo);
          return {
            notes: {
              ...s.notes,
              [id]: { ...n, strokes: next, updatedAt: Date.now() },
            },
          };
        }),

      commitErase: (id, prev, next) =>
        set((s) => {
          const n = s.notes[id];
          if (!n) return s;
          pushUndo(id, prev);
          return {
            notes: {
              ...s.notes,
              [id]: { ...n, strokes: next, updatedAt: Date.now() },
            },
          };
        }),

      clearStrokes: (id) =>
        set((s) => {
          const n = s.notes[id];
          if (!n) return s;
          pushUndo(id, n.strokes);
          return { notes: { ...s.notes, [id]: { ...n, strokes: [], updatedAt: Date.now() } } };
        }),



    }),
    { name: "inkflow-store-v1" },
  ),
);
