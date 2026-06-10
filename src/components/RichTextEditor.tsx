import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import TextAlign from '@tiptap/extension-text-align';
import { TextStyle } from '@tiptap/extension-text-style';
import FontFamily from '@tiptap/extension-font-family';
import Color from '@tiptap/extension-color';
import Highlight from '@tiptap/extension-highlight';
import Paragraph from '@tiptap/extension-paragraph';
import { DOMParser as ProseMirrorDOMParser } from '@tiptap/pm/model';
import { useEffect, useCallback, useState } from 'react';
import {
  Bold, Italic, Underline as UnderlineIcon, AlignLeft, AlignCenter, AlignRight, AlignJustify,
  Type, List, ListOrdered, Undo2, Redo2, Minus, Highlighter, Strikethrough, Subscript, Superscript,
  IndentDecrease, IndentIncrease, BookOpen, Plus, X, ChevronsUpDown
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';

const FONTS = [
  { label: 'Calibri', value: 'Calibri, sans-serif' },
  { label: 'Times New Roman', value: 'Times New Roman, serif' },
  { label: 'Arial', value: 'Arial, sans-serif' },
  { label: 'Helvetica', value: 'Helvetica, sans-serif' },
  { label: 'Georgia', value: 'Georgia, serif' },
  { label: 'Roboto', value: 'Roboto, sans-serif' },
  { label: 'Verdana', value: 'Verdana, sans-serif' },
];

const FONT_SIZES = ['8px', '9px', '10px', '11px', '12px', '14px', '16px', '18px', '20px', '24px', '28px', '36px'];

const LINE_SPACINGS = [
  { label: '1.0', value: '1' },
  { label: '1.15', value: '1.15' },
  { label: '1.5', value: '1.5' },
  { label: '2.0', value: '2' },
  { label: '2.5', value: '2.5' },
  { label: '3.0', value: '3' },
];

// Helper: convert pt/em/rem to px for consistency
function normalizeFontSize(value: string | null): string | null {
  if (!value) return null;
  const trimmed = value.trim().toLowerCase();
  const num = parseFloat(trimmed);
  if (isNaN(num)) return null;
  if (trimmed.endsWith('pt')) return `${Math.round(num * 1.333)}px`;
  if (trimmed.endsWith('em') || trimmed.endsWith('rem')) return `${Math.round(num * 16)}px`;
  if (trimmed.endsWith('px')) return `${Math.round(num)}px`;
  if (!trimmed.match(/[a-z%]/)) return `${Math.round(num)}px`;
  return value;
}

// Custom FontSize extension — parses pt/em/px from pasted content
const FontSize = TextStyle.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      fontSize: {
        default: null,
        parseHTML: element => normalizeFontSize(element.style.fontSize),
        renderHTML: attributes => {
          if (!attributes.fontSize) return {};
          return { style: `font-size: ${attributes.fontSize}` };
        },
      },
    };
  },
});

// Custom LineHeight extension on Paragraph
const LineHeightParagraph = Paragraph.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      lineHeight: {
        default: null,
        parseHTML: element => element.style.lineHeight || null,
        renderHTML: attributes => {
          if (!attributes.lineHeight) return {};
          return { style: `line-height: ${attributes.lineHeight}` };
        },
      },
    };
  },
});

