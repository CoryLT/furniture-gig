'use client'

import { useState } from 'react'

// A dropdown of existing things (pieces, people…) with a "+ Add new…" choice
// at the bottom. Pick "+ Add new…" and a name box appears; whatever you type
// there gets created on save. Used inside the normal server-action forms:
//   - `name` carries the chosen id (or the sentinel "__new__")
//   - `newName` carries the typed new name
export default function AddableSelect({
  name,
  newName,
  options,
  noneLabel = '— none —',
  addLabel = '+ Add new…',
  placeholder = 'Type a name',
}: {
  name: string
  newName: string
  options: { id: string; label: string }[]
  noneLabel?: string
  addLabel?: string
  placeholder?: string
}) {
  const [val, setVal] = useState('')
  const fieldCls =
    'w-full rounded-lg border border-neutral-300 px-3 py-2 text-neutral-900 focus:outline-none focus:ring-2 focus:ring-amber-400'

  return (
    <div className="space-y-2">
      <select
        name={name}
        value={val}
        onChange={(e) => setVal(e.target.value)}
        className={fieldCls}
      >
        <option value="">{noneLabel}</option>
        {options.map((o) => (
          <option key={o.id} value={o.id}>
            {o.label}
          </option>
        ))}
        <option value="__new__">{addLabel}</option>
      </select>

      {val === '__new__' && (
        <input
          type="text"
          name={newName}
          placeholder={placeholder}
          autoFocus
          className={fieldCls}
        />
      )}
    </div>
  )
}
