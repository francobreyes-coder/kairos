/**
 * Extract official answer keys from SAT answer PDFs and update questions.json
 *
 * Usage: node scripts/match-answers.mjs
 */

import Anthropic from '@anthropic-ai/sdk'
import fs from 'fs'
import path from 'path'

// Load .env.local
const envPath = path.resolve(process.cwd(), '.env.local')
const envContent = fs.readFileSync(envPath, 'utf-8')
for (const line of envContent.split('\n')) {
  const match = line.match(/^([^#=]+)=(.*)$/)
  if (match) process.env[match[1].trim()] = match[2].trim()
}

const client = new Anthropic()
const SAT_DB = path.resolve('C:/Users/franc/Downloads/SAT Database')

const answerFiles = [
  { file: 'SAT Explanations/sat-practice-test-4-answers-digital.pdf', testNum: 4 },
  { file: 'SAT Explanations/sat-practice-test-5-answers-digital.pdf', testNum: 5 },
  { file: 'SAT Explanations/sat-practice-test-6-answers-digital.pdf', testNum: 6 },
]

const ANSWER_PROMPT = `Extract the COMPLETE official answer key from this SAT practice test answer document.

For EVERY question, output the question number and correct answer letter (A, B, C, or D).
For student-produced response (SPR) / grid-in math questions, output the numeric answer.

Group by section:
1. Reading and Writing (Module 1 + Module 2) — typically 54 questions total
2. Math (Module 1 + Module 2) — typically 44 questions total

Output ONLY valid JSON in this exact format:
{
  "reading_and_writing": [
    {"question_number": 1, "correct_answer": "B"},
    {"question_number": 2, "correct_answer": "A"},
    ...
  ],
  "math": [
    {"question_number": 1, "correct_answer": "C"},
    ...
  ]
}

IMPORTANT:
- Include ALL questions, don't skip any
- Question numbering restarts at 1 for each section
- For Module 1 and Module 2 within a section, number them sequentially (Module 1 Q1-27 then Module 2 Q28-54 for R&W; Q1-22 then Q23-44 for Math)
- Output ONLY the JSON, no other text`

async function extractAnswerKey(pdfPath, testNum) {
  console.log(`\nExtracting answer key from test ${testNum}...`)
  const pdfBuffer = fs.readFileSync(pdfPath)
  const pdfBase64 = pdfBuffer.toString('base64')

  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 8000,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'document',
            source: {
              type: 'base64',
              media_type: 'application/pdf',
              data: pdfBase64,
            },
          },
          { type: 'text', text: ANSWER_PROMPT },
        ],
      },
    ],
  })

  const text = response.content
    .filter(b => b.type === 'text')
    .map(b => b.text)
    .join('')

  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) {
    console.error(`Failed to extract JSON for test ${testNum}`)
    fs.writeFileSync(`debug-answers-test-${testNum}.txt`, text)
    return null
  }

  try {
    const parsed = JSON.parse(jsonMatch[0])
    console.log(`  R&W answers: ${parsed.reading_and_writing.length}`)
    console.log(`  Math answers: ${parsed.math.length}`)
    return parsed
  } catch (e) {
    console.error(`Failed to parse JSON for test ${testNum}`)
    fs.writeFileSync(`debug-answers-test-${testNum}.txt`, text)
    return null
  }
}

