import { Extension } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'

const predictiveTextKey = new PluginKey('predictiveText')

interface PredictiveTextState {
  suggestion: string | null
  position: number | null
}

let webLLMContext: {
  generateCompletion: (context: string) => Promise<string>
  isReady: boolean
} | null = null

export function setPredictiveTextContext(context: typeof webLLMContext) {
  webLLMContext = context
}

export const PredictiveText = Extension.create({
  name: 'predictiveText',

  addProseMirrorPlugins() {
    const editor = this.editor
    let debounceTimer: ReturnType<typeof setTimeout> | null = null
    let currentRequest: AbortController | null = null

    return [
      new Plugin({
        key: predictiveTextKey,

        state: {
          init(): PredictiveTextState {
            return { suggestion: null, position: null }
          },

          apply(tr, state): PredictiveTextState {
            const meta = tr.getMeta(predictiveTextKey)
            if (meta !== undefined) {
              return meta
            }
            if (tr.docChanged) {
              return { suggestion: null, position: null }
            }
            return state
          },
        },

        props: {
          decorations(state) {
            const pluginState = predictiveTextKey.getState(state) as PredictiveTextState
            if (!pluginState.suggestion || pluginState.position === null) {
              return DecorationSet.empty
            }

            const widget = Decoration.widget(
              pluginState.position,
              () => {
                const span = document.createElement('span')
                span.className = 'ghost-text'
                span.textContent = pluginState.suggestion
                return span
              },
              { side: 1 }
            )

            return DecorationSet.create(state.doc, [widget])
          },

          handleKeyDown(view, event) {
            const pluginState = predictiveTextKey.getState(view.state) as PredictiveTextState

            if (event.key === 'Tab' && pluginState.suggestion) {
              event.preventDefault()
              const { tr } = view.state
              tr.insertText(pluginState.suggestion, pluginState.position!)
              tr.setMeta(predictiveTextKey, { suggestion: null, position: null })
              view.dispatch(tr)
              return true
            }

            if (event.key === 'Escape' && pluginState.suggestion) {
              event.preventDefault()
              const { tr } = view.state
              tr.setMeta(predictiveTextKey, { suggestion: null, position: null })
              view.dispatch(tr)
              return true
            }

            return false
          },
        },

        view() {
          return {
            update(view, prevState) {
              if (!view.state.doc.eq(prevState.doc)) {
                if (debounceTimer) {
                  clearTimeout(debounceTimer)
                }
                if (currentRequest) {
                  currentRequest.abort()
                }

                const { tr } = view.state
                tr.setMeta(predictiveTextKey, { suggestion: null, position: null })
                view.dispatch(tr)

                debounceTimer = setTimeout(async () => {
                  if (!webLLMContext?.isReady) return

                  const { state } = view
                  const { from, empty } = state.selection

                  if (!empty) return

                  const textBefore = state.doc.textBetween(
                    Math.max(0, from - 500),
                    from,
                    '\n'
                  )

                  if (textBefore.trim().length < 5) return

                  currentRequest = new AbortController()

                  try {
                    const suggestion = await webLLMContext.generateCompletion(textBefore)

                    if (suggestion && suggestion.trim()) {
                      const currentPos = editor.state.selection.from
                      const { tr } = editor.view.state
                      tr.setMeta(predictiveTextKey, {
                        suggestion: suggestion.trim(),
                        position: currentPos,
                      })
                      editor.view.dispatch(tr)
                    }
                  } catch (err) {
                    if (err instanceof Error && err.name !== 'AbortError') {
                      console.error('Predictive text error:', err)
                    }
                  }
                }, 500)
              }
            },

            destroy() {
              if (debounceTimer) {
                clearTimeout(debounceTimer)
              }
              if (currentRequest) {
                currentRequest.abort()
              }
            },
          }
        },
      }),
    ]
  },
})
