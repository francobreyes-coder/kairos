/**
 * Convert a CSV of questions to the JSON format expected by the import script.
 *
 * Usage:
 *   npx tsx scripts/csv-to-questions-json.ts input.csv output.json
 *
 * Expected CSV columns:
 *   exam_type, subject, question_type, difficulty, question_text,
 *   answer_a, answer_b, answer_c, answer_d, correct_answer, explanation,
 *   tags (optional, comma-separated), time_estimate (optional, seconds)
 */

import fs from 'fs'
import path from 'path'

function parseCSV(text: string): Record<string, string>[] {
  const lines = text.split('\n').filter((l) => l.trim())
  if (lines.length < 2) return []

  const headers = parseLine(lines[0])
  return lines.slice(1).map((line) => {
    const values = parseLine(line)
    const row: Record<string, string> = {}
    headers.forEach((h, i) => {
      row[h.trim().toLowerCase()] = values[i]?.trim() ?? ''
    })
    return row
  })
}

function parseLine(line: string): string[] {
  const result: string[] = []
  let current = ''
  let inQuotes = false

  for (const char of line) {
    if (char === '"') {
      inQuotes = !inQuotes
    } else if (char === ',' && !inQuotes) {
      result.push(current)
      current = ''
    } else {
      current += char
    }
  }
  result.push(current)
  return result
}

function main() {
  const [inputPath, outputPath] = [process.argv[2], process.argv[3]]

  if (!inputPath || !outputPath) {
    console.error('Usage: npx tsx scripts/csv-to-questions-json.ts <input.csv> <output.json>')
    process.exit(1)
  }

  const csv = fs.readFileSync(path.resolve(inputPath), 'utf-8')
  const rows = parseCSV(csv)

  console.log(`Parsed ${rows.length} rows from CSV`)

  const questions = rows.map((row) => ({
    exam_type: row.exam_type,
    subject: row.subject,
    question_type: row.question_type,
    difficulty: row.difficulty,
    question_text: row.question_text,
    answer_choices: [
      { label: 'A', text: row.answer_a || '' },
      { label: 'B', text: row.answer_b || '' },
      { label: 'C', text: row.answer_c || '' },
      { label: 'D', text: row.answer_d || '' },
    ].filter((c) => c.text),
    correct_answer: row.correct_answer,
    explanation: row.explanation || '',
    tags: row.tags ? row.tags.split(',').map((t: string) => t.trim()) : [],
    time_estimate: row.time_estimate ? parseInt(row.time_estimate, 10) : null,
  }))

  fs.writeFileSync(path.resolve(outputPath), JSON.stringify(questions, null, 2))
  console.log(`Wrote ${questions.length} questions to ${outputPath}`)
}

main()
