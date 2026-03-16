import { Extension } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'
import type { AIAgent } from '@/agents/types'
import { validateCompletion } from '@/utils/completionValidator'

const predictiveTextKey = new PluginKey('predictiveText')

interface PredictiveTextState {
  suggestion: string | null
  position: number | null
}

let agent: Pick<AIAgent, 'predictiveComplete' | 'ready'> | null = null

export function setPredictiveTextContext(ctx: typeof agent) {
  agent = ctx
}

/**
 * Only trigger when the user pauses after finishing a word.
 * We fire on a space after at least one word character, or after sentence-ending
 * punctuation. This avoids triggering on every single keystroke.
 */
function shouldTrigger(textBefore: string): boolean {
  if (textBefore.trim().length < 15) return false
  // Must end with a space after a word, or sentence-end punctuation
  return /\w\s$|[.!?,;]\s?$/.test(textBefore)
}

export const PredictiveText = Extension.create({
  name: 'predictiveText',

  addProseMirrorPlugins() {
    const editor = this.editor
    let debounceTimer: ReturnType<typeof setTimeout> | null = null
    let inferenceInFlight = false
    let cancelled = false

    function cancelPending() {
      if (debounceTimer) {
        clearTimeout(debounceTimer)
        debounceTimer = null
      }
      // Mark any running inference as stale — result will be discarded on arrival
      cancelled = true
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
            if (tr.docChanged) return { suggestion: null, position: null }
            return state
          },
        },

        props: {
          decorations(state) {
            const ps = predictiveTextKey.getState(state) as PredictiveTextState
            if (!ps.suggestion || ps.position === null) return DecorationSet.empty

            const widget = Decoration.widget(
              ps.position,
              () => {
                const span = document.createElement('span')
                span.className = 'ghost-text'
                span.setAttribute('aria-hidden', 'true')
                span.textContent = ps.suggestion
                return span
              },
              { side: 1 }
            )
            return DecorationSet.create(state.doc, [widget])
          },

          handleKeyDown(view, event) {
            const ps = predictiveTextKey.getState(view.state) as PredictiveTextState

            if (event.key === 'Tab' && ps.suggestion) {
              event.preventDefault()
              cancelPending()
              const { tr } = view.state
              tr.insertText(ps.suggestion, ps.position!)
              tr.setMeta(predictiveTextKey, { suggestion: null, position: null })
              view.dispatch(tr)
              return true
            }

            if (event.key === 'Escape' && ps.suggestion) {
              event.preventDefault()
              cancelPending()
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
                // Every keystroke: cancel pending work immediately
                cancelPending()
                cancelled = false

                // Don't queue a new request if one is already running
                if (inferenceInFlight) return

                // Longer debounce — only fire after the user pauses
                debounceTimer = setTimeout(async () => {
                  if (!agent?.ready) return

                  const { state } = view
                  const { from, empty } = state.selection
                  if (!empty) return

                  // Small context window — enough for good completions, fast to process
                  const textBefore = state.doc.textBetween(
                    Math.max(0, from - 200),
                    from,
                    '\n'
                  )

                  if (!shouldTrigger(textBefore)) return

                  inferenceInFlight = true
                  const requestCancelledAt = cancelled

                  try {
                    const suggestion = await agent.predictiveComplete(textBefore, {
                      maxTokens: 30,
                      contextWindow: 200,
                    })

                    // Discard if the user typed something while we were waiting
                    if (cancelled !== requestCancelledAt) return
                    if (!suggestion?.trim()) return

                    // Run the validation pipeline — reject low-quality / off-topic completions
                    const validation = validateCompletion(textBefore, suggestion)
                    if (!validation.valid) {
                      console.debug(
                        `[PredictiveText] rejected "${suggestion}" — ${validation.stage}: ${validation.reason}`
                      )
                      return
                    }

                    const currentPos = editor.state.selection.from
                    const { tr } = editor.view.state
                    tr.setMeta(predictiveTextKey, {
                      suggestion: suggestion.trim(),
                      position: currentPos,
                    })
                    editor.view.dispatch(tr)
                  } catch (err) {
                    if (err instanceof Error && err.name !== 'AbortError') {
                      console.error('Predictive text error:', err)
                    }
                  } finally {
                    inferenceInFlight = false
                  }
                }, 800)
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
