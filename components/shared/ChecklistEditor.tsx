'use client'

import { useState } from 'react'
import { X, Plus, GripVertical } from 'lucide-react'

// Shape of a single checklist row in the editor's local state.
// `id` is optional — only existing items pulled from the DB will have one.
export interface ChecklistDraftItem {
  id?: string
  title: string
  description: string
  required: boolean
}

interface Props {
  items: ChecklistDraftItem[]
  onChange: (items: ChecklistDraftItem[]) => void
  disabled?: boolean
}

// A few common steps to give flippers a starting point.
// They tap one and it gets added as a new row; they can still edit it.
const QUICK_ADD_SUGGESTIONS = [
  'Sand smooth',
  'Apply primer',
  'Paint or stain',
  'Seal / topcoat',
  'Reattach hardware',
  'Photograph final result',
]

export default function ChecklistEditor({ items, onChange, disabled }: Props) {
  const [newTitle, setNewTitle] = useState('')

  function addItem(title: string) {
    const trimmed = title.trim()
    if (!trimmed) return
    onChange([
      ...items,
      { title: trimmed, description: '', required: true },
    ])
    setNewTitle('')
  }

  function updateItem(index: number, patch: Partial<ChecklistDraftItem>) {
    const next = items.map((item, i) => (i === index ? { ...item, ...patch } : item))
    onChange(next)
  }

  function removeItem(index: number) {
    onChange(items.filter((_, i) => i !== index))
  }

  function moveItem(from: number, to: number) {
    if (to < 0 || to >= items.length) return
    const next = [...items]
    const [moved] = next.splice(from, 1)
    next.splice(to, 0, moved)
    onChange(next)
  }

  return (
    <div className="space-y-3">
      <div>
        <label className="field-label">
          Checklist
          <span className="text-muted-foreground font-normal ml-1">(optional)</span>
        </label>
        <p className="text-xs text-muted-foreground -mt-1 mb-2">
          Break the work into steps the worker will check off. You can skip
          this and add steps later from the edit screen.
        </p>
      </div>

      {/* Existing items */}
      {items.length > 0 && (
        <div className="space-y-2">
          {items.map((item, index) => (
            <div
              key={index}
              className="rounded-lg border border-border bg-background p-3 space-y-2"
            >
              <div className="flex items-start gap-2">
                {/* Up / down handles for re-ordering */}
                <div className="flex flex-col items-center gap-0.5 pt-1.5">
                  <button
                    type="button"
                    onClick={() => moveItem(index, index - 1)}
                    disabled={disabled || index === 0}
                    className="text-muted-foreground hover:text-foreground disabled:opacity-30"
                    aria-label="Move up"
                  >
                    <GripVertical className="w-4 h-4 rotate-90" />
                  </button>
                </div>

                <div className="flex-1 space-y-2">
                  <input
                    type="text"
                    value={item.title}
                    onChange={(e) => updateItem(index, { title: e.target.value })}
                    disabled={disabled}
                    className="field-input"
                    placeholder="Step title"
                  />
                  <input
                    type="text"
                    value={item.description}
                    onChange={(e) => updateItem(index, { description: e.target.value })}
                    disabled={disabled}
                    className="field-input text-sm"
                    placeholder="Notes for the worker (optional)"
                  />
                  <div className="flex items-center justify-between">
                    <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={item.required}
                        onChange={(e) => updateItem(index, { required: e.target.checked })}
                        disabled={disabled}
                        className="rounded border-border accent-accent"
                      />
                      Required step
                    </label>
                    <span className="text-xs text-muted-foreground">
                      Step {index + 1} of {items.length}
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => removeItem(index)}
                  disabled={disabled}
                  className="text-muted-foreground hover:text-destructive transition-colors p-1"
                  aria-label="Remove step"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add new item */}
      <div className="flex gap-2">
        <input
          type="text"
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              addItem(newTitle)
            }
          }}
          disabled={disabled}
          className="field-input flex-1"
          placeholder="Add a step and press Enter..."
        />
        <button
          type="button"
          onClick={() => addItem(newTitle)}
          disabled={disabled || !newTitle.trim()}
          className="inline-flex items-center gap-1 px-3 py-2 rounded-md border border-border text-sm font-medium hover:border-foreground hover:text-foreground transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Plus className="w-4 h-4" />
          Add
        </button>
      </div>

      {/* Quick-add suggestions */}
      <div>
        <p className="text-xs text-muted-foreground mb-1.5">Quick add:</p>
        <div className="flex flex-wrap gap-1.5">
          {QUICK_ADD_SUGGESTIONS.filter(
            (s) => !items.some((item) => item.title.toLowerCase() === s.toLowerCase())
          ).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => addItem(s)}
              disabled={disabled}
              className="text-xs px-2 py-0.5 rounded-full border border-border text-muted-foreground hover:border-accent hover:text-accent transition-colors disabled:opacity-50"
            >
              + {s}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
