import { NextRequest, NextResponse } from 'next/server'
import { fetchQuestions, bulkInsertQuestions, type QuestionFilters } from '@/lib/questions'

// GET /api/questions?exam_type=SAT&subject=Math&difficulty=medium&limit=20&randomize=true
export async function GET(req: NextRequest) {
  try {
    const params = req.nextUrl.searchParams

    const filters: QuestionFilters = {}
    if (params.get('exam_type')) filters.exam_type = params.get('exam_type') as 'SAT' | 'ACT'
    if (params.get('subject')) filters.subject = params.get('subject')!
    if (params.get('question_type')) filters.question_type = params.get('question_type')!
    if (params.get('difficulty')) filters.difficulty = params.get('difficulty') as 'easy' | 'medium' | 'hard'
    if (params.get('tags')) filters.tags = params.get('tags')!.split(',')
    if (params.get('limit')) filters.limit = parseInt(params.get('limit')!, 10)
    if (params.get('randomize') === 'true') filters.randomize = true

    const questions = await fetchQuestions(filters)
    return NextResponse.json({ questions, count: questions.length })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// POST /api/questions — bulk insert questions
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { questions } = body

    if (!Array.isArray(questions) || questions.length === 0) {
      return NextResponse.json({ error: 'questions array is required' }, { status: 400 })
    }

    const result = await bulkInsertQuestions(questions)
    return NextResponse.json(result)
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
