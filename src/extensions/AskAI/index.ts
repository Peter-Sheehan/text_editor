import { Extension } from '@tiptap/core'

export interface AskAIOptions {
  onActivate: () => void
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    askAI: {
      openAskAI: () => ReturnType
    }
  }
}

export const AskAIExtension = Extension.create<AskAIOptions>({
  name: 'askAI',

  addOptions() {
    return {
      onActivate: () => {},
    }
  },

  addCommands() {
    return {
      openAskAI:
        () =>
        () => {
          this.options.onActivate()
          return true
        },
    }
  },

  addKeyboardShortcuts() {
    return {
      'Mod-j': () => {
        this.options.onActivate()
        return true
      },
    }
  },
})
