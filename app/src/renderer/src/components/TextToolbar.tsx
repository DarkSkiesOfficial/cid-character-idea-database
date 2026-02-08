import { useCallback } from 'react'

interface TextToolbarProps {
  textareaRef: React.RefObject<HTMLTextAreaElement | null>
  value: string
  onChange: (newValue: string) => void
}

function TextToolbar({ textareaRef, value, onChange }: TextToolbarProps): JSX.Element {

  const getTextarea = () => textareaRef.current
  const getSelection = () => {
    const ta = getTextarea()
    if (!ta) return null
    return { start: ta.selectionStart, end: ta.selectionEnd, ta }
  }

  const setCursor = (ta: HTMLTextAreaElement, pos: number) => {
    requestAnimationFrame(() => {
      ta.setSelectionRange(pos, pos)
      ta.focus()
    })
  }

  const setSelection = (ta: HTMLTextAreaElement, start: number, end: number) => {
    requestAnimationFrame(() => {
      ta.setSelectionRange(start, end)
      ta.focus()
    })
  }

  // Wrap selection with prefix/suffix (e.g. **bold**)
  const wrapInline = useCallback((prefix: string, suffix: string) => {
    const sel = getSelection()
    if (!sel) return
    const { start, end, ta } = sel
    const before = value.substring(0, start)
    const selected = value.substring(start, end)
    const after = value.substring(end)

    if (selected) {
      const newText = before + prefix + selected + suffix + after
      onChange(newText)
      setSelection(ta, start + prefix.length, end + prefix.length)
    } else {
      const placeholder = prefix === '**' ? 'bold text' : prefix === '*' ? 'italic text' : 'text'
      const newText = before + prefix + placeholder + suffix + after
      onChange(newText)
      setSelection(ta, start + prefix.length, start + prefix.length + placeholder.length)
    }
  }, [textareaRef, value, onChange])

  // Prefix each line in selection (e.g. > blockquote, ### heading)
  const prefixLines = useCallback((prefix: string) => {
    const sel = getSelection()
    if (!sel) return
    const { start, end, ta } = sel

    // Expand selection to full lines
    let lineStart = start
    while (lineStart > 0 && value[lineStart - 1] !== '\n') lineStart--
    let lineEnd = end
    while (lineEnd < value.length && value[lineEnd] !== '\n') lineEnd++

    const before = value.substring(0, lineStart)
    const selectedLines = value.substring(lineStart, lineEnd)
    const after = value.substring(lineEnd)

    const prefixed = selectedLines.split('\n').map(line => prefix + line).join('\n')
    const newText = before + prefixed + after
    onChange(newText)
    setCursor(ta, lineStart + prefixed.length)
  }, [textareaRef, value, onChange])

  // Insert text at cursor position
  const insertAtCursor = useCallback((text: string) => {
    const sel = getSelection()
    if (!sel) return
    const { start, ta } = sel
    const before = value.substring(0, start)
    const after = value.substring(start)

    const needsNewlineBefore = before.length > 0 && !before.endsWith('\n')
    const needsNewlineAfter = after.length > 0 && !after.startsWith('\n')
    const insert = (needsNewlineBefore ? '\n' : '') + text + (needsNewlineAfter ? '\n' : '')

    onChange(before + insert + after)
    setCursor(ta, start + insert.length)
  }, [textareaRef, value, onChange])

  return (
    <div className="flex gap-1 mb-1.5 flex-wrap">
      <button
        type="button"
        onClick={() => wrapInline('**', '**')}
        className="btn-toolbar font-bold"
        title="Bold (wrap selection)"
      >
        B
      </button>
      <button
        type="button"
        onClick={() => wrapInline('*', '*')}
        className="btn-toolbar italic"
        title="Italic (wrap selection)"
      >
        I
      </button>
      <button
        type="button"
        onClick={() => prefixLines('### ')}
        className="btn-toolbar"
        title="Heading (prefix selected lines)"
      >
        <span className="text-[10px] font-bold">H</span>
      </button>
      <button
        type="button"
        onClick={() => prefixLines('> ')}
        className="btn-toolbar"
        title="Blockquote (prefix selected lines with >)"
      >
        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
        </svg>
      </button>
      <button
        type="button"
        onClick={() => insertAtCursor('---')}
        className="btn-toolbar"
        title="Horizontal divider"
      >
        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
        </svg>
      </button>
    </div>
  )
}

export default TextToolbar
