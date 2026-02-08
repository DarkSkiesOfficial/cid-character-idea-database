import { useState, useRef, useEffect, useCallback } from 'react'

interface AutocompleteInputProps {
  suggestions: string[]
  value: string
  onChange: (value: string) => void
  onSubmit: (value: string) => void
  placeholder?: string
  className?: string
  dropUp?: boolean
}

export default function AutocompleteInput({ suggestions, value, onChange, onSubmit, placeholder, className, dropUp }: AutocompleteInputProps) {
  const [open, setOpen] = useState(false)
  const [highlightIndex, setHighlightIndex] = useState(-1)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLUListElement>(null)

  const filtered = value.trim()
    ? suggestions.filter(s => s.toLowerCase().includes(value.toLowerCase()) && s.toLowerCase() !== value.toLowerCase())
    : []

  const showDropdown = open && filtered.length > 0

  const handleSubmit = useCallback((val: string) => {
    if (!val.trim()) return
    onSubmit(val.trim())
    onChange('')
    setOpen(false)
    setHighlightIndex(-1)
  }, [onSubmit, onChange])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showDropdown) {
      if (e.key === 'Enter') {
        e.preventDefault()
        handleSubmit(value)
      }
      return
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHighlightIndex(i => Math.min(i + 1, filtered.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlightIndex(i => Math.max(i - 1, -1))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (highlightIndex >= 0 && highlightIndex < filtered.length) {
        handleSubmit(filtered[highlightIndex])
      } else {
        handleSubmit(value)
      }
    } else if (e.key === 'Escape') {
      setOpen(false)
      setHighlightIndex(-1)
    }
  }

  // Scroll highlighted item into view
  useEffect(() => {
    if (highlightIndex >= 0 && listRef.current) {
      const el = listRef.current.children[highlightIndex] as HTMLElement
      el?.scrollIntoView({ block: 'nearest' })
    }
  }, [highlightIndex])

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  return (
    <div ref={wrapperRef} className="relative">
      <input
        type="text"
        value={value}
        onChange={e => { onChange(e.target.value); setOpen(true); setHighlightIndex(-1) }}
        onFocus={() => setOpen(true)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className={className || 'input-field w-48'}
      />
      {showDropdown && (
        <ul
          ref={listRef}
          className={`absolute z-50 left-0 right-0 max-h-48 overflow-y-auto bg-surface-800 border border-surface-600 rounded-lg shadow-xl ${dropUp ? 'bottom-full mb-1' : 'mt-1'}`}
        >
          {filtered.slice(0, 20).map((item, i) => (
            <li
              key={item}
              onMouseDown={(e) => { e.preventDefault(); handleSubmit(item) }}
              onMouseEnter={() => setHighlightIndex(i)}
              className={`px-3 py-1.5 text-sm cursor-pointer ${
                i === highlightIndex ? 'bg-accent-600 text-white' : 'text-surface-200 hover:bg-surface-700'
              }`}
            >
              {item}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
