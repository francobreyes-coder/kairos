/**
 * Update correct_answer in Supabase for all questions using corrected questions.json
 * Matches by question_text since that's unique per question.
 */

import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import path from 'path'

const envContent = fs.readFileSync(path.resolve('.', '.env.local'), 'utf-8')
const getEnv = (key) => {
  const line = envContent.split('\n').find(l => l.startsWith(key))
  return line?.split('=').slice(1).join('=') ?? ''
}

const supabase = createClient(getEnv('NEXT_PUBLIC_SUPABASE_URL'), getEnv('SUPABASE_SERVICE_ROLE_KEY'))

const questions = JSON.parse(fs.readFileSync('questions.json', 'utf-8'))
console.log(`Loaded ${questions.length} questions to update`)

let updated = 0
let failed = 0
let notFound = 0

for (let i = 0; i < questions.length; i++) {
  const q = questions[i]

  const { data, error } = await supabase
    .from('questions')
    .update({ correct_answer: q.correct_answer })
    .eq('question_text', q.question_text)
    .select('id')

  if (error) {
    console.error(`  Failed Q${i + 1}:`, error.message)
    failed++
  } else if (!data || data.length === 0) {
    notFound++
  } else {
    updated++
  }

  if ((i + 1) % 50 === 0 || i === questions.length - 1) {
    console.log(`  Progress: ${i + 1}/${questions.length} (${updated} updated, ${notFound} not found, ${failed} failed)`)
  }
}

console.log(`\nDone! ${updated} updated, ${notFound} not found in DB, ${failed} failed.`)