async function main() {
  // Extract all answer keys
  const answerKeys = {}
  for (const { file, testNum } of answerFiles) {
    const pdfPath = path.join(SAT_DB, file)
    if (!fs.existsSync(pdfPath)) {
      console.error(`File not found: ${pdfPath}`)
      process.exit(1)
    }
    answerKeys[testNum] = await extractAnswerKey(pdfPath, testNum)
    // Brief pause between API calls
    await new Promise(r => setTimeout(r, 1000))
  }

  // Save raw answer keys for reference
  fs.writeFileSync('answer-keys.json', JSON.stringify(answerKeys, null, 2))
  console.log('\nSaved answer keys to answer-keys.json')

  // Load questions
  const questions = JSON.parse(fs.readFileSync('questions.json', 'utf-8'))
  console.log(`\nLoaded ${questions.length} questions`)

  // Figure out test boundaries
  // Questions were extracted in order: test 4, test 5, test 6
  // Each test has R&W first, then Math
  // Find subject switches to identify boundaries
  const segments = []
  let segStart = 0
  for (let i = 1; i <= questions.length; i++) {
    if (i === questions.length || questions[i].subject !== questions[segStart].subject) {
      segments.push({
        start: segStart,
        end: i - 1,
        count: i - segStart,
        subject: questions[segStart].subject,
      })
      segStart = i
    }
  }

  console.log('\nDetected segments:')
  segments.forEach((s, i) => console.log(`  ${i}: [${s.start}-${s.end}] ${s.subject} (${s.count} questions)`))

  // Expected pattern per test: R&W segment then Math segment
  // Digital SAT: 54 R&W + 44 Math = 98 per test
  // We need to pair segments into tests

  // Strategy: pair consecutive R&W + Math segments, assign to tests 4, 5, 6
  const tests = []
  let si = 0
  while (si < segments.length) {
    const rw = segments[si]
    const math = segments[si + 1]
    if (rw && rw.subject === 'Reading and Writing' && math && math.subject === 'Math') {
      tests.push({ rw, math })
      si += 2
    } else if (rw && rw.subject === 'Math') {
      // Orphan math segment - might be part of previous test
      console.warn(`  Warning: orphan Math segment at index ${si}`)
      if (tests.length > 0) {
        // Merge with previous test's math
        tests[tests.length - 1].math = {
          ...tests[tests.length - 1].math,
          end: rw.end,
          count: rw.end - tests[tests.length - 1].math.start + 1,
        }
      }
      si++
    } else {
      si++
    }
  }

  console.log(`\nIdentified ${tests.length} tests`)

  if (tests.length !== 3) {
    console.warn(`Expected 3 tests but found ${tests.length}. Will match what we can.`)
  }

  // Match answers to questions
  let updated = 0
  let mismatches = 0
  const testNums = [4, 5, 6]

  for (let t = 0; t < Math.min(tests.length, 3); t++) {
    const testNum = testNums[t]
    const key = answerKeys[testNum]
    if (!key) {
      console.log(`  Skipping test ${testNum} (no answer key)`)
      continue
    }

    const { rw, math } = tests[t]

    console.log(`\nTest ${testNum}:`)
    console.log(`  R&W: questions[${rw.start}..${rw.end}] (${rw.count} extracted) vs ${key.reading_and_writing.length} answers`)
    console.log(`  Math: questions[${math.start}..${math.end}] (${math.count} extracted) vs ${key.math.length} answers`)

    // Match R&W
    const rwAnswers = key.reading_and_writing
    const rwCount = Math.min(rw.count, rwAnswers.length)
    for (let i = 0; i < rwCount; i++) {
      const q = questions[rw.start + i]
      const official = rwAnswers[i].correct_answer
      if (q.correct_answer !== official) {
        mismatches++
        console.log(`    R&W Q${i + 1}: ${q.correct_answer} -> ${official}`)
        q.correct_answer = official
      }
      updated++
    }

    // Match Math
    const mathAnswers = key.math
    const mathCount = Math.min(math.count, mathAnswers.length)
    for (let i = 0; i < mathCount; i++) {
      const q = questions[math.start + i]
      const official = mathAnswers[i].correct_answer
      if (q.correct_answer !== official) {
        mismatches++
        console.log(`    Math Q${i + 1}: ${q.correct_answer} -> ${official}`)
        q.correct_answer = official
      }
      updated++
    }
  }

  console.log(`\n--- Summary ---`)
  console.log(`Questions checked: ${updated}`)
  console.log(`Answers corrected: ${mismatches}`)
  console.log(`Accuracy of extraction: ${((updated - mismatches) / updated * 100).toFixed(1)}%`)

  // Save updated questions
  fs.writeFileSync('questions.json', JSON.stringify(questions, null, 2))
  console.log(`\nUpdated questions.json saved!`)

  // Also save a backup
  fs.writeFileSync('questions-before-answer-match.json.bak', JSON.stringify(
    JSON.parse(fs.readFileSync('questions.json', 'utf-8')), null, 2
  ))
}

main().catch(err => {
  console.error('Failed:', err.message)
  process.exit(1)
})
