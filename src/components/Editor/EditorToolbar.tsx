import { IconButton } from '@carbon/react'
import {
  TextBold,
  TextItalic,
  TextStrikethrough,
  Code,
  Heading,
  ListBulleted,
  ListNumbered,
  Quotes,
  Terminal,
  SubtractAlt,
  Table,
  Undo,
  Redo,
} from '@carbon/icons-react'
import type { Editor } from '@tiptap/react'
import styles from './styles.module.scss'

interface EditorToolbarProps {
  editor: Editor | null
}

export function EditorToolbar({ editor }: EditorToolbarProps) {
  if (!editor) return null

  return (
    <div className={styles.toolbarLeft}>
      {/* Text Formatting */}
      <div className={styles.toolbarSection}>
        <IconButton
          label="Bold"
          kind={editor.isActive('bold') ? 'primary' : 'ghost'}
          size="sm"
          onClick={() => editor.chain().focus().toggleBold().run()}
        >
          <TextBold />
        </IconButton>
        <IconButton
          label="Italic"
          kind={editor.isActive('italic') ? 'primary' : 'ghost'}
          size="sm"
          onClick={() => editor.chain().focus().toggleItalic().run()}
        >
          <TextItalic />
        </IconButton>
        <IconButton
          label="Strikethrough"
          kind={editor.isActive('strike') ? 'primary' : 'ghost'}
          size="sm"
          onClick={() => editor.chain().focus().toggleStrike().run()}
        >
          <TextStrikethrough />
        </IconButton>
        <IconButton
          label="Inline Code"
          kind={editor.isActive('code') ? 'primary' : 'ghost'}
          size="sm"
          onClick={() => editor.chain().focus().toggleCode().run()}
        >
          <Code />
        </IconButton>
      </div>

      {/* Headings */}
      <div className={styles.toolbarSection}>
        <IconButton
          label="Heading 1"
          kind={editor.isActive('heading', { level: 1 }) ? 'primary' : 'ghost'}
          size="sm"
          onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
        >
          <Heading size={20} />
        </IconButton>
        <IconButton
          label="Heading 2"
          kind={editor.isActive('heading', { level: 2 }) ? 'primary' : 'ghost'}
          size="sm"
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        >
          <Heading size={18} />
        </IconButton>
        <IconButton
          label="Heading 3"
          kind={editor.isActive('heading', { level: 3 }) ? 'primary' : 'ghost'}
          size="sm"
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
        >
          <Heading size={16} />
        </IconButton>
      </div>

      {/* Blocks */}
      <div className={styles.toolbarSection}>
        <IconButton
          label="Bullet List"
          kind={editor.isActive('bulletList') ? 'primary' : 'ghost'}
          size="sm"
          onClick={() => editor.chain().focus().toggleBulletList().run()}
        >
          <ListBulleted />
        </IconButton>
        <IconButton
          label="Numbered List"
          kind={editor.isActive('orderedList') ? 'primary' : 'ghost'}
          size="sm"
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
        >
          <ListNumbered />
        </IconButton>
        <IconButton
          label="Blockquote"
          kind={editor.isActive('blockquote') ? 'primary' : 'ghost'}
          size="sm"
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
        >
          <Quotes />
        </IconButton>
        <IconButton
          label="Code Block"
          kind={editor.isActive('codeBlock') ? 'primary' : 'ghost'}
          size="sm"
          onClick={() => editor.chain().focus().toggleCodeBlock().run()}
        >
          <Terminal />
        </IconButton>
        <IconButton
          label="Horizontal Rule"
          kind="ghost"
          size="sm"
          onClick={() => editor.chain().focus().setHorizontalRule().run()}
        >
          <SubtractAlt />
        </IconButton>
        <IconButton
          label="Insert Table"
          kind={editor.isActive('table') ? 'primary' : 'ghost'}
          size="sm"
          onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}
        >
          <Table />
        </IconButton>
      </div>

      {/* History */}
      <div className={styles.toolbarSection}>
        <IconButton label="Undo" kind="ghost" size="sm" onClick={() => editor.chain().focus().undo().run()}>
          <Undo />
        </IconButton>
        <IconButton label="Redo" kind="ghost" size="sm" onClick={() => editor.chain().focus().redo().run()}>
          <Redo />
        </IconButton>
      </div>
    </div>
  )
}
