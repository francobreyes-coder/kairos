/**
 * Tutor-Student Matching Algorithm
 *
 * Scoring formula (max 100 points):
 *   - Shared subjects/academic interests:  30 pts  (6 pts per match, up to 5)
 *   - Shared personal interests:           20 pts  (5 pts per match, up to 4)
 *   - College overlap:                     20 pts  (tutor's college is in student's list)
 *   - Major similarity:                    15 pts  (exact or partial match)
 *   - Teaching style match:                10 pts  (exact match)
 *   - Goal ↔ Service alignment:             5 pts  (any goal maps to a tutor service)
 */

export interface StudentProfile {
  interests: string[]
  intended_major: string
  colleges_of_interest: string[]
  goals: string[]
  preferred_teaching_style: string
  tutor_personality: string[]
}

export interface TutorProfile {
  user_id: string
  bio: string
  profile_photo?: string | null
  subjects: string[]
  college: string
  major: string
  interests: string[]
  teaching_style: string
  services: string[]
  availability: Record<string, string[]>
  profile_completed: boolean
}

export interface MatchResult {
  tutor: TutorProfile
  score: number
  reasons: string[]
}

// Maps student goal IDs to tutor service IDs
const GOAL_TO_SERVICE: Record<string, string> = {
  'essay-help': 'essays',
  'test-prep': 'sat-act',
  'activities': 'activities',
}

function normalize(s: string): string {
  return s.toLowerCase().trim()
}

function intersect(a: string[], b: string[]): string[] {
  const setB = new Set(b.map(normalize))
  return a.filter((item) => setB.has(normalize(item)))
}

function majorSimilarity(studentMajor: string, tutorMajor: string): 'exact' | 'partial' | 'none' {
  if (!studentMajor || !tutorMajor) return 'none'
  const s = normalize(studentMajor)
  const t = normalize(tutorMajor)
  if (s === t) return 'exact'
  // Partial: one contains the other or they share a significant word
  if (s.includes(t) || t.includes(s)) return 'partial'
  const sWords = s.split(/\s+/).filter((w) => w.length > 3)
  const tWords = new Set(t.split(/\s+/).filter((w) => w.length > 3))
  if (sWords.some((w) => tWords.has(w))) return 'partial'
  return 'none'
}

export function computeMatchScore(student: StudentProfile, tutor: TutorProfile): MatchResult {
  let score = 0
  const reasons: string[] = []

  // 1. Shared subjects / academic interests (max 30 pts)
  // Student "interests" are academic subjects; tutor has "subjects"
  const sharedSubjects = intersect(student.interests, tutor.subjects)
  const subjectPts = Math.min(sharedSubjects.length * 6, 30)
  score += subjectPts
  if (sharedSubjects.length > 0) {
    reasons.push(`You're both into ${sharedSubjects.slice(0, 3).join(', ')}`)
  }

  // 2. Shared personal interests (max 20 pts)
  // Some student interests (Music, Sports, etc.) overlap with tutor personal interests
  const sharedInterests = intersect(student.interests, tutor.interests)
  const interestPts = Math.min(sharedInterests.length * 5, 20)
  score += interestPts
  if (sharedInterests.length > 0) {
    reasons.push(`You both enjoy ${sharedInterests.slice(0, 3).join(', ')}`)
  }

  // 3. College overlap (20 pts)
  const collegeMatch = student.colleges_of_interest.some(
    (c) => normalize(c) === normalize(tutor.college)
  )
  if (collegeMatch) {
    score += 20
    reasons.push(`Goes to ${tutor.college}, one of your dream schools`)
  }

  // 4. Major similarity (max 15 pts)
  const majorMatch = majorSimilarity(student.intended_major, tutor.major)
  if (majorMatch === 'exact') {
    score += 15
    reasons.push(`Studies ${tutor.major}, just like you want to`)
  } else if (majorMatch === 'partial') {
    score += 8
    reasons.push(`Studies ${tutor.major}, related to your interest in ${student.intended_major}`)
  }

  // 5. Teaching style match (10 pts)
  if (
    student.preferred_teaching_style &&
    tutor.teaching_style &&
    normalize(student.preferred_teaching_style) === normalize(tutor.teaching_style)
  ) {
    score += 10
    reasons.push(`Teaches the way you like — ${tutor.teaching_style.replace(/_/g, ' ')}`)
  }

  // 6. Goal ↔ Service alignment (max 5 pts)
  const matchedServices = student.goals.filter((goal) => {
    const serviceId = GOAL_TO_SERVICE[goal]
    return serviceId && tutor.services.includes(serviceId)
  })
  if (matchedServices.length > 0) {
    score += 5
    reasons.push(`Offers help with services you need`)
  }

  // Ensure at least one reason for display
  if (reasons.length === 0) {
    reasons.push(`Available tutor at ${tutor.college || 'a great school'}`)
  }

  return { tutor, score, reasons }
}

export function rankTutors(student: StudentProfile, tutors: TutorProfile[]): MatchResult[] {
  return tutors
    .map((tutor) => computeMatchScore(student, tutor))
    .sort((a, b) => b.score - a.score)
}