// Clean Word/Office HTML while preserving formatting
function cleanWordHtml(html: string): string {
  let cleaned = html
    .replace(/<o:p[^>]*>[\s\S]*?<\/o:p>/gi, '')
    .replace(/<\/?o:[^>]*>/gi, '')
    .replace(/<\/?w:[^>]*>/gi, '')
    .replace(/<\/?m:[^>]*>/gi, '')
    .replace(/<\/?st1:[^>]*>/gi, '')
    .replace(/<!--\[if[^]*?endif\]-->/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<\/?xml[^>]*>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<meta[^>]*\/?>/gi, '')
    .replace(/<link[^>]*\/?>/gi, '')
    .replace(/<title[^>]*>[\s\S]*?<\/title>/gi, '')
    .replace(/class="[^"]*"/gi, '')
    .replace(/lang="[^"]*"/gi, '')
    .replace(/\bmso-[^;:"]+:[^;"]+;?/gi, '')
    .replace(/\bmargin[^;:"]*:\s*0[^;]*;?/gi, '');

  // Convert <b> to <strong>, <i> to <em>
  cleaned = cleaned
    .replace(/<b(\s|>)/gi, '<strong$1')
    .replace(/<\/b>/gi, '</strong>')
    .replace(/<i(\s|>)/gi, '<em$1')
    .replace(/<\/i>/gi, '</em>');

  // Remove empty spans without style
  cleaned = cleaned.replace(/<span(?![^>]*style)[^>]*>([\s\S]*?)<\/span>/gi, '$1');

  // Clean empty style attributes
  cleaned = cleaned.replace(/\sstyle="\s*"/gi, '');

  return cleaned;
}

// Clean HTML from PDF viewers, Google Docs, and other non-Word sources
// Preserves font-size, font-weight, font-style, text-decoration, text-align, color
function cleanGenericHtml(html: string): string {
  let cleaned = html
    // Remove meta/link/style/title tags
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<meta[^>]*\/?>/gi, '')
    .replace(/<link[^>]*\/?>/gi, '')
    .replace(/<title[^>]*>[\s\S]*?<\/title>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '');

  // Convert <b> to <strong>, <i> to <em>
  cleaned = cleaned
    .replace(/<b(\s|>)/gi, '<strong$1')
    .replace(/<\/b>/gi, '</strong>')
    .replace(/<i(\s|>)/gi, '<em$1')
    .replace(/<\/i>/gi, '</em>');

  // Keep only relevant style properties from inline styles
  cleaned = cleaned.replace(/style="([^"]*)"/gi, (_, styleStr: string) => {
    const allowedProps = ['font-size', 'font-weight', 'font-style', 'font-family',
      'text-decoration', 'text-align', 'color', 'background-color', 'line-height'];
    const kept: string[] = [];
    for (const prop of allowedProps) {
      const regex = new RegExp(`${prop}\\s*:\\s*([^;]+)`, 'i');
      const match = styleStr.match(regex);
      if (match) {
        let value = match[1].trim();
        // Normalize font-size units
        if (prop === 'font-size') {
          const normalized = normalizeFontSize(value);
          if (normalized) value = normalized;
        }
        kept.push(`${prop}: ${value}`);
      }
    }
    return kept.length > 0 ? `style="${kept.join('; ')}"` : '';
  });

  // Remove class attributes
  cleaned = cleaned.replace(/\s+class="[^"]*"/gi, '');

  // Clean empty style attributes
  cleaned = cleaned.replace(/\sstyle="\s*"/gi, '');

  // Remove empty spans without style
  cleaned = cleaned.replace(/<span(?![^>]*style)[^>]*>([\s\S]*?)<\/span>/gi, '$1');

  return cleaned;
}

const CUSTOM_DICT_KEY = 'custom-dictionary-es';

