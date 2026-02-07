import type { JSONContent } from '@tiptap/core'
import MarkdownIt from 'markdown-it'
import DOMPurify from 'dompurify'
import hljs from 'highlight.js/lib/core'
import javascript from 'highlight.js/lib/languages/javascript'
import typescript from 'highlight.js/lib/languages/typescript'
import python from 'highlight.js/lib/languages/python'
import xml from 'highlight.js/lib/languages/xml' // HTML/XML
import css from 'highlight.js/lib/languages/css'
import json from 'highlight.js/lib/languages/json'
import bash from 'highlight.js/lib/languages/bash'
import markdown from 'highlight.js/lib/languages/markdown'

// Register languages for syntax highlighting
hljs.registerLanguage('javascript', javascript)
hljs.registerLanguage('typescript', typescript)
hljs.registerLanguage('python', python)
hljs.registerLanguage('html', xml)
hljs.registerLanguage('xml', xml)
hljs.registerLanguage('css', css)
hljs.registerLanguage('json', json)
hljs.registerLanguage('bash', bash)
hljs.registerLanguage('shell', bash)
hljs.registerLanguage('markdown', markdown)

// Configure markdown-it with syntax highlighting
const md = new MarkdownIt({
  html: true,
  linkify: true,
  typographer: true,
  highlight: function (str, lang) {
    if (lang && hljs.getLanguage(lang)) {
      try {
        return hljs.highlight(str, { language: lang }).value
      } catch (__) {
        // Ignore errors
      }
    }
    return '' // Use external default escaping
  }
})

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

    case 'table':
      return tableToMarkdown(node) + '\n'

    default:
      return contentToMarkdown(node.content)
  }
}

function tableToMarkdown(table: JSONContent): string {
  if (!table.content || table.content.length === 0) return ''

  const rows = table.content
  let markdown = ''

  // Process each row
  rows.forEach((row, rowIndex) => {
    if (!row.content) return

    const cells = row.content.map(cell => {
      return contentToMarkdown(cell.content).trim()
    })

    markdown += '| ' + cells.join(' | ') + ' |\n'

    // Add separator after first row (header row)
    if (rowIndex === 0) {
      markdown += '| ' + cells.map(() => '---').join(' | ') + ' |\n'
    }
  })

  return markdown
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
  const unsafeHtml = md.render(markdown)
  return DOMPurify.sanitize(unsafeHtml, {
    ALLOWED_TAGS: [
      'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
      'ul', 'ol', 'li',
      'blockquote', 'pre', 'code',
      'strong', 'em', 'del', 'a',
      'hr', 'br',
      'table', 'thead', 'tbody', 'tr', 'th', 'td',
      'span', 'div'
    ],
    ALLOWED_ATTR: ['href', 'class', 'language'],
  })
}
