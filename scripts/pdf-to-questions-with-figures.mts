/**
 * Extract SAT/ACT questions from PDF practice tests, including cropped figures.
 *
 * Pipeline:
 *   1. Render each PDF page to PNG (cached in supabase/.temp/page-renders/<pdf>/).
 *   2. Send chunks of page images to Claude vision; ask for question content + figure bboxes.
 *   3. Crop each figure from its rendered page PNG, upload to Supabase Storage.
 *   4. Save enriched questions (with figure URLs) to the output JSON.
 *
 * Usage:
 *   npx tsx scripts/pdf-to-questions-with-figures.ts <input.pdf> <output.json> [SAT|ACT]
 *   npx tsx scripts/pdf-to-questions-with-figures.ts --dir <folder> <output.json> [SAT|ACT]
 *
 * Requires ANTHROPIC_API_KEY, NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY in .env.local.
 */

import Anthropic from '@anthropic-ai/sdk'
import { createClient, SupabaseClient } from '@supabase/supabase-js'
import * as mupdf from 'mupdf'
import sharp from 'sharp'
import fs from 'fs'
import path from 'path'
import crypto from 'crypto'

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

const CHUNK_SIZE = 6           // PDF pages per API call
const VIEWPORT_SCALE = 2       // ~1224x1584 px for letter pages
const FIGURE_PADDING = 10      // px padding added around each cropped bbox
const STORAGE_BUCKET = 'question-figures'
const MAX_OUTPUT_TOKENS = 24000

const EXTRACTION_PROMPT = `You are a precise SAT/ACT question extraction tool. Extract every practice question from pages {START_PAGE} through {END_PAGE} of this PDF into structured JSON.

RULES:
- Extract questions EXACTLY as written. Do not paraphrase.
- If a passage is referenced, include the FULL passage in question_text prefixed with "Passage:\\n".
- For any graph, table, chart, diagram, or illustration referenced by the question, list it in the "figures" array — DO NOT describe figures inside question_text.
  - page_offset: which page WITHIN THIS BATCH the figure appears on (0-indexed, where 0 = page {START_PAGE})
  - caption: short description of what the figure shows
- Extract every answer choice exactly as written.
- If an answer key is on these pages, use it. Otherwise give your best correct answer.
- If a question spans a page break, still output it once with its full text.

Per-question JSON:
{
  "exam_type": "{EXAM_TYPE}",
  "subject": "Math" | "Reading and Writing",
  "question_type": "<lowercase: algebra | advanced math | problem solving and data analysis | geometry and trigonometry | craft and structure | information and ideas | standard english conventions | expression of ideas>",
  "difficulty": "easy" | "medium" | "hard",
  "question_text": "<full question text — no figure descriptions>",
  "answer_choices": [{"label": "A", "text": "..."}],
  "correct_answer": "<letter>",
  "explanation": "<step-by-step>",
  "tags": ["..."],
  "time_estimate": <30-180 seconds>,
  "figures": [{"page_offset": 0, "caption": "..."}]
}

Output ONLY a valid JSON array. No commentary.`

const LOCALIZE_PROMPT = `You are a figure-localization tool. Below are {NUM_PAGES} consecutive pages from an SAT/ACT practice test, in order. The first image is page-offset 0, second is page-offset 1, etc.

For each numbered figure listed below, find which page it appears on AND its bounding box on that page. Do NOT extract or transcribe text — only locate visual figures (graphs, charts, tables, diagrams, illustrations).

Figures to locate:
{FIGURE_LIST}

For each figure, output:
- index: 1-based index from the list above
- page_offset: 0-based offset of the page in this batch where the figure appears
- bbox_pct: [x, y, w, h] as fractions of the page (0.0-1.0, top-left origin). Use a TIGHT rectangle around the visible figure including its axes/labels but NOT surrounding text.

Output ONLY a valid JSON array:
[{"index": 1, "page_offset": 2, "bbox_pct": [0.1, 0.2, 0.4, 0.3]}, ...]

Omit any figure that isn't actually visible on any page. No commentary.`

interface RawFigure {
  page_offset: number
  caption: string
}

interface RawExtractedQuestion {
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
  figures?: RawFigure[]
}

interface ExtractedQuestion extends Omit<RawExtractedQuestion, 'figures'> {
  figures: { url: string; caption: string }[]
}