function getCustomDictionary(): string[] {
  try {
    const stored = localStorage.getItem(CUSTOM_DICT_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch { return []; }
}

function addToCustomDictionary(word: string) {
  const dict = getCustomDictionary();
  const normalized = word.trim().toLowerCase();
  if (normalized && !dict.includes(normalized)) {
    dict.push(normalized);
    localStorage.setItem(CUSTOM_DICT_KEY, JSON.stringify(dict));
  }
}

function removeFromCustomDictionary(word: string) {
  const dict = getCustomDictionary().filter(w => w !== word.trim().toLowerCase());
  localStorage.setItem(CUSTOM_DICT_KEY, JSON.stringify(dict));
}

interface RichTextEditorProps {
  content: string;
  onChange: (html: string) => void;
  disabled?: boolean;
  placeholder?: string;
}

const RichTextEditor = ({ content, onChange, disabled = false, placeholder }: RichTextEditorProps) => {
  const [showDictionary, setShowDictionary] = useState(false);
  const [newWord, setNewWord] = useState('');
  const [customWords, setCustomWords] = useState<string[]>(getCustomDictionary());

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: false,
        paragraph: false,
        bulletList: { keepMarks: true },
        orderedList: { keepMarks: true },
      }),
      LineHeightParagraph,
      Underline,
      TextAlign.configure({ types: ['paragraph'] }),
      FontSize,
      FontFamily,
      Color,
      Highlight.configure({ multicolor: true }),
    ],
    content: content || '',
    editable: !disabled,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
    editorProps: {
      handlePaste(view, event) {
        const clipboardData = event.clipboardData;
        if (!clipboardData) return false;

        const html = clipboardData.getData('text/html');
        if (!html || html.trim().length <= 10) {
          return false;
        }

        const bodyMatch = html.match(/<body[^>]*>([\s\S]*)<\/body>/i);
        const content = bodyMatch ? bodyMatch[1] : html;
        const isWordContent = /class="?Mso|style="[^"]*mso-|<o:p|xmlns:w=|xmlns:o=/i.test(html);
        const cleanedHtml = isWordContent ? cleanWordHtml(content) : cleanGenericHtml(content);

        if (!cleanedHtml.trim()) {
          return false;
        }

        event.preventDefault();

        const wrapper = document.createElement('div');
        wrapper.innerHTML = cleanedHtml;
        const parser = ProseMirrorDOMParser.fromSchema(view.state.schema);
        const slice = parser.parseSlice(wrapper, {
          preserveWhitespace: 'full',
        });

        const transaction = view.state.tr.replaceSelection(slice).scrollIntoView();
        view.dispatch(transaction);
        return true;
      },
      transformPastedHTML(html) {
        const bodyMatch = html.match(/<body[^>]*>([\s\S]*)<\/body>/i);
        const content = bodyMatch ? bodyMatch[1] : html;
        const isWordContent = /class="?Mso|style="[^"]*mso-|<o:p|xmlns:w=|xmlns:o=/i.test(html);
        return isWordContent ? cleanWordHtml(content) : cleanGenericHtml(content);
      },
    },
  });

  useEffect(() => {
    if (editor && content !== editor.getHTML()) {
      editor.commands.setContent(content || '');
    }
  }, [content]);

  useEffect(() => {
    if (editor) {
      editor.setEditable(!disabled);
    }
  }, [disabled, editor]);

  const setFontSize = useCallback((size: string) => {
    if (!editor) return;
    editor.chain().focus().setMark('textStyle', { fontSize: size }).run();
  }, [editor]);

  const handleAddWord = () => {
    if (newWord.trim()) {
      addToCustomDictionary(newWord.trim());
      setCustomWords(getCustomDictionary());
      setNewWord('');
      toast.success(`"${newWord.trim()}" agregada al diccionario`);
    }
  };

  const handleRemoveWord = (word: string) => {
    removeFromCustomDictionary(word);
    setCustomWords(getCustomDictionary());
    toast.success(`"${word}" eliminada del diccionario`);
  };

  if (!editor) return null;

  return (
    <div className="border border-border rounded-lg overflow-hidden bg-background">
      {!disabled && (
        <div className="flex flex-wrap items-center gap-0.5 p-1.5 border-b border-border bg-muted/30">
          {/* Undo / Redo */}
          <Button type="button" variant="ghost" size="sm" className="h-7 w-7 p-0"
            onClick={() => editor.chain().focus().undo().run()}
            disabled={!editor.can().undo()}
            title="Deshacer"
          >
            <Undo2 className="w-3.5 h-3.5" />
          </Button>
          <Button type="button" variant="ghost" size="sm" className="h-7 w-7 p-0"
            onClick={() => editor.chain().focus().redo().run()}
            disabled={!editor.can().redo()}
            title="Rehacer"
          >
            <Redo2 className="w-3.5 h-3.5" />
          </Button>

          <div className="w-px h-5 bg-border mx-0.5" />

          {/* Font family */}
          <Select
            value={editor.getAttributes('textStyle').fontFamily || 'Calibri, sans-serif'}
            onValueChange={(v) => editor.chain().focus().setFontFamily(v).run()}
          >
            <SelectTrigger className="w-[110px] h-7 text-xs">
              <Type className="w-3 h-3 mr-1" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {FONTS.map(f => (
                <SelectItem key={f.value} value={f.value} style={{ fontFamily: f.value }}>
                  {f.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Font size */}
          <Select
            value={editor.getAttributes('textStyle').fontSize || '14px'}
            onValueChange={setFontSize}
          >
            <SelectTrigger className="w-[60px] h-7 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {FONT_SIZES.map(s => (
                <SelectItem key={s} value={s}>{s.replace('px', '')}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Line spacing */}
          <Select
            value={editor.getAttributes('paragraph').lineHeight || '1.5'}
            onValueChange={(v) => editor.chain().focus().updateAttributes('paragraph', { lineHeight: v }).run()}
          >
            <SelectTrigger className="w-[60px] h-7 text-xs" title="Interlineado">
              <ChevronsUpDown className="w-3 h-3 mr-0.5" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {LINE_SPACINGS.map(ls => (
                <SelectItem key={ls.value} value={ls.value}>{ls.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="w-px h-5 bg-border mx-0.5" />

          {/* Bold/Italic/Underline/Strikethrough */}
          <Button type="button" variant="ghost" size="sm"
            className={`h-7 w-7 p-0 ${editor.isActive('bold') ? 'bg-accent' : ''}`}
            onClick={() => editor.chain().focus().toggleBold().run()}
            title="Negrita"
          >
            <Bold className="w-3.5 h-3.5" />
          </Button>
          <Button type="button" variant="ghost" size="sm"
            className={`h-7 w-7 p-0 ${editor.isActive('italic') ? 'bg-accent' : ''}`}
            onClick={() => editor.chain().focus().toggleItalic().run()}
            title="Cursiva"
          >
            <Italic className="w-3.5 h-3.5" />
          </Button>
          <Button type="button" variant="ghost" size="sm"
            className={`h-7 w-7 p-0 ${editor.isActive('underline') ? 'bg-accent' : ''}`}
            onClick={() => editor.chain().focus().toggleUnderline().run()}
            title="Subrayado"
          >
            <UnderlineIcon className="w-3.5 h-3.5" />
          </Button>
          <Button type="button" variant="ghost" size="sm"
            className={`h-7 w-7 p-0 ${editor.isActive('strike') ? 'bg-accent' : ''}`}
            onClick={() => editor.chain().focus().toggleStrike().run()}
            title="Tachado"
          >
            <Strikethrough className="w-3.5 h-3.5" />
          </Button>
          <Button type="button" variant="ghost" size="sm"
            className={`h-7 w-7 p-0 ${editor.isActive('highlight') ? 'bg-accent' : ''}`}
            onClick={() => editor.chain().focus().toggleHighlight({ color: '#fef08a' }).run()}
            title="Resaltar"
          >
            <Highlighter className="w-3.5 h-3.5" />
          </Button>

          <div className="w-px h-5 bg-border mx-0.5" />

          {/* Alignment */}
          <Button type="button" variant="ghost" size="sm"
            className={`h-7 w-7 p-0 ${editor.isActive({ textAlign: 'left' }) ? 'bg-accent' : ''}`}
            onClick={() => editor.chain().focus().setTextAlign('left').run()}
            title="Alinear izquierda"
          >
            <AlignLeft className="w-3.5 h-3.5" />
          </Button>
          <Button type="button" variant="ghost" size="sm"
            className={`h-7 w-7 p-0 ${editor.isActive({ textAlign: 'center' }) ? 'bg-accent' : ''}`}
            onClick={() => editor.chain().focus().setTextAlign('center').run()}
            title="Centrar"
          >
            <AlignCenter className="w-3.5 h-3.5" />
          </Button>
          <Button type="button" variant="ghost" size="sm"
            className={`h-7 w-7 p-0 ${editor.isActive({ textAlign: 'right' }) ? 'bg-accent' : ''}`}
            onClick={() => editor.chain().focus().setTextAlign('right').run()}
            title="Alinear derecha"
          >
            <AlignRight className="w-3.5 h-3.5" />
          </Button>
          <Button type="button" variant="ghost" size="sm"
            className={`h-7 w-7 p-0 ${editor.isActive({ textAlign: 'justify' }) ? 'bg-accent' : ''}`}
            onClick={() => editor.chain().focus().setTextAlign('justify').run()}
            title="Justificar"
          >
            <AlignJustify className="w-3.5 h-3.5" />
          </Button>

          <div className="w-px h-5 bg-border mx-0.5" />

          {/* Lists */}
          <Button type="button" variant="ghost" size="sm"
            className={`h-7 w-7 p-0 ${editor.isActive('bulletList') ? 'bg-accent' : ''}`}
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            title="Lista con viñetas"
          >
            <List className="w-3.5 h-3.5" />
          </Button>
          <Button type="button" variant="ghost" size="sm"
            className={`h-7 w-7 p-0 ${editor.isActive('orderedList') ? 'bg-accent' : ''}`}
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
            title="Lista numerada"
          >
            <ListOrdered className="w-3.5 h-3.5" />
          </Button>

          <div className="w-px h-5 bg-border mx-0.5" />

          {/* Horizontal Rule */}
          <Button type="button" variant="ghost" size="sm" className="h-7 w-7 p-0"
            onClick={() => editor.chain().focus().setHorizontalRule().run()}
            title="Línea horizontal"
          >
            <Minus className="w-3.5 h-3.5" />
          </Button>

          {/* Text color */}
          <input
            type="color"
            className="w-7 h-7 rounded cursor-pointer border border-border"
            value={editor.getAttributes('textStyle').color || '#000000'}
            onChange={(e) => editor.chain().focus().setColor(e.target.value).run()}
            title="Color de texto"
          />

          <div className="w-px h-5 bg-border mx-0.5" />

          {/* Custom Dictionary */}
          <Button type="button" variant="ghost" size="sm" className="h-7 px-1.5 text-xs gap-1"
            onClick={() => { setCustomWords(getCustomDictionary()); setShowDictionary(true); }}
            title="Diccionario personalizado"
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span className="hidden sm:inline text-[10px]">Diccionario</span>
          </Button>
        </div>
      )}

      {/* Editor area with Spanish spellcheck */}
      <EditorContent
        editor={editor}
        className="prose prose-sm max-w-none p-4 min-h-[200px] focus:outline-none [&_.ProseMirror]:outline-none [&_.ProseMirror]:min-h-[200px]"
        spellCheck
        lang="es"
      />

      {/* Custom Dictionary Dialog */}
      <Dialog open={showDictionary} onOpenChange={setShowDictionary}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-primary" />
              Diccionario Personalizado
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">
              Agregá palabras médicas o técnicas para que no se marquen como errores.
              El corrector del navegador se activa automáticamente en español.
            </p>
            <div className="flex gap-2">
              <Input
                value={newWord}
                onChange={(e) => setNewWord(e.target.value)}
                placeholder="Nueva palabra..."
                onKeyDown={(e) => e.key === 'Enter' && handleAddWord()}
                className="h-8 text-sm"
              />
              <Button size="sm" onClick={handleAddWord} className="h-8 px-3">
                <Plus className="w-3 h-3 mr-1" /> Agregar
              </Button>
            </div>
            {customWords.length > 0 ? (
              <div className="max-h-40 overflow-y-auto border border-border rounded-lg divide-y divide-border">
                {customWords.map(word => (
                  <div key={word} className="flex items-center justify-between px-3 py-1.5 text-sm">
                    <span>{word}</span>
                    <button onClick={() => handleRemoveWord(word)} className="text-destructive hover:text-destructive/80">
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground text-center py-3">
                No hay palabras personalizadas aún.
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setShowDictionary(false)}>Cerrar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default RichTextEditor;
