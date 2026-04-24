import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import path from 'path'

// Load .env.local
const envContent = fs.readFileSync(path.resolve('.','.env.local'), 'utf-8')
const getEnv = (key) => {
  const line = envContent.split('\n').find(l => l.startsWith(key))
  return line?.split('=').slice(1).join('=') ?? ''
}

const supabase = createClient(getEnv('NEXT_PUBLIC_SUPABASE_URL'), getEnv('SUPABASE_SERVICE_ROLE_KEY'))

const filePath = process.argv[2]
if (!filePath) { console.error('Usage: node scripts/import-questions.mjs <path-to-json>'); process.exit(1) }

const questions = JSON.parse(fs.readFileSync(path.resolve(filePath), 'utf-8'))
console.log(`Loaded ${questions.length} questions`)

function titleCase(str) {
  if (!str) return str
  return str.trim().toLowerCase().replace(/\b\w/g, c => c.toUpperCase())
}

let inserted = 0
let skipped = 0

for (let i = 0; i < questions.length; i++) {
  const q = questions[i]
  const normalized = {
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
  }

  const { error } = await supabase.from('questions').insert(normalized)

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

  if ((i + 1) % 50 === 0 || i === questions.length - 1) {
    console.log(`  Progress: ${i + 1}/${questions.length} (${inserted} inserted, ${skipped} duplicates skipped)`)
  }
}

console.log(`\nDone! Inserted ${inserted}/${questions.length} questions (${skipped} duplicates skipped).`)
