import { type Editor, type Range } from '@tiptap/core'
import type { SuggestionOptions } from '@tiptap/suggestion'

export interface SlashCommandItem {
  title: string
  description: string
  icon: string
  command: (editor: Editor, range: Range) => void
}

export const slashCommands: SlashCommandItem[] = [
  {
    title: 'Heading 1',
    description: 'Large section heading',
    icon: 'H1',
    command: (editor, range) => {
      editor.chain().focus().deleteRange(range).setNode('heading', { level: 1 }).run()
    },
  },
  {
    title: 'Heading 2',
    description: 'Medium section heading',
    icon: 'H2',
    command: (editor, range) => {
      editor.chain().focus().deleteRange(range).setNode('heading', { level: 2 }).run()
    },
  },
  {
    title: 'Heading 3',
    description: 'Small section heading',
    icon: 'H3',
    command: (editor, range) => {
      editor.chain().focus().deleteRange(range).setNode('heading', { level: 3 }).run()
    },
  },
  {
    title: 'Bullet List',
    description: 'Create a simple bullet list',
    icon: '•',
    command: (editor, range) => {
      editor.chain().focus().deleteRange(range).toggleBulletList().run()
    },
  },
  {
    title: 'Numbered List',
    description: 'Create a numbered list',
    icon: '1.',
    command: (editor, range) => {
      editor.chain().focus().deleteRange(range).toggleOrderedList().run()
    },
  },
  {
    title: 'Code Block',
    description: 'Add a code block',
    icon: '</>',
    command: (editor, range) => {
      editor.chain().focus().deleteRange(range).toggleCodeBlock().run()
    },
  },
  {
    title: 'Quote',
    description: 'Add a blockquote',
    icon: '"',
    command: (editor, range) => {
      editor.chain().focus().deleteRange(range).toggleBlockquote().run()
    },
  },
  {
    title: 'Divider',
    description: 'Add a horizontal divider',
    icon: '—',
    command: (editor, range) => {
      editor.chain().focus().deleteRange(range).setHorizontalRule().run()
    },
  },
]

export function getSuggestionItems({ query }: { query: string }): SlashCommandItem[] {
  return slashCommands.filter((item) =>
    item.title.toLowerCase().includes(query.toLowerCase())
  )
}

export const suggestionConfig: Omit<SuggestionOptions<SlashCommandItem>, 'editor'> = {
  items: getSuggestionItems,
  char: '/',
  startOfLine: false,
}
