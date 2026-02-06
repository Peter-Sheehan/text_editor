import type { JSONContent } from '@tiptap/core'

export function generateMarkdown(json: JSONContent): string {
  if (!json.content) return ''

  return json.content.map(node => nodeToMarkdown(node)).join('\n')
}

function nodeToMarkdown(node: JSONContent): string {
  switch (node.type) {
    case 'paragraph':
      return contentToMarkdown(node.content) + '\n'

    case 'heading': {
      const level = node.attrs?.level || 1
      const prefix = '#'.repeat(level)
      return `${prefix} ${contentToMarkdown(node.content)}\n`
    }

    case 'bulletList':
      return node.content?.map(item => {
        const text = item.content?.map(p => contentToMarkdown(p.content)).join('\n') || ''
        return `- ${text}`
      }).join('\n') + '\n'

    case 'orderedList':
      return node.content?.map((item, i) => {
        const text = item.content?.map(p => contentToMarkdown(p.content)).join('\n') || ''
        return `${i + 1}. ${text}`
      }).join('\n') + '\n'

    case 'blockquote':
      return node.content?.map(p => `> ${contentToMarkdown(p.content)}`).join('\n') + '\n'

    case 'codeBlock': {
      const lang = node.attrs?.language || ''
      const code = contentToMarkdown(node.content)
      return `\`\`\`${lang}\n${code}\n\`\`\`\n`
    }

    case 'horizontalRule':
      return '---\n'

    default:
      return contentToMarkdown(node.content)
  }
}

function contentToMarkdown(content?: JSONContent[]): string {
  if (!content) return ''

  return content.map(node => {
    if (node.type === 'text') {
      let text = node.text || ''

      if (node.marks) {
        for (const mark of node.marks) {
          switch (mark.type) {
            case 'bold':
              text = `**${text}**`
              break
            case 'italic':
              text = `*${text}*`
              break
            case 'code':
              text = `\`${text}\``
              break
            case 'strike':
              text = `~~${text}~~`
              break
            case 'link':
              text = `[${text}](${mark.attrs?.href || ''})`
              break
          }
        }
      }

      return text
    }

    if (node.type === 'hardBreak') {
      return '\n'
    }

    return ''
  }).join('')
}

export function parseMarkdown(markdown: string): string {
  const lines = markdown.split('\n')
  let html = ''
  let inCodeBlock = false
  let codeContent = ''
  let inList = false
  let listType = ''
  let listItems: string[] = []

  const flushList = () => {
    if (inList && listItems.length > 0) {
      const tag = listType === 'ul' ? 'ul' : 'ol'
      html += `<${tag}>${listItems.map(item => `<li><p>${item}</p></li>`).join('')}</${tag}>`
      listItems = []
      inList = false
    }
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]

    // Code block
    if (line.startsWith('```')) {
      if (inCodeBlock) {
        html += `<pre><code>${escapeHtml(codeContent.trim())}</code></pre>`
        codeContent = ''
        inCodeBlock = false
      } else {
        flushList()
        inCodeBlock = true
      }
      continue
    }

    if (inCodeBlock) {
      codeContent += line + '\n'
      continue
    }

    // Horizontal rule
    if (line.match(/^---+$/)) {
      flushList()
      html += '<hr>'
      continue
    }

    // Headings
    const headingMatch = line.match(/^(#{1,6})\s+(.+)$/)
    if (headingMatch) {
      flushList()
      const level = headingMatch[1].length
      const text = parseInlineMarkdown(headingMatch[2])
      html += `<h${level}>${text}</h${level}>`
      continue
    }

    // Unordered list
    const ulMatch = line.match(/^[-*]\s+(.+)$/)
    if (ulMatch) {
      if (!inList || listType !== 'ul') {
        flushList()
        inList = true
        listType = 'ul'
      }
      listItems.push(parseInlineMarkdown(ulMatch[1]))
      continue
    }

    // Ordered list
    const olMatch = line.match(/^\d+\.\s+(.+)$/)
    if (olMatch) {
      if (!inList || listType !== 'ol') {
        flushList()
        inList = true
        listType = 'ol'
      }
      listItems.push(parseInlineMarkdown(olMatch[1]))
      continue
    }

    // Blockquote
    const quoteMatch = line.match(/^>\s*(.*)$/)
    if (quoteMatch) {
      flushList()
      html += `<blockquote><p>${parseInlineMarkdown(quoteMatch[1])}</p></blockquote>`
      continue
    }

    // Empty line
    if (line.trim() === '') {
      flushList()
      continue
    }

    // Paragraph
    flushList()
    html += `<p>${parseInlineMarkdown(line)}</p>`
  }

  flushList()

  return html
}

function parseInlineMarkdown(text: string): string {
  // Bold
  text = text.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
  // Italic
  text = text.replace(/\*(.+?)\*/g, '<em>$1</em>')
  // Strikethrough
  text = text.replace(/~~(.+?)~~/g, '<s>$1</s>')
  // Inline code
  text = text.replace(/`(.+?)`/g, '<code>$1</code>')
  // Links
  text = text.replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2">$1</a>')

  return text
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}
