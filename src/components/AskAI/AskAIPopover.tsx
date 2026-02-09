import { useState, useCallback, useEffect, useRef } from "react";
import { InlineLoading } from "@carbon/react";
import { useWebLLM } from "@/context/WebLLMContext";
import { Editor } from "@tiptap/react";
import styles from "./popover-styles.module.scss";

interface AskAIPopoverProps {
  editor: Editor;
  onClose: () => void;
  onSubmit: (text: string) => void;
  selectedText?: string;
}

export function AskAIPopover({
  editor,
  onClose,
  onSubmit,
  selectedText,
}: AskAIPopoverProps) {
  const [prompt, setPrompt] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const { generateText, isReady, isSupported } = useWebLLM();
  const popoverRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Calculate position based on cursor
  useEffect(() => {
    const updatePosition = () => {
      const { view } = editor;
      const { from } = view.state.selection;
      const start = view.coordsAtPos(from);

      if (!start) return;

      // Get editor container bounds
      const editorContainer = view.dom.closest(".tiptap")?.parentElement;
      if (!editorContainer) return;

      const containerRect = editorContainer.getBoundingClientRect();

      const popoverHeight = 80; // Approximate height
      const popoverWidth = 480;
      const buffer = 20; // Spacing between popover and text

      // Position below cursor by default to avoid blocking text
      let top = start.bottom - containerRect.top + buffer;
      let left = start.left - containerRect.left - popoverWidth / 2;

      // If popover would overflow bottom, position above instead
      if (top + popoverHeight > containerRect.height - buffer) {
        top = start.top - containerRect.top - popoverHeight - buffer;
      }

      // Handle horizontal edge collisions
      const containerWidth = containerRect.width;
      if (left < buffer) {
        left = buffer;
      } else if (left + popoverWidth > containerWidth - buffer) {
        left = containerWidth - popoverWidth - buffer;
      }

      setPosition({ top, left });
    };

    updatePosition();
    window.addEventListener("resize", updatePosition);
    return () => window.removeEventListener("resize", updatePosition);
  }, [editor]);

  // Auto-focus textarea
  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!prompt.trim() || !isReady || !isSupported || isGenerating) return;

    setIsGenerating(true);
    setError(null);

    try {
      const result = await generateText({
        prompt: prompt.trim(),
        context: selectedText || undefined,
        systemPrompt: selectedText
          ? "You are a helpful writing assistant. The user has selected some text and wants you to help with it. Respond with only the text that should replace or follow the selection, no explanations."
          : "You are a helpful writing assistant. Respond with text that can be directly inserted into a document. Be concise and helpful.",
      });

      onSubmit(result);
    } catch (err) {
      console.error("AI generation error:", err);
      setError(
        err instanceof Error ? err.message : "Failed to generate response",
      );
    } finally {
      setIsGenerating(false);
    }
  }, [
    prompt,
    isReady,
    isSupported,
    isGenerating,
    generateText,
    selectedText,
    onSubmit,
  ]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      } else if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        handleSubmit();
      } else if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        onClose();
      }
    },
    [handleSubmit, onClose],
  );

  const canGenerate = prompt.trim() && isReady && isSupported && !isGenerating;

  return (
    <div
      ref={popoverRef}
      className={styles.popover}
      style={{
        top: `${position.top}px`,
        left: `${position.left}px`,
      }}
    >
      <div className={styles.popoverInner}>
        {/* Top row with input and actions */}
        <div className={styles.topRow}>
          <div className={styles.inputWrapper}>
            <span className={styles.label}>Ask AI</span>
            <textarea
              ref={textareaRef}
              className={styles.textarea}
              placeholder="What would you like the AI to write?"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={isGenerating}
              rows={1}
            />
          </div>

          <div className={styles.actions}>
            {selectedText && (
              <span className={styles.context}>
                "{selectedText.slice(0, 20)}
                {selectedText.length > 20 ? "..." : ""}"
              </span>
            )}

            <div className={styles.shortcuts}>
              <kbd className={styles.kbd}>⌘K</kbd>
            </div>

            <button
              className={styles.generateButton}
              onClick={handleSubmit}
              disabled={!canGenerate}
            >
              {isGenerating ? "Generating..." : "Generate"}
            </button>

            <button
              className={styles.closeButton}
              onClick={onClose}
              aria-label="Close"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Status Messages */}
        {isGenerating && (
          <div className={styles.status}>
            <InlineLoading description="Generating..." />
          </div>
        )}

        {error && (
          <div className={styles.error}>
            <span className={styles.errorIcon}>⚠</span>
            <span className={styles.errorText}>{error}</span>
          </div>
        )}

        {!isSupported && (
          <div className={styles.warning}>
            <span className={styles.warningIcon}>⚠</span>
            <span className={styles.warningText}>WebGPU not supported</span>
          </div>
        )}

        {isSupported && !isReady && !isGenerating && (
          <div className={styles.info}>
            <span className={styles.infoIcon}>⏳</span>
            <span className={styles.infoText}>Loading model...</span>
          </div>
        )}
      </div>
    </div>
  );
}