async function renderPdfPages(pdfPath: string, cacheDirRelative: string): Promise<string[]> {
  const cacheDirAbs = path.resolve(cacheDirRelative)
  if (!fs.existsSync(cacheDirAbs)) fs.mkdirSync(cacheDirAbs, { recursive: true })

  const cached = fs.readdirSync(cacheDirAbs).filter((f) => f.endsWith('.png')).sort()
  if (cached.length > 0) {
    console.log(`  Using ${cached.length} cached page renders`)
    return cached.map((f) => path.join(cacheDirAbs, f))
  }

  // mupdf renders embedded fonts correctly — unlike @napi-rs/canvas-based libs.
  const pdfBuffer = fs.readFileSync(pdfPath)
  const doc = mupdf.Document.openDocument(pdfBuffer, 'application/pdf')
  const pageCount = doc.countPages()
  const matrix = mupdf.Matrix.scale(VIEWPORT_SCALE, VIEWPORT_SCALE)
  const out: string[] = []

  for (let i = 0; i < pageCount; i++) {
    const page = doc.loadPage(i)
    const pixmap = page.toPixmap(matrix, mupdf.ColorSpace.DeviceRGB, false)
    const pngBytes = pixmap.asPNG()
    const fileName = `page-${String(i + 1).padStart(4, '0')}.png`
    const filePath = path.join(cacheDirAbs, fileName)
    fs.writeFileSync(filePath, Buffer.from(pngBytes))
    out.push(filePath)
    pixmap.destroy?.()
    page.destroy?.()
  }
  doc.destroy?.()

  return out
}

async function extractChunk(
  client: Anthropic,
  pdfBase64: string,
  startPage: number,
  endPage: number,
  examType: string
): Promise<RawExtractedQuestion[]> {
  const prompt = EXTRACTION_PROMPT
    .replace('{EXAM_TYPE}', examType)
    .replace('{START_PAGE}', String(startPage))
    .replace('{END_PAGE}', String(endPage))

  // Streaming required for high max_tokens (SDK enforces this for long generations).
  const stream = client.messages.stream({
    model: 'claude-sonnet-4-6',
    max_tokens: MAX_OUTPUT_TOKENS,
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
            // @ts-ignore — cache_control supported on document blocks
            cache_control: { type: 'ephemeral' },
          },
          { type: 'text', text: prompt },
        ],
      },
    ],
  })
  const response = await stream.finalMessage()

  // Cost telemetry
  const usage = response.usage
  console.log(
    `    Usage: input=${usage.input_tokens}, output=${usage.output_tokens}` +
    (usage.cache_read_input_tokens ? `, cached=${usage.cache_read_input_tokens}` : '')
  )

  const text = response.content
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('')

  const m = text.match(/\[[\s\S]*\]/)
  if (!m) {
    console.log(`    No questions extracted from pages ${startPage}-${endPage}`)
    return []
  }

  try {
    return JSON.parse(m[0]) as RawExtractedQuestion[]
  } catch (e) {
    const debugPath = `debug-pages-${startPage}.txt`
    fs.writeFileSync(debugPath, text)
    console.error(`    JSON parse failed; raw output saved to ${debugPath}`)
    return []
  }
}

async function localizeFiguresInChunk(
  client: Anthropic,
  pageImagePaths: string[],
  captions: string[]
): Promise<Map<number, { pageOffset: number; bbox: [number, number, number, number] }>> {
  const figureList = captions.map((c, i) => `${i + 1}. ${c}`).join('\n')
  const prompt = LOCALIZE_PROMPT
    .replace('{NUM_PAGES}', String(pageImagePaths.length))
    .replace('{FIGURE_LIST}', figureList)

  const imageBlocks = pageImagePaths.map((p) => ({
    type: 'image' as const,
    source: {
      type: 'base64' as const,
      media_type: 'image/png' as const,
      data: fs.readFileSync(p).toString('base64'),
    },
  }))

  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 2000,
    messages: [
      {
        role: 'user',
        content: [
          ...imageBlocks,
          { type: 'text', text: prompt },
        ],
      },
    ],
  })

  const text = response.content
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('')

  const m = text.match(/\[[\s\S]*\]/)
  if (!m) return new Map()

  try {
    const parsed = JSON.parse(m[0]) as {
      index: number
      page_offset: number
      bbox_pct: [number, number, number, number]
    }[]
    const out = new Map<number, { pageOffset: number; bbox: [number, number, number, number] }>()
    for (const item of parsed) {
      if (item.bbox_pct && item.bbox_pct.length === 4 && typeof item.page_offset === 'number') {
        out.set(item.index - 1, { pageOffset: item.page_offset, bbox: item.bbox_pct })
      }
    }
    return out
  } catch {
    console.warn(`    Localize JSON parse failed`)
    return new Map()
  }
}

