'use client'

import { useEffect } from 'react'
import { X, Star, Heart, Clock, GraduationCap, BookOpen, DollarSign } from 'lucide-react'

interface TutorProfileModalProps {
  tutor: {
    userId: string
    name: string
    bio: string
    profilePhoto: string | null
    subjects: string[]
    college: string
    major: string
    interests: string[]
    teachingStyle: string
    services: string[]
    servicePrices: Record<string, number>
    satScore?: number | null
    actScore?: number | null
    score: number
    reasons: string[]
  }
  onClose: () => void
  // Omit onBook to render the modal in read-only mode (e.g. when a tutor
  // is browsing /find-tutors and can't book).
  onBook?: () => void
  // Marks the modal as the viewer's own profile so we can swap the booking
  // CTA for a "this is you" hint instead.
  isSelf?: boolean
}

const SERVICE_LABELS: Record<string, string> = {
  essays: 'Essay Writing',
  sat: 'SAT Prep',
  act: 'ACT Prep',
  activities: 'Activities List Building',
  'sat-act': 'SAT/ACT Prep',
}

const TEACHING_STYLE_LABELS: Record<string, string> = {
  structured: 'Structured & Organized',
  collaborative: 'Collaborative',
  socratic: 'Socratic / Question-Based',
  flexible: 'Flexible & Adaptive',
}

const AVATAR_COLORS = [
  '#6C52E0',
  '#7A62EA',
  '#9B86F0',
  '#B47AE8',
  '#8177C9',
  '#7A3AE8',
  '#BDB0F5',
  '#5B24CC',
]

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
}

function getAvatarColor(userId: string): string {
  let hash = 0
  for (let i = 0; i < userId.length; i++) {
    hash = userId.charCodeAt(i) + ((hash << 5) - hash)
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length]
}

