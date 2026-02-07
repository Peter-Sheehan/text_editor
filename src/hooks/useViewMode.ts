import { useState, useCallback, useRef } from 'react'
import type { Editor } from '@tiptap/react'
import { generateMarkdown, parseMarkdown } from '@/utils/markdown'

export type ViewMode = 'editor' | 'html' | 'markdown'

export function useViewMode(editor: Editor | null) {
  const [viewMode, setViewMode] = useState<ViewMode>('editor')
  const [htmlContent, setHtmlContent] = useState('')
  const [markdownContent, setMarkdownContent] = useState('')
  const previousMode = useRef<ViewMode>('editor')

  const handleViewModeChange = useCallback(
    (newMode: ViewMode) => {
      if (!editor) return

      // Apply changes from previous mode before switching
      if (previousMode.current === 'html' && newMode !== 'html') {
        editor.commands.setContent(htmlContent)
      } else if (previousMode.current === 'markdown' && newMode !== 'markdown') {
        const html = parseMarkdown(markdownContent)
        editor.commands.setContent(html)
      }

      // Update content for the new mode
      if (newMode === 'html') {
        setHtmlContent(editor.getHTML())
      } else if (newMode === 'markdown') {
        setMarkdownContent(generateMarkdown(editor.getJSON()))
      }

      previousMode.current = newMode
      setViewMode(newMode)
    },
    [editor, htmlContent, markdownContent]
  )

  return {
    viewMode,
    htmlContent,
    markdownContent,
    setHtmlContent,
    setMarkdownContent,
    handleViewModeChange,
  }
}
