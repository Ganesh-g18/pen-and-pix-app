import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import { useEffect, useRef } from "react";
import {
  Bold, Italic, Strikethrough, Heading1, Heading2, Heading3,
  List, ListOrdered, Quote, Code2, ListChecks, Undo2, Redo2,
} from "lucide-react";

interface Props {
  content: string;
  onChange: (html: string) => void;
}

export function TextEditor({ content, onChange }: Props) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({ placeholder: "Start writing… press ⌘K for actions" }),
      TaskList,
      TaskItem.configure({ nested: true }),
    ],
    content,
    editorProps: {
      attributes: {
        class: "tiptap prose-none focus:outline-none text-[15px] leading-relaxed max-w-3xl mx-auto py-10",
      },
    },
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
  });

  const lastExternal = useRef(content);
  useEffect(() => {
    if (editor && content !== lastExternal.current && content !== editor.getHTML()) {
      lastExternal.current = content;
      editor.commands.setContent(content, { emitUpdate: false });
    }
  }, [content, editor]);

  if (!editor) return null;

  const btn = (active: boolean) =>
    `grid h-8 w-8 place-items-center rounded-lg transition ${active ? "bg-primary/15 text-primary" : "text-muted-foreground hover:bg-accent hover:text-foreground"}`;

  return (
    <div className="flex flex-col h-full">
      <div className="sticky top-16 z-10 mx-auto mt-4 flex items-center gap-1 rounded-2xl glass-strong px-2 py-1.5">
        <button className={btn(false)} onClick={() => editor.chain().focus().undo().run()}><Undo2 className="h-4 w-4" /></button>
        <button className={btn(false)} onClick={() => editor.chain().focus().redo().run()}><Redo2 className="h-4 w-4" /></button>
        <div className="w-px h-5 bg-border mx-1" />
        <button className={btn(editor.isActive("heading", { level: 1 }))} onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}><Heading1 className="h-4 w-4" /></button>
        <button className={btn(editor.isActive("heading", { level: 2 }))} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}><Heading2 className="h-4 w-4" /></button>
        <button className={btn(editor.isActive("heading", { level: 3 }))} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}><Heading3 className="h-4 w-4" /></button>
        <div className="w-px h-5 bg-border mx-1" />
        <button className={btn(editor.isActive("bold"))} onClick={() => editor.chain().focus().toggleBold().run()}><Bold className="h-4 w-4" /></button>
        <button className={btn(editor.isActive("italic"))} onClick={() => editor.chain().focus().toggleItalic().run()}><Italic className="h-4 w-4" /></button>
        <button className={btn(editor.isActive("strike"))} onClick={() => editor.chain().focus().toggleStrike().run()}><Strikethrough className="h-4 w-4" /></button>
        <div className="w-px h-5 bg-border mx-1" />
        <button className={btn(editor.isActive("bulletList"))} onClick={() => editor.chain().focus().toggleBulletList().run()}><List className="h-4 w-4" /></button>
        <button className={btn(editor.isActive("orderedList"))} onClick={() => editor.chain().focus().toggleOrderedList().run()}><ListOrdered className="h-4 w-4" /></button>
        <button className={btn(editor.isActive("taskList"))} onClick={() => editor.chain().focus().toggleTaskList().run()}><ListChecks className="h-4 w-4" /></button>
        <button className={btn(editor.isActive("blockquote"))} onClick={() => editor.chain().focus().toggleBlockquote().run()}><Quote className="h-4 w-4" /></button>
        <button className={btn(editor.isActive("codeBlock"))} onClick={() => editor.chain().focus().toggleCodeBlock().run()}><Code2 className="h-4 w-4" /></button>
      </div>
      <div className="flex-1 overflow-y-auto px-6">
        <EditorContent editor={editor} className="h-full" />
      </div>
    </div>
  );
}
