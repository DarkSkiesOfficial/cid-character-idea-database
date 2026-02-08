import ReactMarkdown from 'react-markdown'
import type { Components } from 'react-markdown'

interface MarkdownViewProps {
  content: string
}

const components: Components = {
  h1: ({ children }) => (
    <h1 className="text-xl font-bold text-surface-100 mt-4 mb-2 border-b border-surface-700 pb-1">
      {children}
    </h1>
  ),
  h2: ({ children }) => (
    <h2 className="text-lg font-bold text-surface-100 mt-4 mb-2">
      {children}
    </h2>
  ),
  h3: ({ children }) => (
    <h3 className="text-base font-bold text-surface-100 mt-3 mb-1">
      {children}
    </h3>
  ),
  h4: ({ children }) => (
    <h4 className="text-sm font-bold text-surface-200 mt-3 mb-1">
      {children}
    </h4>
  ),
  p: ({ children }) => (
    <p className="text-sm text-surface-300 leading-relaxed mb-2">
      {children}
    </p>
  ),
  strong: ({ children }) => (
    <strong className="font-bold text-surface-100">{children}</strong>
  ),
  em: ({ children }) => (
    <em className="italic text-surface-200">{children}</em>
  ),
  hr: () => (
    <hr className="border-surface-700 my-4" />
  ),
  ul: ({ children }) => (
    <ul className="list-disc list-inside space-y-1 mb-2 text-sm text-surface-300 ml-2">
      {children}
    </ul>
  ),
  ol: ({ children }) => (
    <ol className="list-decimal list-inside space-y-1 mb-2 text-sm text-surface-300 ml-2">
      {children}
    </ol>
  ),
  li: ({ children }) => (
    <li className="leading-relaxed">{children}</li>
  ),
  blockquote: ({ children }) => {
    // Detect titled blockquotes: first line is > **Title**
    // ReactMarkdown renders children as [<p><strong>Title</strong></p>, <p>body...</p>]
    const childArray = Array.isArray(children) ? children : [children]
    const firstChild = childArray.find(
      (c: any) => c && typeof c === 'object' && c.type === 'p'
    ) as any
    const isTitled = firstChild?.props?.children &&
      (Array.isArray(firstChild.props.children)
        ? firstChild.props.children[0]?.type === 'strong'
        : firstChild.props.children?.type === 'strong')

    if (isTitled) {
      const titleContent = Array.isArray(firstChild.props.children)
        ? firstChild.props.children[0].props.children
        : firstChild.props.children.props.children
      const rest = childArray.filter((c: any) => c !== firstChild)
      return (
        <blockquote className="border-l-3 border-accent-500 bg-surface-800/60 rounded-r-lg pl-4 pr-3 py-2 my-2">
          <p className="text-xs font-bold text-accent-400 uppercase tracking-wider mb-1 not-italic">{titleContent}</p>
          <div className="text-surface-200 italic">{rest}</div>
        </blockquote>
      )
    }

    return (
      <blockquote className="border-l-3 border-accent-500 bg-surface-800/60 rounded-r-lg pl-4 pr-3 py-2 my-2 text-surface-200 italic">
        {children}
      </blockquote>
    )
  },
  code: ({ children }) => (
    <code className="bg-surface-800 text-accent-400 px-1.5 py-0.5 rounded text-xs font-mono">
      {children}
    </code>
  ),
  a: ({ children, href }) => (
    <a href={href} className="text-accent-400 hover:text-accent-300 underline">
      {children}
    </a>
  )
}

// Convert lines between <START> and <END> tags into blockquotes,
// then strip the tags themselves so they never render visibly
function processBlockTags(text: string): string {
  const lines = text.split('\n')
  const result: string[] = []
  let inBlock = false

  for (const line of lines) {
    const trimmed = line.trim()
    if (trimmed === '<START>') {
      inBlock = true
      continue
    }
    if (trimmed === '<END>') {
      inBlock = false
      continue
    }
    if (inBlock) {
      result.push(`> ${line}`)
    } else {
      result.push(line)
    }
  }

  return result.join('\n')
}

// Pre-process text to handle quoted speech as visual callouts
// Matches lines that are primarily quoted dialogue: "..." or "..."
function preprocessQuotes(text: string): string {
  return text.replace(
    /^(\s*)([""\u201C])(.+?)([""\u201D])\s*$/gm,
    '$1> $2$3$4'
  )
}

function MarkdownView({ content }: MarkdownViewProps): JSX.Element {
  const processed = preprocessQuotes(processBlockTags(content))

  return (
    <div className="markdown-content">
      <ReactMarkdown components={components}>
        {processed}
      </ReactMarkdown>
    </div>
  )
}

export default MarkdownView
