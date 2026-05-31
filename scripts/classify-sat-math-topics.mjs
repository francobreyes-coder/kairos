// One-shot backfill: classify every SAT Math question into the (category, topic)
// taxonomy and write the result back to the questions table.
//
// Usage:
//   node scripts/classify-sat-math-topics.mjs            # classify every row
//   node scripts/classify-sat-math-topics.mjs --only-empty   # skip rows that already have a topic
//   node scripts/classify-sat-math-topics.mjs --dry-run      # log decisions, do not update
//
// Requires:
//   .env.local with NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, ANTHROPIC_API_KEY
//   Migration supabase/migrations/20260530120000_questions_topic.sql applied first.

import fs from 'fs'
import { createClient } from '@supabase/supabase-js'
import Anthropic from '@anthropic-ai/sdk'

const env = fs.readFileSync('.env.local', 'utf-8')
const getEnv = (k) =>
  env.split('\n').find((l) => l.startsWith(`${k}=`))?.split('=').slice(1).join('=').trim() ?? ''

const SUPABASE_URL = getEnv('NEXT_PUBLIC_SUPABASE_URL')
const SUPABASE_KEY = getEnv('SUPABASE_SERVICE_ROLE_KEY')
const ANTHROPIC_API_KEY = getEnv('ANTHROPIC_API_KEY')
if (!SUPABASE_URL || !SUPABASE_KEY) throw new Error('Missing Supabase env')
if (!ANTHROPIC_API_KEY) throw new Error('Missing ANTHROPIC_API_KEY')

const sb = createClient(SUPABASE_URL, SUPABASE_KEY)
const anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY })

const args = process.argv.slice(2)
const ONLY_EMPTY = args.includes('--only-empty')
const DRY_RUN = args.includes('--dry-run')

// Authoritative taxonomy. Keep in sync with the admin docs and any future
// taxonomy-only edits — this is what gets sent to the classifier and what we
// validate the response against.
const TAXONOMY = {
  'Algebra': [
    'Linear equations and inequalities',
    'Linear equation word problems',
    'Linear relationship word problems',
    'Graphs of linear equations and functions',
    'Systems of linear equations',
    'Systems of linear equations word problems',
    'Linear inequality word problems',
    'Graphs of linear systems and inequalities',
  ],
  'Problem solving and data analysis': [
    'Ratios, rates, and proportions',
    'Unit conversion',
    'Percentages',
    'Center, spread, and shape of distributions',
    'Data representations',
    'Scatterplots',
    'Linear and exponential growth',
    'Probability and relative frequency',
    'Data inferences',
    'Evaluating statistical claims',
  ],
  'Advanced math': [
    'Factoring quadratic and polynomial expressions',
    'Radicals and rational exponents',
    'Operations with polynomials',
    'Operations with rational expressions',
    'Nonlinear functions',
    'Isolating quantities',
    'Solving quadratic equations',
    'Linear and quadratic systems',
    'Radical, rational, and absolute value equations',
    'Quadratic graphs',
    'Exponential graphs',
    'Polynomial and other nonlinear graphs',
  ],
  'Geometry and trigonometry': [
    'Area and volume',
    'Congruence, similarity, and angle relationships',
    'Right triangle trigonometry',
    'Circle theorems',
    'Unit circle trigonometry',
    'Circle equations',
  ],
}

const VALID_CATEGORIES = Object.keys(TAXONOMY)
const VALID_PAIRS = new Set()
for (const [cat, topics] of Object.entries(TAXONOMY)) {
  for (const t of topics) VALID_PAIRS.add(`${cat}::${t}`)
}

const SYSTEM_PROMPT = `You classify SAT Math questions into a two-level taxonomy.

For every question you receive, choose exactly one (category, topic) pair from the taxonomy below. Pick the most specific topic that fits the core mathematical work the question requires. If a question could plausibly fit two topics, choose the one that captures the work the student must do to solve it (not the surface dressing).

Taxonomy:

${Object.entries(TAXONOMY)
  .map(
    ([cat, topics]) =>
      `${cat}\n${topics.map((t) => `  - ${t}`).join('\n')}`,
  )
  .join('\n\n')}

Rules:
- "category" must be one of the four category labels above, exactly.
- "topic" must be one of the topics listed under that category, exactly.
- Do not invent new categories or topics, and do not paraphrase the labels.
- Use the question_type hint as a prior, not a constraint — override it when the question clearly belongs elsewhere.`

const OUTPUT_SCHEMA = {
  type: 'object',
  properties: {
    category: { type: 'string', enum: VALID_CATEGORIES },
    topic: { type: 'string' },
    reasoning: { type: 'string' },
  },
  required: ['category', 'topic'],
  additionalProperties: false,
}

