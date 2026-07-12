import { Command as CommandPrimitive } from "cmdk";
import { useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import { FileText, PenLine, Moon, Sun, Trash2, Star, Pin } from "lucide-react";
import { useStore } from "@/lib/store";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

export function CommandPalette({ open, onOpenChange }: Props) {
  const navigate = useNavigate();
  const notes = useStore((s) => s.notes);
  const createNote = useStore((s) => s.createNote);
  const toggleTheme = useStore((s) => s.toggleTheme);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        onOpenChange(!open);
      }
      if (e.key === "Escape") onOpenChange(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onOpenChange]);

  if (!open) return null;

  const go = (fn: () => void) => { fn(); onOpenChange(false); };
  const noteList = Object.values(notes).filter((n) => !n.trashed).sort((a,b)=>b.updatedAt-a.updatedAt).slice(0, 20);

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-start justify-center pt-24 bg-background/60 backdrop-blur-sm animate-in fade-in"
      onClick={() => onOpenChange(false)}
    >
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-xl glass-strong rounded-2xl overflow-hidden animate-in zoom-in-95">
        <CommandPrimitive className="text-sm">
          <CommandPrimitive.Input
            autoFocus
            placeholder="Type a command or search…"
            className="w-full bg-transparent px-5 py-4 outline-none border-b border-border/60"
          />
          <CommandPrimitive.List className="max-h-96 overflow-y-auto p-2 scrollbar-thin">
            <CommandPrimitive.Empty className="p-6 text-center text-muted-foreground">No results</CommandPrimitive.Empty>
            <CommandPrimitive.Group heading="Create" className="px-1 [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-widest [&_[cmdk-group-heading]]:text-muted-foreground">
              <Item onSelect={() => go(() => { const id = createNote({ mode: "text" }); navigate({ to: "/note/$id", params: { id } }); })} icon={<FileText className="h-4 w-4" />} label="New text note" shortcut="⌘N" />
              <Item onSelect={() => go(() => { const id = createNote({ mode: "canvas" }); navigate({ to: "/note/$id", params: { id } }); })} icon={<PenLine className="h-4 w-4" />} label="New handwriting canvas" />
            </CommandPrimitive.Group>
            <CommandPrimitive.Group heading="Actions" className="px-1 mt-2 [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-widest [&_[cmdk-group-heading]]:text-muted-foreground">
              <Item onSelect={() => go(toggleTheme)} icon={<Sun className="h-4 w-4" />} label="Toggle theme" />
              <Item onSelect={() => go(() => navigate({ to: "/" }))} icon={<Pin className="h-4 w-4" />} label="Go to dashboard" />
            </CommandPrimitive.Group>
            {noteList.length > 0 && (
              <CommandPrimitive.Group heading="Recent notes" className="px-1 mt-2 [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-widest [&_[cmdk-group-heading]]:text-muted-foreground">
                {noteList.map((n) => (
                  <Item
                    key={n.id}
                    onSelect={() => go(() => navigate({ to: "/note/$id", params: { id: n.id } }))}
                    icon={<span className="text-base leading-none">{n.emoji || "📝"}</span>}
                    label={n.title}
                  />
                ))}
              </CommandPrimitive.Group>
            )}
          </CommandPrimitive.List>
        </CommandPrimitive>
      </div>
    </div>
  );
}

function Item({ onSelect, icon, label, shortcut }: { onSelect: () => void; icon: React.ReactNode; label: string; shortcut?: string }) {
  return (
    <CommandPrimitive.Item
      onSelect={onSelect}
      className="flex items-center gap-3 rounded-lg px-3 py-2.5 cursor-pointer data-[selected=true]:bg-accent aria-selected:bg-accent"
    >
      <span className="grid h-6 w-6 place-items-center text-muted-foreground">{icon}</span>
      <span className="flex-1 truncate">{label}</span>
      {shortcut && <kbd className="text-[10px] rounded bg-muted px-1.5 py-0.5">{shortcut}</kbd>}
    </CommandPrimitive.Item>
  );
}
