import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import {
  generateTestQuestions,
  saveTest,
  listTests,
  countQuestions,
} from '@/lib/tests'
import { getSubjects, getQuestionTypes } from '@/lib/questions'
import type { QuestionFilters } from '@/lib/questions'

// GET /api/tests — list tutor's tests, or get filter options
export async function GET(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const params = req.nextUrl.searchParams
    const action = params.get('action')

    // Get subjects for an exam type
    if (action === 'subjects') {
      const examType = params.get('exam_type') as 'SAT' | 'ACT'
      if (!examType) return NextResponse.json({ error: 'exam_type required' }, { status: 400 })
      const subjects = await getSubjects(examType)
      return NextResponse.json({ subjects })
    }

    // Get question types for exam + subject
    if (action === 'question_types') {
      const examType = params.get('exam_type') as 'SAT' | 'ACT'
      const subject = params.get('subject')
      if (!examType || !subject) {
        return NextResponse.json({ error: 'exam_type and subject required' }, { status: 400 })
      }
      const types = await getQuestionTypes(examType, subject)
      return NextResponse.json({ question_types: types })
    }

    // Count available questions for filters
    if (action === 'count') {
      const filters: QuestionFilters = {}
      if (params.get('exam_type')) filters.exam_type = params.get('exam_type') as 'SAT' | 'ACT'
      if (params.get('subject')) filters.subject = params.get('subject')!
      if (params.get('question_type')) filters.question_type = params.get('question_type')!
      if (params.get('difficulty')) filters.difficulty = params.get('difficulty') as any
      const count = await countQuestions(filters)
      return NextResponse.json({ count })
    }

    // Default: list tutor's saved tests
    const tests = await listTests(session.user.email)
    return NextResponse.json({ tests })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// POST /api/tests — generate preview or save a test
export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { action } = body

    // Generate a randomized question set (preview, not saved)
    if (action === 'generate') {
      const { filters } = body
      if (!filters?.exam_type) {
        return NextResponse.json({ error: 'exam_type is required' }, { status: 400 })
      }
      const questions = await generateTestQuestions(filters)
      return NextResponse.json({ questions, count: questions.length })
    }

    // Save a test
    if (action === 'save') {
      const { name, exam_type, filters, question_ids } = body
      if (!name || !exam_type || !question_ids?.length) {
        return NextResponse.json(
          { error: 'name, exam_type, and question_ids are required' },
          { status: 400 }
        )
      }
      const test = await saveTest(
        session.user.email,
        name,
        exam_type,
        filters ?? {},
        question_ids
      )
      return NextResponse.json({ test })
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
