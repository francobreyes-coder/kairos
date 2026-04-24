import Link from 'next/link'

export function Footer() {
  return (
    <footer className="bg-surface border-t border-hairline px-6 md:px-12 py-12 pb-8">
      <div className="flex flex-col md:flex-row items-center justify-between gap-4 flex-wrap">
        <div className="font-display text-xl text-ink">kairos</div>

        <div className="flex items-center gap-7">
          <a href="#" className="text-[13px] text-graphite font-medium hover:text-ink transition-colors no-underline">Privacy</a>
          <a href="#" className="text-[13px] text-graphite font-medium hover:text-ink transition-colors no-underline">Terms</a>
          <Link href="/find-tutors" className="text-[13px] text-graphite font-medium hover:text-ink transition-colors no-underline">Find Tutors</Link>
          <a href="mailto:hello@kairos.app" className="text-[13px] text-graphite font-medium hover:text-ink transition-colors no-underline">Contact</a>
        </div>

        <div className="text-[12px] text-mute">
          © {new Date().getFullYear()} Kairos. the right guidance, at the right time.
        </div>
      </div>
    </footer>
  )
}
