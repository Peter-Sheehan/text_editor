import { IconButton } from '@carbon/react'
import { Edit, Code, DocumentBlank } from '@carbon/icons-react'
import type { ViewMode } from '@/hooks/useViewMode'
import styles from './styles.module.scss'

interface ViewModeSwitcherProps {
  value: ViewMode
  onChange: (mode: ViewMode) => void
}

export function ViewModeSwitcher({ value, onChange }: ViewModeSwitcherProps) {
  return (
    <div className={styles.toolbarRight}>
      <IconButton
        label="Editor"
        kind={value === 'editor' ? 'primary' : 'ghost'}
        size="sm"
        onClick={() => onChange('editor')}
      >
        <Edit />
      </IconButton>
      <IconButton
        label="HTML"
        kind={value === 'html' ? 'primary' : 'ghost'}
        size="sm"
        onClick={() => onChange('html')}
      >
        <Code />
      </IconButton>
      <IconButton
        label="Markdown"
        kind={value === 'markdown' ? 'primary' : 'ghost'}
        size="sm"
        onClick={() => onChange('markdown')}
      >
        <DocumentBlank />
      </IconButton>
    </div>
  )
}