async function uploadFigureCrop(
  supabase: SupabaseClient,
  pageImagePath: string,
  bboxPct: [number, number, number, number],
  hashKey: string,
  index: number
): Promise<string> {
  const meta = await sharp(pageImagePath).metadata()
  const imgW = meta.width ?? 1
  const imgH = meta.height ?? 1

  const [xp, yp, wp, hp] = bboxPct
  const left = Math.max(0, Math.round(xp * imgW) - FIGURE_PADDING)
  const top = Math.max(0, Math.round(yp * imgH) - FIGURE_PADDING)
  const width = Math.min(imgW - left, Math.round(wp * imgW) + FIGURE_PADDING * 2)
  const height = Math.min(imgH - top, Math.round(hp * imgH) + FIGURE_PADDING * 2)

  if (width < 5 || height < 5) {
    throw new Error(`Invalid bbox_pct ${JSON.stringify(bboxPct)} for page ${imgW}x${imgH}`)
  }

  const buffer = await sharp(pageImagePath)
    .extract({ left, top, width, height })
    .png()
    .toBuffer()

  const fileName = `${hashKey}-${index}.png`
  const { error } = await supabase.storage
    .from(STORAGE_BUCKET)
    .upload(fileName, buffer, {
      contentType: 'image/png',
      upsert: true,
    })
  if (error) throw new Error(`Upload failed: ${error.message}`)

  const { data } = supabase.storage
    .from(STORAGE_BUCKET)
    .getPublicUrl(fileName)
  return data.publicUrl
}

async function processPdf(
  client: Anthropic,
  supabase: SupabaseClient,
  pdfPath: string,
  examType: string
): Promise<ExtractedQuestion[]> {
  const pdfName = path.basename(pdfPath, '.pdf')
  console.log(`\nProcessing: ${pdfName}`)

  const cacheDir = path.join('supabase/.temp/page-renders', pdfName)
  console.log('  Rendering pages to PNG...')
  const pageImagePaths = await renderPdfPages(pdfPath, cacheDir)
  console.log(`  ${pageImagePaths.length} pages ready`)

  const pdfBase64 = fs.readFileSync(pdfPath).toString('base64')
  const allQuestions: ExtractedQuestion[] = []

  for (let start = 0; start < pageImagePaths.length; start += CHUNK_SIZE) {
    const end = Math.min(start + CHUNK_SIZE, pageImagePaths.length)
    console.log(`  Pages ${start + 1}-${end}...`)

    let raw: RawExtractedQuestion[]
    try {
      raw = await extractChunk(client, pdfBase64, start + 1, end, examType)
    } catch (err: any) {
      console.error(`    Extraction error: ${err.message}`)
      continue
    }
    console.log(`    Extracted ${raw.length} questions`)

    // Collect all figures across this chunk's questions for one multi-page localize call.
    type FigureRef = { questionIdx: number; figureIdx: number; caption: string }
    const allFigures: FigureRef[] = []
    raw.forEach((q, qi) => {
      ;(q.figures ?? []).forEach((fig, fi) => {
        allFigures.push({ questionIdx: qi, figureIdx: fi, caption: fig.caption ?? '' })
      })
    })

    // Pass 2: single multi-page localize call per chunk.
    const bboxesAndPages = new Map<string, { pageOffset: number; bbox: [number, number, number, number] }>()
    if (allFigures.length > 0) {
      console.log(`    Localizing ${allFigures.length} figure(s) across pages ${start + 1}-${end}...`)
      try {
        const chunkPaths = pageImagePaths.slice(start, end)
        const located = await localizeFiguresInChunk(
          client,
          chunkPaths,
          allFigures.map((r) => r.caption)
        )
        for (let i = 0; i < allFigures.length; i++) {
          const item = located.get(i)
          if (item) {
            bboxesAndPages.set(`${allFigures[i].questionIdx}-${allFigures[i].figureIdx}`, item)
          }
        }
        console.log(`    Localized ${located.size}/${allFigures.length}`)
      } catch (err: any) {
        console.error(`    Localize error: ${err.message}`)
      }
    }

    // Crop + upload using the localized bboxes.
    for (let qi = 0; qi < raw.length; qi++) {
      const q = raw[qi]
      const hashKey = crypto
        .createHash('sha256')
        .update(`${pdfName}|${q.question_text.slice(0, 200)}`)
        .digest('hex')
        .slice(0, 16)

      const figureUrls: { url: string; caption: string }[] = []
      const rawFigures = q.figures ?? []

      for (let fi = 0; fi < rawFigures.length; fi++) {
        const fig = rawFigures[fi]
        const located = bboxesAndPages.get(`${qi}-${fi}`)
        if (!located) {
          console.warn(`    Figure not localized: "${fig.caption?.slice(0, 60)}"`)
          continue
        }
        const pageIdx = located.pageOffset + start
        if (pageIdx < 0 || pageIdx >= pageImagePaths.length) continue

        try {
          const url = await uploadFigureCrop(
            supabase,
            pageImagePaths[pageIdx],
            located.bbox,
            hashKey,
            fi
          )
          figureUrls.push({ url, caption: fig.caption ?? '' })
        } catch (err: any) {
          console.error(`    Figure upload failed: ${err.message}`)
        }
      }

      const { figures: _drop, ...rest } = q
      allQuestions.push({ ...rest, figures: figureUrls })
    }

    if (end < pageImagePaths.length) {
      await new Promise((r) => setTimeout(r, 1000))
    }
  }

  console.log(`  Total: ${allQuestions.length} questions, ${allQuestions.reduce((n, q) => n + q.figures.length, 0)} figures uploaded`)
  return allQuestions
}

