'use client'

import { useState, useOptimistic } from 'react'
import { createClient } from '@/lib/supabase/client'
import { CheckCircle2, Circle } from 'lucide-react'
import type { GigChecklistItemRow, GigTaskCompletionRow } from '@/types/database'
import { cn } from '@/lib/utils'

interface Props {
  checklist: GigChecklistItemRow[]
  completionMap: Map<string, GigTaskCompletionRow>
  userId: string
  readOnly: boolean
}

export default function ChecklistSection({ checklist, completionMap, userId, readOnly }: Props) {
  const supabase = createClient()

  // Local state for completions
  const [localMap, setLocalMap] = useState<Map<string, boolean>>(() => {
    const m = new Map<string, boolean>()
    checklist.forEach((item) => {
      m.set(item.id, completionMap.get(item.id)?.completed ?? false)
    })
    return m
  })

  const [notes, setNotes] = useState<Map<string, string>>(() => {
    const m = new Map<string, string>()
    checklist.forEach((item) => {
      m.set(item.id, completionMap.get(item.id)?.notes ?? '')
    })
    return m
  })

  const [saving, setSaving] = useState<string | null>(null)
  const [expandedNote, setExpandedNote] = useState<string | null>(null)

  const completedCount = [...localMap.values()].filter(Boolean).length

  async function toggleComplete(itemId: string) {
    if (readOnly) return
    const current = localMap.get(itemId) ?? false
    const next = !current

    // Optimistic
    setLocalMap((m) => new Map(m).set(itemId, next))
    setSaving(itemId)

    const { error } = await supabase
      .from('gig_task_completions')
      .upsert({
        checklist_item_id: itemId,
        worker_user_id: userId,
        completed: next,
        notes: notes.get(itemId) ?? '',
      })

    if (error) {
      // Revert
      setLocalMap((m) => new Map(m).set(itemId, current))
    }
    setSaving(null)
  }

  async function saveNote(itemId: string) {
    if (readOnly) return
    setSaving(itemId)

    await supabase
      .from('gig_task_completions')
      .upsert({
        checklist_item_id: itemId,
        worker_user_id: userId,
        completed: localMap.get(itemId) ?? false,
        notes: notes.get(itemId) ?? '',
      })

    setSaving(null)
  }

  return (
    <div className="card">
      <div className="card-header flex items-center justify-between">
        <h2 className="font-sans font-semibold text-foreground">Checklist</h2>
        <span className="text-sm font-mono text-muted-foreground">
          {completedCount}/{checklist.length}
        </span>
      </div>

      {/* Progress bar */}
      <div className="h-1 bg-muted">
        <div
          className="h-full bg-accent transition-all"
          style={{ width: `${checklist.length ? (completedCount / checklist.length) * 100 : 0}%` }}
        />
      </div>

      <div className="divide-y divide-border">
        {checklist.map((item) => {
          const done = localMap.get(item.id) ?? false
          const noteText = notes.get(item.id) ?? ''
          const isExpanded = expandedNote === item.id

          return (
            <div key={item.id} className="px-6 py-4 space-y-2">
              <div className="flex items-start gap-3">
                <button
                  onClick={() => toggleComplete(item.id)}
                  disabled={readOnly || saving === item.id}
                  className="mt-0.5 shrink-0 text-muted-foreground hover:text-accent transition-colors disabled:cursor-not-allowed"
                  aria-label={done ? 'Mark incomplete' : 'Mark complete'}
                >
                  {done
                    ? <CheckCircle2 className="w-5 h-5 text-accent" />
                    : <Circle className="w-5 h-5" />
                  }
                </button>
                <div className="flex-1 min-w-0">
                  <p className={cn(
                    'text-sm font-medium transition-colors',
                    done ? 'text-muted-foreground line-through' : 'text-foreground'
                  )}>
                    {item.title}
                    {item.required && !done && <span className="text-destructive ml-1 no-underline">*</span>}
                  </p>
                  {item.description && (
                    <p className="text-xs text-muted-foreground mt-0.5">{item.description}</p>
                  )}
                </div>
                {!readOnly && (
                  <button
                    onClick={() => setExpandedNote(isExpanded ? null : item.id)}
                    className="text-xs text-muted-foreground hover:text-foreground shrink-0"
                  >
                    {noteText ? 'Edit note' : '+ note'}
                  </button>
                )}
              </div>

              {/* Note field */}
              {(isExpanded || noteText) && (
                <div className="ml-8 space-y-1">
                  {isExpanded && !readOnly ? (
                    <div className="flex gap-2">
                      <textarea
                        className="field-input text-xs resize-none h-16 flex-1"
                        placeholder="Add a note..."
                        value={noteText}
                        onChange={(e) => setNotes((m) => new Map(m).set(item.id, e.target.value))}
                        onBlur={() => saveNote(item.id)}
                      />
                    </div>
                  ) : noteText ? (
                    <p className="text-xs text-muted-foreground italic">{noteText}</p>
                  ) : null}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