function stripHtml(html) {
  return (html ?? '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim()
}

function buildUserContent(q) {
  const text = stripHtml(q.question_text).slice(0, 2000)
  const choices = (q.answer_choices ?? [])
    .map((c) => `${c.label}) ${stripHtml(c.text)}`)
    .join('\n')
  return [
    `question_type hint: ${q.question_type}`,
    '',
    `Question:`,
    text,
    choices ? `\nAnswer choices:\n${choices}` : '',
  ]
    .filter(Boolean)
    .join('\n')
}

async function classifyOnce(messages) {
  const response = await anthropic.messages.create({
    model: 'claude-haiku-4-5',
    max_tokens: 512,
    system: [
      {
        type: 'text',
        text: SYSTEM_PROMPT,
        cache_control: { type: 'ephemeral' },
      },
    ],
    output_config: {
      format: { type: 'json_schema', schema: OUTPUT_SCHEMA },
    },
    messages,
  })
  const textBlock = response.content.find((b) => b.type === 'text')
  if (!textBlock) throw new Error('No text block in response')
  return { parsed: JSON.parse(textBlock.text), assistantContent: response.content, usage: response.usage }
}

async function classify(q) {
  const messages = [{ role: 'user', content: buildUserContent(q) }]
  let { parsed, assistantContent, usage } = await classifyOnce(messages)
  let pair = `${parsed.category}::${parsed.topic}`

  if (!VALID_PAIRS.has(pair)) {
    // One retry: tell the model exactly what went wrong and let it self-correct.
    const allowed = (TAXONOMY[parsed.category] ?? [])
      .map((t) => `  - ${parsed.category} / ${t}`)
      .join('\n')
    messages.push({ role: 'assistant', content: assistantContent })
    messages.push({
      role: 'user',
      content:
        `Your previous answer "${parsed.category} / ${parsed.topic}" is not a valid pair in the taxonomy. ` +
        `The category and topic must both come verbatim from the taxonomy, and the topic must be one of the topics listed under that category.\n\n` +
        (allowed
          ? `If "${parsed.category}" is the right category, valid topics under it are:\n${allowed}\n\n`
          : '') +
        `Re-classify the question, picking exactly one valid (category, topic) pair.`,
    })
    const retry = await classifyOnce(messages)
    parsed = retry.parsed
    usage = {
      input_tokens: (usage.input_tokens ?? 0) + (retry.usage.input_tokens ?? 0),
      output_tokens: (usage.output_tokens ?? 0) + (retry.usage.output_tokens ?? 0),
      cache_read_input_tokens:
        (usage.cache_read_input_tokens ?? 0) + (retry.usage.cache_read_input_tokens ?? 0),
      cache_creation_input_tokens:
        (usage.cache_creation_input_tokens ?? 0) + (retry.usage.cache_creation_input_tokens ?? 0),
    }
    pair = `${parsed.category}::${parsed.topic}`
    if (!VALID_PAIRS.has(pair)) {
      throw new Error(`Invalid taxonomy pair after retry: ${pair}`)
    }
  }

  return { category: parsed.category, topic: parsed.topic, usage }
}

async function main() {
  let query = sb
    .from('questions')
    .select('id, question_type, question_text, answer_choices, topic')
    .eq('exam_type', 'SAT')
    .eq('subject', 'Math')
    .order('created_at', { ascending: true })

  if (ONLY_EMPTY) query = query.is('topic', null)

  const { data: questions, error } = await query
  if (error) throw error
  console.log(`Classifying ${questions.length} SAT Math questions…`)
  if (DRY_RUN) console.log('(dry run — no DB writes)')

  let ok = 0
  let failed = 0
  let totalRead = 0
  let totalWrite = 0
  let totalInput = 0
  let totalOutput = 0

  for (let i = 0; i < questions.length; i++) {
    const q = questions[i]
    try {
      const result = await classify(q)
      totalRead += result.usage.cache_read_input_tokens ?? 0
      totalWrite += result.usage.cache_creation_input_tokens ?? 0
      totalInput += result.usage.input_tokens ?? 0
      totalOutput += result.usage.output_tokens ?? 0

      console.log(
        `[${i + 1}/${questions.length}] ${q.id.slice(0, 8)} → ${result.category} / ${result.topic}`,
      )

      if (!DRY_RUN) {
        const { error: updateError } = await sb
          .from('questions')
          .update({
            question_type: result.category,
            topic: result.topic,
            updated_at: new Date().toISOString(),
          })
          .eq('id', q.id)
        if (updateError) throw updateError
      }
      ok++
    } catch (err) {
      console.error(
        `[${i + 1}/${questions.length}] ${q.id.slice(0, 8)} FAILED: ${err.message}`,
      )
      failed++
    }
  }

  console.log('\nDone.')
  console.log(`  ok:     ${ok}`)
  console.log(`  failed: ${failed}`)
  console.log(
    `  tokens: input=${totalInput} cache_read=${totalRead} cache_write=${totalWrite} output=${totalOutput}`,
  )
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
