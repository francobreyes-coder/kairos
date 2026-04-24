/**
 * Extract SAT/ACT questions from PDF practice tests using Claude.
 *
 * Processes PDFs in page-range chunks for accuracy over quantity.
 *
 * Usage:
 *   npx tsx scripts/pdf-to-questions.ts <input.pdf> <output.json> [exam_type]
 *   npx tsx scripts/pdf-to-questions.ts --dir <folder> <output.json> [exam_type]
 *
 * Examples:
 *   npx tsx scripts/pdf-to-questions.ts sat-practice-test-4.pdf questions.json SAT
 *   npx tsx scripts/pdf-to-questions.ts --dir "C:/Users/franc/Downloads/SAT Database" questions.json SAT
 *
 * Requires ANTHROPIC_API_KEY in your .env.local or environment.
 */

import Anthropic from '@anthropic-ai/sdk'
import fs from 'fs'
import path from 'path'

// Load .env.local
const envPath = path.resolve(process.cwd(), '.env.local')
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf-8')
  for (const line of envContent.split('\n')) {
    const match = line.match(/^([^#=]+)=(.*)$/)
    if (match) {
      process.env[match[1].trim()] = match[2].trim()
    }
  }
}

const CHUNK_SIZE = 15 // pages per API call — small enough for high accuracy

const EXTRACTION_PROMPT = `You are a precise SAT/ACT question extraction tool. Extract every practice question from these PDF pages into structured JSON.

IMPORTANT RULES FOR ACCURACY:
- Extract the question EXACTLY as written — do not paraphrase or summarize
- Include ALL context needed to answer (passages, tables, figures described in text, graphs)
- If a question references a passage or text, include the full passage in question_text prefixed with "Passage:\\n"
- If a question references a graph/table/figure, describe it precisely in question_text prefixed with "[Figure: ...]"
- For math questions, preserve all mathematical notation as clearly as possible
- Extract EVERY answer choice exactly as written
- If an answer key is present on these pages, use it. Otherwise provide the correct answer.
- Do NOT skip any questions. If a question spans a page break, still include it fully.
- If a page has no questions (e.g. instructions, cover page), return an empty array for those pages.

For EACH question output this exact structure:
{
  "exam_type": "{EXAM_TYPE}",
  "subject": "<one of: Math, Reading and Writing>",
  "question_type": "<lowercase label — see list below>",
  "difficulty": "<easy | medium | hard>",
  "question_text": "<full question text including any referenced passage>",
  "answer_choices": [{"label": "A", "text": "..."}, ...],
  "correct_answer": "<letter>",
  "explanation": "<clear step-by-step explanation>",
  "tags": ["<1-3 lowercase tags>"],
  "time_estimate": <seconds, 30-180>
}

Question type labels to use:
- Reading and Writing: "craft and structure", "information and ideas", "standard english conventions", "expression of ideas"
- Math: "algebra", "advanced math", "problem solving and data analysis", "geometry and trigonometry"

Difficulty guide:
- easy: straightforward, single-step
- medium: requires 2-3 steps or moderate reasoning
- hard: multi-step, complex reasoning, or tricky wording

Output ONLY a valid JSON array. No commentary before or after.`

interface ExtractedQuestion {
  exam_type: string
  subject: string
  question_type: string
  difficulty: string
  question_text: string
  answer_choices: { label: string; text: string }[]
  correct_answer: string
  explanation: string
  tags: string[]
  time_estimate: number
}

async function extractChunk(
  client: Anthropic,
  pdfBase64: string,
  pageStart: number,
  pageEnd: number,
  examType: string,
  pdfName: string
): Promise<ExtractedQuestion[]> {
  const prompt = EXTRACTION_PROMPT.replace('{EXAM_TYPE}', examType)

  console.log(`  Processing pages ${pageStart}-${pageEnd} of ${pdfName}...`)

  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 16000,
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
            // @ts-ignore — page range support
            cache_control: { type: 'ephemeral' },
          },
          {
            type: 'text',
            text: `${prompt}\n\nExtract questions from pages ${pageStart} through ${pageEnd} ONLY.`,
          },
        ],
      },
    ],
  })

  const text = response.content
    .filter((block): block is Anthropic.TextBlock => block.type === 'text')
    .map((block) => block.text)
    .join('')

  const jsonMatch = text.match(/\[[\s\S]*\]/)
  if (!jsonMatch) {
    console.log(`    No questions found on pages ${pageStart}-${pageEnd}`)
    return []
  }

  try {
    const questions = JSON.parse(jsonMatch[0]) as ExtractedQuestion[]
    console.log(`    Extracted ${questions.length} questions`)
    return questions
  } catch (e) {
    console.error(`    Failed to parse JSON for pages ${pageStart}-${pageEnd}`)
    // Save raw output for debugging
    const debugPath = `debug-pages-${pageStart}-${pageEnd}.txt`
    fs.writeFileSync(debugPath, text)
    console.error(`    Raw output saved to ${debugPath}`)
    return []
  }
}

