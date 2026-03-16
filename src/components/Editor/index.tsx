import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import { Table as TableExtension } from '@tiptap/extension-table'
import { TableRow } from '@tiptap/extension-table-row'
import { TableHeader } from '@tiptap/extension-table-header'
import { TableCell } from '@tiptap/extension-table-cell'
import { SlashCommand } from '@/extensions/SlashCommand'
import { AskAIExtension } from '@/extensions/AskAI'
import { PredictiveText, setPredictiveTextContext } from '@/extensions/PredictiveText'
import { SlashMenu } from '@/components/SlashMenu'
import { AskAIPopover } from '@/components/AskAI/AskAIPopover'
import { EditorToolbar } from './EditorToolbar'
import { ViewModeSwitcher } from './ViewModeSwitcher'
import { useWebLLM } from '@/context/WebLLMContext'
import { useViewMode } from '@/hooks/useViewMode'
import { useState, useCallback, useEffect } from 'react'
import SimpleCodeEditor from 'react-simple-code-editor'
import hljs from 'highlight.js/lib/core'
import 'highlight.js/styles/github-dark.css'
import styles from './styles.module.scss'

export function Editor() {
  const [showAskAI, setShowAskAI] = useState(false)
  const webLLM = useWebLLM()

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
      }),
      TableExtension.configure({ resizable: true }),
      TableRow,
      TableHeader,
      TableCell,
      Placeholder.configure({
        placeholder: 'Type / for commands, or start writing...',
      }),
      SlashCommand.configure({
        suggestion: {
          render: () => {
            let component: SlashMenu | null = null
            let popup: HTMLElement | null = null

            return {
              onStart: (props) => {
                popup = document.createElement('div')
                popup.className = 'slash-menu-container'
                document.body.appendChild(popup)

                import('@/components/SlashMenu').then(({ renderSlashMenu }) => {
                  if (popup) {
                    component = renderSlashMenu(popup, props)
                  }
                })
              },
              onUpdate: (props) => {
                component?.updateProps(props)
              },
              onKeyDown: (props) => {
                if (props.event.key === 'Escape') {
                  popup?.remove()
                  return true
                }
                return component?.onKeyDown(props) ?? false
              },
              onExit: () => {
                popup?.remove()
                component = null
              },
            }
          },
        },
      }),
      AskAIExtension.configure({
        onActivate: () => setShowAskAI(true),
      }),
      PredictiveText,
    ],
    content: '',
    editorProps: {
      attributes: {
        class: 'tiptap',
      },
    },
  })

  const { viewMode, htmlContent, markdownContent, setHtmlContent, setMarkdownContent, handleViewModeChange } =
    useViewMode(editor)

  const handleAskAIClose = useCallback(() => {
    setShowAskAI(false)
    editor?.commands.focus()
  }, [editor])

  const handleAskAISubmit = useCallback(
    (text: string) => {
      if (editor) {
        const { from, to } = editor.state.selection
        if (from !== to) {
          editor.chain().focus().deleteSelection().insertContent(text).run()
        } else {
          editor.chain().focus().insertContent(text).run()
        }
      }
      setShowAskAI(false)
    },
    [editor]
  )

  useEffect(() => {
    setPredictiveTextContext({
      predictiveComplete: webLLM.generateCompletion,
      ready: webLLM.isReady,
    })
  }, [webLLM.generateCompletion, webLLM.isReady])

  return (
    <div className={styles.editorWrapper}>
      <div className={styles.editorToolbar}>
        <EditorToolbar editor={editor} />
        <ViewModeSwitcher value={viewMode} onChange={handleViewModeChange} />
      </div>

      <div className={styles.editorContainer}>
        {viewMode === 'editor' && <EditorContent editor={editor} />}

        {viewMode === 'html' && (
          // NOTE:implement this html and markdown in tiptap editor itself as separate extensions.
          // so we can reuse the same editor instance and avoid syncing content between different editors
          <SimpleCodeEditor
            value={htmlContent}
            onValueChange={setHtmlContent}
            highlight={(code) => hljs.highlight(code, { language: 'html' }).value}
            padding={16}
            className={styles.codeEditor}
            style={{
              fontFamily: 'IBM Plex Mono, monospace',
              fontSize: '0.875rem',
              lineHeight: 1.6,
              minHeight: '400px',
            }}
          />
        )}

        {viewMode === 'markdown' && (
          // NOTE:implement this html and markdown in tiptap editor itself as separate extensions.
          // so we can reuse the same editor instance and avoid syncing content between different editors
          <SimpleCodeEditor
            value={markdownContent}
            onValueChange={setMarkdownContent}
            highlight={(code) => hljs.highlight(code, { language: 'markdown' }).value}
            padding={16}
            className={styles.codeEditor}
            style={{
              fontFamily: 'IBM Plex Mono, monospace',
              fontSize: '0.875rem',
              lineHeight: 1.6,
              minHeight: '400px',
            }}
          />
        )}

        {showAskAI && editor && (
          <AskAIPopover
            editor={editor}
            onClose={handleAskAIClose}
            onSubmit={handleAskAISubmit}
            selectedText={editor.state.doc.textBetween(editor.state.selection.from, editor.state.selection.to, ' ')}
          />
        )}
      </div>
    </div>
  )
}
