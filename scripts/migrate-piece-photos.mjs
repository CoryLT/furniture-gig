// ============================================================
// FlipWork — copy piece + supply photos to the new project (one-time)
// ============================================================
// The old Books app kept furniture/supply photos in its private "receipts"
// bucket. This copies ONLY the files your migrated pieces + supplies point to
// (not your private receipts, not leftover duplicates) into the new project's
// public "marketplace-photos" bucket, keeping the same names so the photo paths
// you already have light up in the Pipeline.
//
// Run once, from the project folder:
//     node scripts/migrate-piece-photos.mjs
//
// It will ask for 4 values (URL + service_role key for each project). Find them
// in each Supabase project under: Project Settings -> API.
// Those values stay in YOUR terminal — never paste them into the Claude chat.
// Safe to run more than once (it overwrites the same files).
// ============================================================

import { createClient } from '@supabase/supabase-js'
import readline from 'node:readline/promises'
import { stdin as input, stdout as output } from 'node:process'

const OWNER = '72f34512-113f-4c02-b638-0ddf3236d2a9' // corythacker@gmail.com
const SRC_BUCKET = 'receipts'          // old project
const DST_BUCKET = 'marketplace-photos' // new project

function contentTypeFor(path) {
  const p = path.toLowerCase()
  if (p.endsWith('.png')) return 'image/png'
  if (p.endsWith('.webp')) return 'image/webp'
  if (p.endsWith('.gif')) return 'image/gif'
  if (p.endsWith('.heic')) return 'image/heic'
  return 'image/jpeg'
}

const rl = readline.createInterface({ input, output })
const ask = async (q) => (await rl.question(q)).trim()

console.log('\n=== FlipWork: copy piece + supply photos to the new project ===\n')
console.log('Find each value in Supabase: Project Settings -> API')
console.log('  • "Project URL"          (looks like https://abcd1234.supabase.co)')
console.log('  • "service_role" secret  (a long key — click reveal/copy)\n')

const SRC_URL = await ask('OLD project (flipwork-books) URL: ')
const SRC_KEY = await ask('OLD project service_role key:    ')
const DST_URL = await ask('NEW project (FlipWork Web App) URL: ')
const DST_KEY = await ask('NEW project service_role key:       ')
rl.close()

if (!SRC_URL || !SRC_KEY || !DST_URL || !DST_KEY) {
  console.error('\nMissing a value — nothing was changed. Run it again.')
  process.exit(1)
}

const src = createClient(SRC_URL, SRC_KEY, { auth: { persistSession: false } })
const dst = createClient(DST_URL, DST_KEY, { auth: { persistSession: false } })

// Which photos do the new records actually reference?
const paths = new Set()
for (const table of ['inventory_pieces', 'books_inventory_items']) {
  const { data, error } = await dst
    .from(table)
    .select('image_path')
    .eq('owner_user_id', OWNER)
    .not('image_path', 'is', null)
  if (error) {
    console.error(`\nCould not read ${table}: ${error.message}`)
    console.error('(Double-check the NEW project URL + key.)')
    process.exit(1)
  }
  for (const r of data) if (r.image_path) paths.add(r.image_path)
}

const list = [...paths]
console.log(`\nFound ${list.length} photos to copy. Starting…\n`)

let copied = 0, missing = 0, failed = 0
for (const path of list) {
  const { data: blob, error: dErr } = await src.storage.from(SRC_BUCKET).download(path)
  if (dErr || !blob) {
    console.log(`  - not found in old bucket: ${path}`)
    missing++
    continue
  }
  const buf = Buffer.from(await blob.arrayBuffer())
  const { error: uErr } = await dst.storage
    .from(DST_BUCKET)
    .upload(path, buf, { upsert: true, contentType: contentTypeFor(path) })
  if (uErr) {
    console.log(`  ! upload failed: ${path} -> ${uErr.message}`)
    failed++
    continue
  }
  copied++
  if (copied % 10 === 0) console.log(`  …${copied} copied`)
}

console.log(`\nDone. Copied ${copied}, not-found ${missing}, failed ${failed}, of ${list.length} total.`)
console.log('Open the Pipeline to see your piece photos. ✅\n')
process.exit(0)