function estimatePageCount(pdfBuffer: Buffer): number {
  // Count /Type /Page (not /Pages) occurrences as a rough estimate
  const str = pdfBuffer.toString('latin1')
  const matches = str.match(/\/Type\s*\/Page[^s]/g)
  return matches ? matches.length : 60 // default guess
}

async function processPdf(
  client: Anthropic,
  pdfPath: string,
  examType: string
): Promise<ExtractedQuestion[]> {
  const pdfName = path.basename(pdfPath)
  console.log(`\nProcessing: ${pdfName}`)

  const pdfBuffer = fs.readFileSync(pdfPath)
  const pdfBase64 = pdfBuffer.toString('base64')
  const sizeMB = pdfBuffer.length / (1024 * 1024)
  const estimatedPages = estimatePageCount(pdfBuffer)

  console.log(`  Size: ${sizeMB.toFixed(1)} MB, ~${estimatedPages} pages`)

  const allQuestions: ExtractedQuestion[] = []

  for (let start = 1; start <= estimatedPages; start += CHUNK_SIZE) {
    const end = Math.min(start + CHUNK_SIZE - 1, estimatedPages)
    const questions = await extractChunk(client, pdfBase64, start, end, examType, pdfName)
    allQuestions.push(...questions)

    // Brief pause between chunks to avoid rate limits
    if (end < estimatedPages) {
      await new Promise((r) => setTimeout(r, 1000))
    }
  }

  console.log(`  Total from ${pdfName}: ${allQuestions.length} questions`)
  return allQuestions
}

async function main() {
  const args = process.argv.slice(2)
  let pdfPaths: string[] = []
  let outputPath: string
  let examType: string

  if (args[0] === '--dir') {
    // Directory mode
    const dir = path.resolve(args[1])
    outputPath = args[2]
    examType = args[3] || 'SAT'

    if (!dir || !outputPath) {
      console.error('Usage: npx tsx scripts/pdf-to-questions.ts --dir <folder> <output.json> [SAT|ACT]')
      process.exit(1)
    }

    pdfPaths = fs
      .readdirSync(dir)
      .filter((f) => f.toLowerCase().endsWith('.pdf'))
      .sort()
      .map((f) => path.join(dir, f))

    if (pdfPaths.length === 0) {
      console.error(`No PDF files found in ${dir}`)
      process.exit(1)
    }

    console.log(`Found ${pdfPaths.length} PDFs in ${dir}`)
  } else {
    // Single file mode
    const pdfPath = args[0]
    outputPath = args[1]
    examType = args[2] || 'SAT'

    if (!pdfPath || !outputPath) {
      console.error('Usage: npx tsx scripts/pdf-to-questions.ts <input.pdf> <output.json> [SAT|ACT]')
      process.exit(1)
    }

    pdfPaths = [path.resolve(pdfPath)]
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('Missing ANTHROPIC_API_KEY. Set it in .env.local or your environment.')
    process.exit(1)
  }

  for (const p of pdfPaths) {
    if (!fs.existsSync(p)) {
      console.error(`File not found: ${p}`)
      process.exit(1)
    }
  }

  const client = new Anthropic()
  const allQuestions: ExtractedQuestion[] = []

  // Load existing output if present
  const outAbsolute = path.resolve(outputPath)
  if (fs.existsSync(outAbsolute)) {
    const existing = JSON.parse(fs.readFileSync(outAbsolute, 'utf-8'))
    allQuestions.push(...existing)
    console.log(`Loaded ${existing.length} existing questions from ${outputPath}`)
  }

  // Process each PDF
  for (const pdfPath of pdfPaths) {
    const questions = await processPdf(client, pdfPath, examType)
    allQuestions.push(...questions)

    // Save after each PDF in case of interruption
    fs.writeFileSync(outAbsolute, JSON.stringify(allQuestions, null, 2))
    console.log(`  Saved progress: ${allQuestions.length} total questions`)
  }

  console.log(`\nDone! ${allQuestions.length} total questions saved to ${outputPath}`)
}

main().catch((err) => {
  console.error('Extraction failed:', err.message)
  process.exit(1)
})
