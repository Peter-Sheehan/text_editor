import { Extension } from "@tiptap/core";
import Suggestion, { type SuggestionOptions } from "@tiptap/suggestion";
import { suggestionConfig, type SlashCommandItem } from "./suggestion";

/*
This wraps Tiptap's @tiptap/suggestion plugin, which is a ProseMirror plugin that:
- Watches for the "/" character as you type
- Tracks the text range from "/" to your cursor position
- Manages when to show/hide the menu based on cursor position and focus
- Intercepts keyboard events (arrows, enter) before they reach the editor
*/
export interface SlashCommandOptions {
  suggestion: Partial<SuggestionOptions<SlashCommandItem>>;
}

export const SlashCommand = Extension.create<SlashCommandOptions>({
  name: "slashCommand",

  addOptions() {
    return {
      suggestion: {
        ...suggestionConfig,
      },
    };
  },
  addProseMirrorPlugins() {
    return [
      Suggestion({
        editor: this.editor,
        ...this.options.suggestion,
      }),
    ];
  },
});
