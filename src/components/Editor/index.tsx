import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import { ContentSwitcher, Switch } from '@carbon/react'
import { SlashCommand } from '@/extensions/SlashCommand'
import { AskAIExtension } from '@/extensions/AskAI'
import { PredictiveText, setPredictiveTextContext } from '@/extensions/PredictiveText'
import { SlashMenu } from '@/components/SlashMenu'
import { AskAI } from '@/components/AskAI'
import { useWebLLM } from '@/context/WebLLMContext'
import { useState, useCallback, useEffect, useRef } from 'react'
import { generateMarkdown, parseMarkdown } from '@/utils/markdown'
import './styles.css'

type ViewMode = 'editor' | 'html' | 'markdown'

export function Editor() {
  const [showAskAI, setShowAskAI] = useState(false)
  const [viewMode, setViewMode] = useState<ViewMode>('editor')
  const [htmlContent, setHtmlContent] = useState('')
  const [markdownContent, setMarkdownContent] = useState('')
  const previousMode = useRef<ViewMode>('editor')
  const webLLM = useWebLLM()

  useEffect(() => {
    setPredictiveTextContext({
      generateCompletion: webLLM.generateCompletion,
      isReady: webLLM.isReady,
    })
  }, [webLLM.generateCompletion, webLLM.isReady])

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3],
        },
      }),
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

  const handleAskAIClose = useCallback(() => {
    setShowAskAI(false)
    editor?.commands.focus()
  }, [editor])

  const handleAskAISubmit = useCallback((text: string) => {
    if (editor) {
      const { from, to } = editor.state.selection
      if (from !== to) {
        editor.chain().focus().deleteSelection().insertContent(text).run()
      } else {
        editor.chain().focus().insertContent(text).run()
      }
    }
    setShowAskAI(false)
  }, [editor])

  const handleViewModeChange = useCallback((e: { index?: number }) => {
    const modes: ViewMode[] = ['editor', 'html', 'markdown']
    const newMode = modes[e.index ?? 0]

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
  }, [editor, htmlContent, markdownContent])

  return (
    <div className="editor-wrapper">
      <div className="editor-toolbar">
        <ContentSwitcher
          onChange={handleViewModeChange}
          selectedIndex={['editor', 'html', 'markdown'].indexOf(viewMode)}
          size="sm"
        >
          <Switch name="editor" text="Editor" />
          <Switch name="html" text="HTML" />
          <Switch name="markdown" text="Markdown" />
        </ContentSwitcher>
      </div>

      <div className="editor-container">
        {viewMode === 'editor' && (
          <EditorContent editor={editor} />
        )}

        {viewMode === 'html' && (
          <textarea
            className="code-editor"
            value={htmlContent}
            onChange={(e) => setHtmlContent(e.target.value)}
            spellCheck={false}
          />
        )}

        {viewMode === 'markdown' && (
          <textarea
            className="code-editor"
            value={markdownContent}
            onChange={(e) => setMarkdownContent(e.target.value)}
            spellCheck={false}
          />
        )}
      </div>

      {showAskAI && (
        <AskAI
          onClose={handleAskAIClose}
          onSubmit={handleAskAISubmit}
          selectedText={editor?.state.doc.textBetween(
            editor.state.selection.from,
            editor.state.selection.to,
            ' '
          )}
        />
      )}
    </div>
  )
}
