import { Plugin, PluginKey } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'

export const askAIPluginKey = new PluginKey('askAI')

export interface AskAIPluginState {
  active: boolean
  position: number | null
}

export function createAskAIPlugin() {
  return new Plugin<AskAIPluginState>({
    key: askAIPluginKey,
    state: {
      init() {
        return {
          active: false,
          position: null,
        }
      },
      apply(tr, value) {
        const meta = tr.getMeta(askAIPluginKey)
        if (meta) {
          return meta
        }
        return value
      },
    },
    props: {
      decorations(state) {
        const pluginState = askAIPluginKey.getState(state)
        if (!pluginState?.active || pluginState.position === null) {
          return DecorationSet.empty
        }

        const widget = Decoration.widget(
          pluginState.position,
          () => {
            const container = document.createElement('div')
            container.className = 'ask-ai-widget-container'
            container.setAttribute('data-ask-ai-widget', 'true')
            container.id = 'ask-ai-widget-' + Date.now()
            return container
          },
          {
            side: 1,
          }
        )

        return DecorationSet.create(state.doc, [widget])
      },
    },
  })
}