async function main() {
  const args = process.argv.slice(2)
  let pdfPaths: string[] = []
  let outputPath: string
  let examType: string

  if (args[0] === '--dir') {
    const dir = path.resolve(args[1] ?? '')
    outputPath = args[2]
    examType = args[3] || 'SAT'

    if (!dir || !outputPath) {
      console.error('Usage: npx tsx scripts/pdf-to-questions-with-figures.ts --dir <folder> <output.json> [SAT|ACT]')
      process.exit(1)
    }

    pdfPaths = fs
      .readdirSync(dir)
      .filter((f) => f.toLowerCase().endsWith('.pdf'))
      .sort()
      .map((f) => path.join(dir, f))

    if (pdfPaths.length === 0) {
      console.error(`No PDFs in ${dir}`)
      process.exit(1)
    }
    console.log(`Found ${pdfPaths.length} PDFs in ${dir}`)
  } else {
    const pdfPath = args[0]
    outputPath = args[1]
    examType = args[2] || 'SAT'

    if (!pdfPath || !outputPath) {
      console.error('Usage: npx tsx scripts/pdf-to-questions-with-figures.ts <input.pdf> <output.json> [SAT|ACT]')
      process.exit(1)
    }
    pdfPaths = [path.resolve(pdfPath)]
  }

  const required = ['ANTHROPIC_API_KEY', 'NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY']
  for (const k of required) {
    if (!process.env[k]) {
      console.error(`Missing ${k} in .env.local`)
      process.exit(1)
    }
  }

  for (const p of pdfPaths) {
    if (!fs.existsSync(p)) {
      console.error(`File not found: ${p}`)
      process.exit(1)
    }
  }

  const client = new Anthropic()
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const allQuestions: ExtractedQuestion[] = []

  // Resume support: load existing
  const outAbs = path.resolve(outputPath)
  if (fs.existsSync(outAbs)) {
    const existing = JSON.parse(fs.readFileSync(outAbs, 'utf-8'))
    allQuestions.push(...existing)
    console.log(`Loaded ${existing.length} existing questions`)
  }

  for (const pdfPath of pdfPaths) {
    const questions = await processPdf(client, supabase, pdfPath, examType)
    allQuestions.push(...questions)
    fs.writeFileSync(outAbs, JSON.stringify(allQuestions, null, 2))
    console.log(`  Saved progress: ${allQuestions.length} total`)
  }

  console.log(`\nDone! ${allQuestions.length} questions saved to ${outputPath}`)
}

main().catch((err) => {
  console.error('Extraction failed:', err.message)
  process.exit(1)
})
