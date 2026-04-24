/**
 * Import questions from a JSON file into the database.
 *
 * Usage:
 *   npx tsx scripts/import-questions.ts path/to/questions.json
 *
 * The JSON file should be an array of question objects.
 * Duplicates are automatically skipped.
 */

import fs from 'fs'
import path from 'path'

const BATCH_SIZE = 500
const API_URL = process.env.API_URL || 'http://localhost:3000'

async function main() {
  const filePath = process.argv[2]
  if (!filePath) {
    console.error('Usage: npx tsx scripts/import-questions.ts <path-to-json>')
    process.exit(1)
  }

  const absolute = path.resolve(filePath)
  if (!fs.existsSync(absolute)) {
    console.error(`File not found: ${absolute}`)
    process.exit(1)
  }

  const raw = fs.readFileSync(absolute, 'utf-8')
  const questions = JSON.parse(raw)

  if (!Array.isArray(questions)) {
    console.error('JSON file must contain an array of question objects')
    process.exit(1)
  }

  console.log(`Loaded ${questions.length} questions from ${filePath}`)

  // Normalize values
  const normalized = questions.map((q: any) => ({
    exam_type: q.exam_type?.toUpperCase(),
    subject: titleCase(q.subject),
    question_type: q.question_type?.toLowerCase().trim(),
    difficulty: q.difficulty?.toLowerCase().trim(),
    question_text: q.question_text?.trim(),
    answer_choices: q.answer_choices ?? [],
    correct_answer: q.correct_answer?.trim(),
    explanation: q.explanation?.trim() ?? '',
    tags: q.tags ?? [],
    time_estimate: q.time_estimate ?? null,
  }))

  // Validate required fields
  const invalid = normalized.filter(
    (q: any, i: number) =>
      !q.exam_type || !q.subject || !q.question_type || !q.difficulty || !q.question_text || !q.correct_answer
  )
  if (invalid.length > 0) {
    console.error(`${invalid.length} questions are missing required fields. First bad entry:`)
    console.error(JSON.stringify(invalid[0], null, 2))
    process.exit(1)
  }

  // Insert directly via Supabase (no dev server needed)
  const { createClient } = await import('@supabase/supabase-js')

  const envContent = fs.readFileSync(path.resolve(process.cwd(), '.env.local'), 'utf-8')
  const getEnv = (key: string) => {
    const line = envContent.split('\n').find(l => l.startsWith(key))
    return line?.split('=').slice(1).join('=') ?? ''
  }

  const supabase = createClient(getEnv('NEXT_PUBLIC_SUPABASE_URL'), getEnv('SUPABASE_SERVICE_ROLE_KEY'))

  let inserted = 0
  let skipped = 0

  for (let i = 0; i < normalized.length; i++) {
    const q = normalized[i]
    const { error } = await supabase.from('questions').insert(q)

    if (error) {
      if (error.code === '23505') {
        skipped++
      } else {
        console.error(`\nFailed on question ${i + 1}:`, error.message)
        process.exit(1)
      }
    } else {
      inserted++
    }

    // Progress every 50
    if ((i + 1) % 50 === 0 || i === normalized.length - 1) {
      console.log(`  Progress: ${i + 1}/${normalized.length} (${inserted} inserted, ${skipped} duplicates skipped)`)
    }
  }

  console.log(`\nDone! Inserted ${inserted}/${normalized.length} questions (${skipped} duplicates skipped).`)
}

function titleCase(str: string): string {
  if (!str) return str
  return str
    .trim()
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

main().catch((err) => {
  console.error('Import failed:', err)
  process.exit(1)
})