export default function TutorProfileModal({ tutor, onClose, onBook, isSelf }: TutorProfileModalProps) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [onClose])

  const photoUrl = tutor.profilePhoto
    ? `/api/storage?path=${encodeURIComponent(tutor.profilePhoto)}`
    : null

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-shell" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose} aria-label="Close">
          <X className="w-5 h-5" />
        </button>

        <div className="modal-hero">
          {photoUrl ? (
            <img src={photoUrl} alt="" className="modal-avatar-img" />
          ) : (
            <div
              className="modal-avatar"
              style={{ background: getAvatarColor(tutor.userId) }}
            >
              {getInitials(tutor.name)}
            </div>
          )}
          <div className="modal-hero-info">
            <h2 className="modal-name">{tutor.name}</h2>
            <p className="modal-school">
              {tutor.college}
              {tutor.major && ` · ${tutor.major}`}
            </p>
            {tutor.score > 0 && (
              <div className="modal-rating">
                <Star className="w-4 h-4 fill-current" />
                <span className="modal-rating-label">
                  {tutor.score >= 60 ? 'Great match' : tutor.score >= 35 ? 'Good match' : 'Match'}
                </span>
                <span className="modal-rating-pct">({tutor.score}%)</span>
              </div>
            )}
          </div>
        </div>

        <div className="modal-body">
          {tutor.bio && (
            <section className="modal-section">
              <h3 className="modal-section-title">About</h3>
              <p className="modal-bio">{tutor.bio}</p>
            </section>
          )}

          {tutor.reasons && tutor.reasons.length > 0 && (
            <section className="modal-section">
              <h3 className="modal-section-title">Why this match</h3>
              <ul className="modal-reasons">
                {tutor.reasons.map((r, i) => (
                  <li key={i}>{r}</li>
                ))}
              </ul>
            </section>
          )}

          {tutor.services.length > 0 && (
            <section className="modal-section">
              <h3 className="modal-section-title">
                <DollarSign className="w-[15px] h-[15px]" /> Services
              </h3>
              <div className="modal-service-list">
                {tutor.services.map((s) => {
                  const price = tutor.servicePrices?.[s]
                  // Show the tutor's own SAT/ACT score next to the matching
                  // service as a credential signal for browsing students.
                  const credential =
                    s === 'sat' && typeof tutor.satScore === 'number'
                      ? `Scored ${tutor.satScore}`
                      : s === 'act' && typeof tutor.actScore === 'number'
                        ? `Scored ${tutor.actScore}`
                        : null
                  return (
                    <div key={s} className="modal-service-row">
                      <div className="modal-service-label">
                        <span>{SERVICE_LABELS[s] ?? s}</span>
                        {credential && <span className="modal-service-credential">{credential}</span>}
                      </div>
                      {price ? <strong>${price}/hr</strong> : <span className="modal-no-price">—</span>}
                    </div>
                  )
                })}
              </div>
            </section>
          )}

          {tutor.subjects.length > 0 && (
            <section className="modal-section">
              <h3 className="modal-section-title">
                <BookOpen className="w-[15px] h-[15px]" /> Subjects
              </h3>
              <div className="modal-tags">
                {tutor.subjects.map((s) => (
                  <span key={s} className="modal-tag">{s}</span>
                ))}
              </div>
            </section>
          )}

          {tutor.teachingStyle && (
            <section className="modal-section">
              <h3 className="modal-section-title">
                <GraduationCap className="w-[15px] h-[15px]" /> Teaching style
              </h3>
              <p className="modal-text">
                {TEACHING_STYLE_LABELS[tutor.teachingStyle] ?? tutor.teachingStyle}
              </p>
            </section>
          )}

          {tutor.interests.length > 0 && (
            <section className="modal-section">
              <h3 className="modal-section-title">
                <Heart className="w-[15px] h-[15px]" /> Interests
              </h3>
              <div className="modal-tags">
                {tutor.interests.map((i) => (
                  <span key={i} className="modal-tag secondary">{i}</span>
                ))}
              </div>
            </section>
          )}
        </div>

        {onBook ? (
          <div className="modal-footer">
            <button className="modal-book-btn" onClick={onBook}>
              BOOK NOW
            </button>
          </div>
        ) : isSelf ? (
          <div className="modal-footer">
            <div className="modal-self-hint">
              This is how students see your profile.
            </div>
          </div>
        ) : null}
      </div>

      <style jsx>{`
        .modal-backdrop {
          position: fixed;
          inset: 0;
          background: rgba(28, 27, 31, 0.55);
          backdrop-filter: blur(6px);
          -webkit-backdrop-filter: blur(6px);
          z-index: 200;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 24px;
          animation: fadeIn 0.2s ease;
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        .modal-shell {
          position: relative;
          background: white;
          border-radius: 24px;
          width: 100%;
          max-width: 560px;
          max-height: calc(100vh - 48px);
          display: flex;
          flex-direction: column;
          box-shadow: 0 24px 60px rgba(28, 27, 31, 0.25);
          animation: slideUp 0.25s cubic-bezier(0.2, 0, 0, 1);
          overflow: hidden;
        }
        @keyframes slideUp {
          from { transform: translateY(20px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        .modal-close {
          position: absolute;
          top: 14px;
          right: 14px;
          width: 36px;
          height: 36px;
          border-radius: 50%;
          background: rgba(255, 255, 255, 0.85);
          border: none;
          cursor: pointer;
          display: grid;
          place-items: center;
          color: #1C1B1F;
          z-index: 5;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
          transition: background 0.15s;
        }
        .modal-close:hover {
          background: white;
        }
        .modal-hero {
          background: linear-gradient(135deg, #82AAEE 0%, #B47AE8 52%, #E882CC 100%);
          padding: 32px 28px 24px;
          display: flex;
          align-items: center;
          gap: 18px;
          color: white;
        }
        .modal-avatar {
          width: 72px;
          height: 72px;
          border-radius: 50%;
          flex-shrink: 0;
          display: grid;
          place-items: center;
          font-weight: 700;
          font-size: 22px;
          color: white;
          border: 3px solid rgba(255, 255, 255, 0.4);
        }
        .modal-avatar-img {
          width: 72px;
          height: 72px;
          border-radius: 50%;
          flex-shrink: 0;
          object-fit: cover;
          border: 3px solid rgba(255, 255, 255, 0.4);
        }
        .modal-hero-info {
          flex: 1;
          min-width: 0;
        }
        .modal-name {
          font-size: 22px;
          font-weight: 700;
          color: white;
          margin: 0;
          line-height: 1.2;
        }
        .modal-school {
          font-size: 14px;
          color: rgba(255, 255, 255, 0.85);
          margin: 4px 0 0;
        }
        .modal-rating {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          margin-top: 8px;
          color: #FFD66B;
        }
        .modal-rating-label {
          font-size: 13px;
          font-weight: 700;
          color: white;
        }
        .modal-rating-pct {
          font-size: 12px;
          color: rgba(255, 255, 255, 0.7);
        }
        .modal-body {
          padding: 24px 28px;
          overflow-y: auto;
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 22px;
        }
        .modal-section-title {
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: #8A8792;
          margin: 0 0 10px;
          display: inline-flex;
          align-items: center;
          gap: 6px;
        }
        .modal-bio {
          font-size: 14px;
          color: #1C1B1F;
          line-height: 1.6;
          margin: 0;
          white-space: pre-wrap;
        }
        .modal-text {
          font-size: 14px;
          color: #1C1B1F;
          margin: 0;
        }
        .modal-reasons {
          margin: 0;
          padding-left: 18px;
          font-size: 13px;
          color: #5A5862;
          line-height: 1.6;
        }
        .modal-reasons li {
          margin-bottom: 4px;
        }
        .modal-tags {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
        }
        .modal-tag {
          padding: 5px 12px;
          border-radius: 999px;
          background: #F6F3FE;
          color: #7A62EA;
          font-size: 12px;
          font-weight: 600;
        }
        .modal-tag.secondary {
          background: #F1EFE9;
          color: #5A5862;
        }
        .modal-service-list {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .modal-service-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 12px 14px;
          background: #F7F5F0;
          border-radius: 12px;
          font-size: 14px;
          color: #1C1B1F;
          gap: 12px;
        }
        .modal-service-label {
          display: flex;
          flex-direction: column;
          gap: 2px;
          min-width: 0;
        }
        .modal-service-credential {
          font-size: 12px;
          font-weight: 600;
          color: #7A3AE8;
        }
        .modal-service-row strong {
          color: #7A3AE8;
          font-weight: 700;
        }
        .modal-no-price {
          color: #8A8792;
          font-size: 13px;
        }
        .modal-footer {
          padding: 16px 28px 22px;
          border-top: 1px solid #E6E3E8;
          background: white;
        }
        .modal-book-btn {
          width: 100%;
          height: 48px;
          border-radius: 999px;
          border: none;
          cursor: pointer;
          background: linear-gradient(135deg, #3C1EE0 0%, #7A3AE8 45%, #C93FD8 100%);
          color: white;
          font-family: var(--font-montserrat), 'Montserrat', sans-serif;
          font-size: 13px;
          font-weight: 700;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          box-shadow: 0 6px 16px rgba(122, 58, 232, 0.28);
          transition: transform 0.12s, opacity 0.12s;
        }
        .modal-book-btn:hover {
          opacity: 0.92;
        }
        .modal-book-btn:active {
          transform: scale(0.97);
        }
        .modal-self-hint {
          text-align: center;
          font-size: 13px;
          color: #5A5862;
          padding: 8px 0;
        }
        @media (max-width: 600px) {
          .modal-backdrop {
            padding: 0;
          }
          .modal-shell {
            max-height: 100vh;
            border-radius: 0;
          }
          .modal-hero {
            padding: 28px 20px 20px;
          }
          .modal-body {
            padding: 20px;
          }
          .modal-footer {
            padding: 14px 20px 20px;
          }
        }
      `}</style>
    </div>
  )
}
