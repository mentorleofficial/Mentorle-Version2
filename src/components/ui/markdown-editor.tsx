import { useEffect } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import { Toggle } from "@/components/ui/toggle";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Bold,
  Italic,
  List,
  ListOrdered,
  Link2,
  Heading1,
  Heading2,
  Heading3,
  Heading4,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface MarkdownEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  rows?: number;
  className?: string;
}

// ─── Markdown <-> HTML Helpers ───────────────────────────────────────────────

export function markdownToHtml(markdown: string): string {
  if (!markdown) return "";
  let html = markdown;

  // 1. Process headings (H1-H4)
  html = html.replace(/^#\s+(.+)$/gm, "<h1>$1</h1>");
  html = html.replace(/^##\s+(.+)$/gm, "<h2>$1</h2>");
  html = html.replace(/^###\s+(.+)$/gm, "<h3>$1</h3>");
  html = html.replace(/^####\s+(.+)$/gm, "<h4>$1</h4>");

  // 2. Process bold & italic
  html = html.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
  html = html.replace(/__(.*?)__/g, "<strong>$1</strong>");
  html = html.replace(/\*(.*?)\*/g, "<em>$1</em>");
  html = html.replace(/_(.*?)_/g, "<em>$1</em>");

  // 3. Process links
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');

  // 4. Process lists (Bullet and Ordered)
  const lines = html.split("\n");
  let inBullet = false;
  let inOrdered = false;
  const result: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const bulletMatch = line.match(/^[-*]\s+(.+)$/);
    const orderedMatch = line.match(/^\d+\.\s+(.+)$/);

    if (bulletMatch) {
      if (inOrdered) {
        result.push("</ol>");
        inOrdered = false;
      }
      if (!inBullet) {
        result.push("<ul>");
        inBullet = true;
      }
      result.push(`<li>${bulletMatch[1]}</li>`);
    } else if (orderedMatch) {
      if (inBullet) {
        result.push("</ul>");
        inBullet = false;
      }
      if (!inOrdered) {
        result.push("<ol>");
        inOrdered = true;
      }
      result.push(`<li>${orderedMatch[1]}</li>`);
    } else {
      if (inBullet) {
        result.push("</ul>");
        inBullet = false;
      }
      if (inOrdered) {
        result.push("</ol>");
        inOrdered = false;
      }

      const trimmed = line.trim();
      if (trimmed) {
        // If line already contains block tags, push as is
        if (/^<h[1-4]>|^<a\s|^<ul>|^<ol>|^<li>/.test(trimmed)) {
          result.push(line);
        } else {
          result.push(`<p>${line}</p>`);
        }
      } else {
        result.push("");
      }
    }
  }

  if (inBullet) result.push("</ul>");
  if (inOrdered) result.push("</ol>");

  return result.join("\n");
}

function htmlToMarkdown(html: string): string {
  if (!html) return "";
  let md = html;

  // Pre-strip paragraph tags inside list items to avoid double paragraph conversion
  md = md.replace(/<li>\s*<p>([\s\S]*?)<\/p>\s*<\/li>/gi, "<li>$1</li>");

  // Convert headings
  md = md.replace(/<h1>(.*?)<\/h1>/gi, "# $1\n");
  md = md.replace(/<h2>(.*?)<\/h2>/gi, "## $1\n");
  md = md.replace(/<h3>(.*?)<\/h3>/gi, "### $1\n");
  md = md.replace(/<h4>(.*?)<\/h4>/gi, "#### $1\n");

  // Convert paragraphs
  md = md.replace(/<p>(.*?)<\/p>/gi, "$1\n");

  // Convert bullet lists
  md = md.replace(/<ul>([\s\S]*?)<\/ul>/gi, (_, listContent) => {
    return listContent.replace(/<li>(.*?)<\/li>/gi, "- $1\n") + "\n";
  });

  // Convert ordered lists
  md = md.replace(/<ol>([\s\S]*?)<\/ol>/gi, (_, listContent) => {
    let index = 1;
    return listContent.replace(/<li>(.*?)<\/li>/gi, () => {
      return `${index++}. $1\n`;
    }) + "\n";
  });

  // Inline styles
  md = md.replace(/<strong>(.*?)<\/strong>/gi, "**$1**");
  md = md.replace(/<b>(.*?)<\/b>/gi, "**$1**");
  md = md.replace(/<em>(.*?)<\/em>/gi, "*$1*");
  md = md.replace(/<i>(.*?)<\/i>/gi, "*$1*");

  // Links
  md = md.replace(/<a\s+href="([^"]+)"[^>]*>(.*?)<\/a>/gi, "[$2]($1)");

  // Clean up remaining tags
  md = md.replace(/<[^>]+>/g, "");

  // Clean up excess newlines
  md = md.replace(/\n{3,}/g, "\n\n");

  return md.trim();
}

// ─── Component ───────────────────────────────────────────────────────────────

export function MarkdownEditor({
  value,
  onChange,
  placeholder,
  rows = 12,
  className,
}: MarkdownEditorProps) {
  const minHeight = `${Math.max(rows * 1.6, 12)}rem`;

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3, 4],
        },
      }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: "text-primary underline cursor-pointer",
        },
      }),
      Placeholder.configure({
        placeholder: placeholder ?? "Start writing your privacy policy here…",
      }),
    ],
    content: markdownToHtml(value),
    editorProps: {
      attributes: {
        class: cn(
          "prose prose-sm dark:prose-invert max-w-none focus:outline-none cursor-text",
          "min-h-[300px] px-4 py-3 leading-relaxed",
          "[&_ul]:list-disc [&_ul]:pl-5",
          "[&_ol]:list-decimal [&_ol]:pl-5",
          "[&_li]:text-foreground [&_li]:marker:text-foreground [&_li_p]:my-0"
        ),
      },
    },
    onUpdate: ({ editor }) => {
      const html = editor.getHTML();
      const markdown = htmlToMarkdown(html);
      onChange(markdown);
    },
  });

  // Sync value from parent if it changes
  useEffect(() => {
    if (!editor) return;
    const currentHtml = editor.getHTML();
    const targetHtml = markdownToHtml(value);
    if (currentHtml !== targetHtml && htmlToMarkdown(currentHtml) !== value) {
      editor.commands.setContent(targetHtml);
    }
  }, [value, editor]);

  if (!editor) {
    return null;
  }

  const setLink = () => {
    const previousUrl = editor.getAttributes("link").href;
    const url = window.prompt("Enter URL:", previousUrl || "https://");
    if (url === null) return;
    if (url === "") {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
  };

  return (
    <div
      className={cn(
        "rounded-md border border-input bg-background overflow-hidden flex flex-col focus-within:ring-1 focus-within:ring-ring focus-within:border-ring",
        className
      )}
    >
      {/* Toolbar */}
      <div className="flex items-center gap-0.5 px-2.5 py-1.5 border-b border-input bg-muted/40 flex-wrap sticky top-0 z-10">
        <Tooltip>
          <TooltipTrigger asChild>
            <Toggle
              size="sm"
              className="h-7 w-7 p-0"
              pressed={editor.isActive("heading", { level: 1 })}
              onPressedChange={() =>
                editor.chain().focus().toggleHeading({ level: 1 }).run()
              }
              aria-label="Heading 1"
            >
              <Heading1 className="h-4 w-4" />
            </Toggle>
          </TooltipTrigger>
          <TooltipContent side="bottom">Heading 1</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Toggle
              size="sm"
              className="h-7 w-7 p-0"
              pressed={editor.isActive("heading", { level: 2 })}
              onPressedChange={() =>
                editor.chain().focus().toggleHeading({ level: 2 }).run()
              }
              aria-label="Heading 2"
            >
              <Heading2 className="h-4 w-4" />
            </Toggle>
          </TooltipTrigger>
          <TooltipContent side="bottom">Heading 2</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Toggle
              size="sm"
              className="h-7 w-7 p-0"
              pressed={editor.isActive("heading", { level: 3 })}
              onPressedChange={() =>
                editor.chain().focus().toggleHeading({ level: 3 }).run()
              }
              aria-label="Heading 3"
            >
              <Heading3 className="h-4 w-4" />
            </Toggle>
          </TooltipTrigger>
          <TooltipContent side="bottom">Heading 3</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Toggle
              size="sm"
              className="h-7 w-7 p-0"
              pressed={editor.isActive("heading", { level: 4 })}
              onPressedChange={() =>
                editor.chain().focus().toggleHeading({ level: 4 }).run()
              }
              aria-label="Heading 4"
            >
              <Heading4 className="h-4 w-4" />
            </Toggle>
          </TooltipTrigger>
          <TooltipContent side="bottom">Heading 4</TooltipContent>
        </Tooltip>

        <Separator orientation="vertical" className="h-5 mx-1" />

        <Tooltip>
          <TooltipTrigger asChild>
            <Toggle
              size="sm"
              className="h-7 w-7 p-0"
              pressed={editor.isActive("bold")}
              onPressedChange={() => editor.chain().focus().toggleBold().run()}
              aria-label="Bold"
            >
              <Bold className="h-3.5 w-3.5" />
            </Toggle>
          </TooltipTrigger>
          <TooltipContent side="bottom">Bold</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Toggle
              size="sm"
              className="h-7 w-7 p-0"
              pressed={editor.isActive("italic")}
              onPressedChange={() => editor.chain().focus().toggleItalic().run()}
              aria-label="Italic"
            >
              <Italic className="h-3.5 w-3.5" />
            </Toggle>
          </TooltipTrigger>
          <TooltipContent side="bottom">Italic</TooltipContent>
        </Tooltip>

        <Separator orientation="vertical" className="h-5 mx-1" />

        <Tooltip>
          <TooltipTrigger asChild>
            <Toggle
              size="sm"
              className="h-7 w-7 p-0"
              pressed={editor.isActive("bulletList")}
              onPressedChange={() =>
                editor.chain().focus().toggleBulletList().run()
              }
              aria-label="Bullet list"
            >
              <List className="h-3.5 w-3.5" />
            </Toggle>
          </TooltipTrigger>
          <TooltipContent side="bottom">Bullet list</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Toggle
              size="sm"
              className="h-7 w-7 p-0"
              pressed={editor.isActive("orderedList")}
              onPressedChange={() =>
                editor.chain().focus().toggleOrderedList().run()
              }
              aria-label="Numbered list"
            >
              <ListOrdered className="h-3.5 w-3.5" />
            </Toggle>
          </TooltipTrigger>
          <TooltipContent side="bottom">Numbered list</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Toggle
              size="sm"
              className="h-7 w-7 p-0"
              pressed={editor.isActive("link")}
              onPressedChange={setLink}
              aria-label="Insert link"
            >
              <Link2 className="h-3.5 w-3.5" />
            </Toggle>
          </TooltipTrigger>
          <TooltipContent side="bottom">Insert link</TooltipContent>
        </Tooltip>
      </div>

      {/* Editor Content Area */}
      <div
        className="flex-1 overflow-y-auto"
        style={{ minHeight }}
        onClick={() => editor.commands.focus()}
      >
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}
