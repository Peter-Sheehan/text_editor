import type { EditorState } from '@tiptap/pm/state'

export interface EditorContext {
  /** Full text of the block (paragraph / heading) containing the cursor */
  currentLine: string
  /** Currently selected text — empty string when nothing is selected */
  selectedText: string
  /** Text from the start of the current block up to the cursor */
  textBefore: string
  /** Text from the cursor to the end of the current block */
  textAfter: string
  /**
   * Broader document context: up to 500 chars before and 200 chars after the
   * cursor position, spanning paragraph boundaries. Used as LLM context.
   */
  documentContext: string
}

/**
 * Extract structured context from a Tiptap/ProseMirror EditorState.
 * Priority for Ask AI:
 *   1. selectedText  — if the user has highlighted something
 *   2. currentLine   — the paragraph/heading the cursor is in
 *   3. documentContext — broader surrounding text for the LLM
 */
export function getEditorContext(state: EditorState): EditorContext {
  const { from, to } = state.selection
  const $from = state.doc.resolve(from)

  // Boundaries of the containing block node (paragraph, heading, etc.)
  const blockStart = $from.start($from.depth)
  const blockEnd = $from.end($from.depth)

  const currentLine = state.doc.textBetween(blockStart, blockEnd, '')
  const selectedText = from !== to ? state.doc.textBetween(from, to, ' ') : ''
  const textBefore = state.doc.textBetween(blockStart, from, '')
  const textAfter = state.doc.textBetween(to, blockEnd, '')

  const ctxStart = Math.max(0, from - 500)
  const ctxEnd = Math.min(state.doc.content.size, to + 200)
  const documentContext = state.doc.textBetween(ctxStart, ctxEnd, '\n')

  return { currentLine, selectedText, textBefore, textAfter, documentContext }
}

/**
 * Returns the most relevant context string to pass to the LLM for Ask AI:
 * - selected text if there is one
 * - otherwise the current line (non-empty) with surrounding document context
 */
export function buildAskAIContext(ctx: EditorContext): string {
  if (ctx.selectedText) return ctx.selectedText
  if (ctx.currentLine.trim()) {
    return ctx.documentContext || ctx.currentLine
  }
  return ctx.documentContext
}
