# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A text editor built with React, Tiptap, Carbon Design System, and WebLLM for browser-based AI features. The editor runs entirely client-side using WebGPU for LLM inference.

## Development Commands

```bash
npm run dev       # Development server (port 5173)
npm run build     # Production build (tsc + vite)
npm run lint      # Lint code
npm run preview   # Preview production build
```

## Architecture

### Core Stack
- **Editor**: Tiptap (ProseMirror-based) with custom extensions
- **UI Framework**: Carbon Design System (@carbon/react) with g100 (dark) theme
- **AI Runtime**: WebLLM (@mlc-ai/web-llm) for in-browser LLM inference via WebGPU
- **Build Tool**: Vite with React plugin

### Project Structure

```
src/
├── App.tsx                          # Root component with theme + providers
├── main.tsx                         # Entry point
├── index.scss                       # Global styles + Tiptap editor styles
├── components/
│   ├── AskAI/                       # AI prompt modal (Cmd+J)
│   ├── Editor/                      # Main editor + toolbar + view mode switcher
│   ├── ErrorBoundary/               # React error boundary with fallback UI
│   └── SlashMenu/                   # Slash command palette UI
├── context/
│   └── WebLLMContext.tsx             # WebLLM engine + React context (all AI logic)
├── extensions/
│   ├── AskAI/                       # Tiptap extension: Cmd+J shortcut
│   ├── PredictiveText/              # Tiptap extension: ghost text suggestions
│   └── SlashCommand/                # Tiptap extension: "/" command palette
├── hooks/
│   └── useViewMode.ts               # Editor/HTML/Markdown view switching
├── styles/
│   └── ghost-text.scss              # Predictive text ghost styling
└── utils/
    └── markdown.ts                  # Markdown ↔ HTML conversion (markdown-it + DOMPurify)
```

### Key Files

**`src/context/WebLLMContext.tsx`** - All AI logic lives here
- Manages WebLLM engine lifecycle directly (no service layer)
- Checks WebGPU support, loads model, exposes `generateCompletion()` and `generateText()`
- Shows loading modal during model download
- Model ID configurable via `VITE_MODEL_ID` env var (defaults to Llama-3.2-1B)

**`src/components/Editor/index.tsx`** - Main editor component
- Tiptap instance with StarterKit + table + custom extensions
- Three view modes: Editor (rich text), HTML, Markdown
- Toolbar calls Tiptap commands directly (no indirection)

**`src/utils/markdown.ts`** - Markdown conversion
- `generateMarkdown()`: Tiptap JSON → markdown
- `parseMarkdown()`: markdown → sanitized HTML (via markdown-it + DOMPurify)

## Path Aliases

`@/` maps to `src/` (configured in vite.config.ts and tsconfig.json)

## WebGPU Requirements

- Chrome 113+, Edge 113+, or Firefox with WebGPU enabled
- First load downloads model and caches in IndexedDB

## Important Notes

### Tiptap Extensions
1. Create in `src/extensions/`
2. Add to editor's `extensions` array in `src/components/Editor/index.tsx`
3. If extension needs WebLLM, use the setter pattern from PredictiveText

### View Mode Switching
- Content syncs when switching modes via `useViewMode` hook
- HTML/Markdown views use `react-simple-code-editor` with highlight.js

### WebLLM Integration
- Check `isSupported` before showing AI features
- Check `isReady` before calling generation functions
- All AI config (model params, prompts) is inline in `WebLLMContext.tsx`

## Styling

- Global styles: `src/index.scss` (Carbon theme, Tiptap editor styles)
- Component styles: SCSS modules (e.g. `styles.module.scss`)
- IBM Plex fonts from `@ibm/plex` package
- Dark theme (g100) via Carbon's Theme component
