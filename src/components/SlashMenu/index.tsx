import { useState, useEffect, useCallback, forwardRef, useImperativeHandle } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import tippy, { type Instance as TippyInstance } from 'tippy.js'
import type { SuggestionProps, SuggestionKeyDownProps } from '@tiptap/suggestion'
import { slashCommands, type SlashCommandItem } from '@/extensions/SlashCommand/suggestion'
import './styles.css'

interface SlashMenuProps {
  items: SlashCommandItem[]
  command: (item: SlashCommandItem) => void
}

export interface SlashMenuRef {
  onKeyDown: (props: SuggestionKeyDownProps) => boolean
}

const SlashMenuComponent = forwardRef<SlashMenuRef, SlashMenuProps>(
  ({ items, command }, ref) => {
    const [selectedIndex, setSelectedIndex] = useState(0)

    useEffect(() => {
      setSelectedIndex(0)
    }, [items])

    const selectItem = useCallback(
      (index: number) => {
        const item = items[index]
        if (item) {
          command(item)
        }
      },
      [items, command]
    )

    useImperativeHandle(ref, () => ({
      onKeyDown: ({ event }) => {
        if (event.key === 'ArrowUp') {
          setSelectedIndex((prev) => (prev - 1 + items.length) % items.length)
          return true
        }
        if (event.key === 'ArrowDown') {
          setSelectedIndex((prev) => (prev + 1) % items.length)
          return true
        }
        if (event.key === 'Enter') {
          selectItem(selectedIndex)
          return true
        }
        return false
      },
    }))

    if (items.length === 0) {
      return (
        <div className="slash-menu slash-menu--empty">
          No commands found
        </div>
      )
    }

    return (
      <div className="slash-menu">
        {items.map((item, index) => (
          <button
            key={item.title}
            onClick={() => selectItem(index)}
            className={`slash-menu__item ${
              index === selectedIndex ? 'slash-menu__item--selected' : ''
            }`}
          >
            <span className="slash-menu__icon">{item.icon}</span>
            <div className="slash-menu__content">
              <div className="slash-menu__title">{item.title}</div>
              <div className="slash-menu__description">{item.description}</div>
            </div>
          </button>
        ))}
      </div>
    )
  }
)

SlashMenuComponent.displayName = 'SlashMenuComponent'

export class SlashMenu {
  private props: SuggestionProps<SlashCommandItem>
  private root: Root
  private ref: SlashMenuRef | null = null
  private popup: TippyInstance | null = null

  constructor(
    container: HTMLElement,
    props: SuggestionProps<SlashCommandItem>
  ) {
    this.props = props
    this.root = createRoot(container)
    this.render()
    this.createPopup(container)
  }

  private render() {
    const items = this.props.items.length > 0 ? this.props.items : slashCommands
    this.root.render(
      <SlashMenuComponent
        ref={(r) => {
          this.ref = r
        }}
        items={items}
        command={(item) => {
          item.command(this.props.editor, this.props.range)
        }}
      />
    )
  }

  private createPopup(container: HTMLElement) {
    if (this.props.clientRect) {
      this.popup = tippy(document.body, {
        getReferenceClientRect: this.props.clientRect as () => DOMRect,
        appendTo: () => document.body,
        content: container,
        showOnCreate: true,
        interactive: true,
        trigger: 'manual',
        placement: 'bottom-start',
        animation: 'shift-away',
        offset: [0, 8],
      })
    }
  }

  updateProps(props: SuggestionProps<SlashCommandItem>) {
    this.props = props
    this.render()
    if (this.popup && props.clientRect) {
      this.popup.setProps({
        getReferenceClientRect: props.clientRect as () => DOMRect,
      })
    }
  }

  onKeyDown(props: SuggestionKeyDownProps): boolean {
    return this.ref?.onKeyDown(props) ?? false
  }

  destroy() {
    this.popup?.destroy()
    this.root.unmount()
  }
}

export function renderSlashMenu(
  container: HTMLElement,
  props: SuggestionProps<SlashCommandItem>
): SlashMenu {
  return new SlashMenu(container, props)
}
