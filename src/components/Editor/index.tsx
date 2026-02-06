import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import { SlashCommand } from '@/extensions/SlashCommand'
import { AskAIExtension } from '@/extensions/AskAI'
import { PredictiveText, setPredictiveTextContext } from '@/extensions/PredictiveText'
import { SlashMenu } from '@/components/SlashMenu'
import { AskAI } from '@/components/AskAI'
import { useWebLLM } from '@/context/WebLLMContext'
import { useState, useCallback, useEffect } from 'react'
import './styles.css'

export function Editor() {
  const [showAskAI, setShowAskAI] = useState(false)
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

  return (
    <div className="editor-wrapper">
      <div className="editor-container">
        <EditorContent editor={editor} />
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
