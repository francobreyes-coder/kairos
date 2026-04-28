import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import {
  generateTestSections,
  saveSectionedTest,
  listTests,
  countQuestions,
  type TestSectionFilters,
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

// POST /api/tests — generate preview or save a test.
//
//   generate: { action, exam_type, sections: [{ label, subject, ... }] }
//             → { sections: [{ label, questions: [...] }] }
//   save:     { action, name, exam_type, sections: [{ label, ..., question_ids: [...] }] }
//             → { test }
export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { action } = body

    if (action === 'generate') {
      const examType = body.exam_type as 'SAT' | 'ACT'
      if (!examType) {
        return NextResponse.json({ error: 'exam_type is required' }, { status: 400 })
      }
      const sections = (body.sections ?? []) as TestSectionFilters[]
      if (!Array.isArray(sections) || sections.length === 0) {
        return NextResponse.json({ error: 'at least one section is required' }, { status: 400 })
      }
      const result = await generateTestSections(examType, sections)
      return NextResponse.json({ sections: result })
    }

    if (action === 'save') {
      const { name, exam_type, sections } = body
      if (!name || !exam_type || !Array.isArray(sections) || sections.length === 0) {
        return NextResponse.json(
          { error: 'name, exam_type, and at least one section are required' },
          { status: 400 },
        )
      }
      const totalQs = sections.reduce(
        (a: number, s: any) => a + (s.question_ids?.length ?? 0),
        0,
      )
      if (totalQs === 0) {
        return NextResponse.json(
          { error: 'no questions selected — re-generate the preview' },
          { status: 400 },
        )
      }
      const test = await saveSectionedTest(session.user.email, name, exam_type, sections)
      return NextResponse.json({ test })
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
