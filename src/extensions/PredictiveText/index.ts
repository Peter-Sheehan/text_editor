import { Extension } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'
import type { LLMAgent } from '@/agents/LLMAgent'

const predictiveTextKey = new PluginKey('predictiveText')

interface PredictiveTextState {
  suggestion: string | null
  position: number | null
}

// Injected via setPredictiveTextContext from the Editor component
let llmAgent: { predictiveComplete: LLMAgent['predictiveComplete']; isReady: boolean } | null = null

export function setPredictiveTextContext(
  ctx: typeof llmAgent
) {
  llmAgent = ctx
}

/**
 * Determines if the cursor is in a good place to show a suggestion.
 * We only trigger after the cursor sits at the end of a word (non-whitespace),
 * preventing suggestions mid-word or right after a slash command.
 */
function shouldTrigger(textBefore: string): boolean {
  if (textBefore.trim().length < 10) return false
  // Don't trigger if text ends in whitespace (mid-sentence pause) or slash command
  const lastChar = textBefore[textBefore.length - 1]
  if (!lastChar || lastChar === '/') return false
  // Trigger after a word ends: space, punctuation, or end of substantial text
  return /[a-zA-Z0-9\u00C0-\u024F"')]$/.test(textBefore)
}

export const PredictiveText = Extension.create({
  name: 'predictiveText',

  addProseMirrorPlugins() {
    const editor = this.editor
    let debounceTimer: ReturnType<typeof setTimeout> | null = null
    let activeStreamAbort: (() => void) | null = null

    function cancelPending() {
      if (debounceTimer) {
        clearTimeout(debounceTimer)
        debounceTimer = null
      }
      if (activeStreamAbort) {
        activeStreamAbort()
        activeStreamAbort = null
      }
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    function clearSuggestion(view: any) {
      const { tr } = view.state
      tr.setMeta(predictiveTextKey, { suggestion: null, position: null })
      view.dispatch(tr)
    }

    return [
      new Plugin({
        key: predictiveTextKey,

        state: {
          init(): PredictiveTextState {
            return { suggestion: null, position: null }
          },

          apply(tr, state): PredictiveTextState {
            const meta = tr.getMeta(predictiveTextKey)
            if (meta !== undefined) return meta
            // Any doc change clears the current suggestion
            if (tr.docChanged) return { suggestion: null, position: null }
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
                span.setAttribute('aria-hidden', 'true')
                span.textContent = pluginState.suggestion
                return span
              },
              { side: 1 }
            )

            return DecorationSet.create(state.doc, [widget])
          },

          handleKeyDown(view, event) {
            const pluginState = predictiveTextKey.getState(view.state) as PredictiveTextState

            // Tab: accept the suggestion
            if (event.key === 'Tab' && pluginState.suggestion) {
              event.preventDefault()
              cancelPending()
              const { tr } = view.state
              tr.insertText(pluginState.suggestion, pluginState.position!)
              tr.setMeta(predictiveTextKey, { suggestion: null, position: null })
              view.dispatch(tr)
              return true
            }

            // Escape: dismiss the suggestion
            if (event.key === 'Escape' && pluginState.suggestion) {
              event.preventDefault()
              cancelPending()
              clearSuggestion(view)
              return true
            }

            // Any other key dismisses suggestion (doc changes will auto-clear too)
            return false
          },
        },

        view() {
          return {
            update(view, prevState) {
              if (!view.state.doc.eq(prevState.doc)) {
                cancelPending()

                debounceTimer = setTimeout(async () => {
                  if (!llmAgent?.isReady) return

                  const { state } = view
                  const { from, empty } = state.selection
                  if (!empty) return

                  const textBefore = state.doc.textBetween(
                    Math.max(0, from - 500),
                    from,
                    '\n'
                  )

                  if (!shouldTrigger(textBefore)) return

                  // Stream the completion chunk by chunk into the decoration
                  let accumulated = ''
                  let aborted = false
                  activeStreamAbort = () => { aborted = true }

                  try {
                    const stream = llmAgent.predictiveComplete(textBefore, { maxTokens: 40 })
                    const result = await stream

                    if (aborted) return

                    accumulated = result
                    if (accumulated.trim()) {
                      const currentPos = editor.state.selection.from
                      const { tr } = editor.view.state
                      tr.setMeta(predictiveTextKey, {
                        suggestion: accumulated.trim(),
                        position: currentPos,
                      })
                      editor.view.dispatch(tr)
                    }
                  } catch (err) {
                    if (!aborted && err instanceof Error && err.name !== 'AbortError') {
                      console.error('Predictive text error:', err)
                    }
                  } finally {
                    activeStreamAbort = null
                  }
                }, 600)
              }
            },

            destroy() {
              cancelPending()
            },
          }
        },
      }),
    ]
  },
})
