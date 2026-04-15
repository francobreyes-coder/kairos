import { Star, Shield, Sparkles, Users, MessageCircle, Calendar, ChevronRight } from 'lucide-react'

const tutorProfiles = [
  {
    initials: 'JL',
    name: 'Jessica L.',
    school: "Harvard '27",
    specialty: 'Essays',
    rating: 5.0,
    reviews: 24,
    bio: 'English major who helped 20+ students with personal statements',
    color: 'rose' as const,
  },
  {
    initials: 'SM',
    name: 'Sam M.',
    school: "Stanford '26",
    specialty: 'Test Prep',
    rating: 4.9,
    reviews: 31,
    bio: '1580 SAT, tutored 50+ students in math and reading',
    color: 'violet' as const,
  },
  {
    initials: 'AK',
    name: 'Aisha K.',
    school: "Yale '27",
    specialty: 'Activities',
    rating: 5.0,
    reviews: 18,
    bio: 'Founded 2 nonprofits, helps students find their story',
    color: 'emerald' as const,
  },
]

const colorMap = {
  rose: {
    avatar: 'bg-rose-500/20 text-rose-500',
    badge: 'bg-rose-500/10 text-rose-500',
  },
  violet: {
    avatar: 'bg-violet-500/20 text-violet-500',
    badge: 'bg-violet-500/10 text-violet-500',
  },
  emerald: {
    avatar: 'bg-emerald-500/20 text-emerald-500',
    badge: 'bg-emerald-500/10 text-emerald-500',
  },
}

// Shared iPhone frame wrapper
function IPhoneFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative w-[260px] h-[520px] rounded-[2.5rem] bg-foreground p-2.5 shadow-xl shadow-foreground/10">
      {/* Dynamic island */}
      <div className="absolute top-3 left-1/2 -translate-x-1/2 w-20 h-6 bg-foreground rounded-full z-10" />
      <div className="relative rounded-[2rem] overflow-hidden bg-card h-full">
        <div className="px-4 pt-12 pb-4">{children}</div>
      </div>
    </div>
  )
}

export function ProductPreview() {
  return (
    <section id="preview" className="py-24 px-6 bg-secondary/30">
      <div className="mx-auto max-w-6xl">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-semibold text-foreground tracking-tight">
            Everything You Need in One App
          </h2>
          <p className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto">
            Browse tutors, book sessions, message directly, and track your progress—all from your
            phone.
          </p>
        </div>

        {/* Three iPhone screens */}
        <div className="flex flex-col md:flex-row items-center justify-center gap-6 md:gap-8">

          {/* Screen 1 — Tutor Profile */}
          <div className="flex flex-col items-center">
            <IPhoneFrame>
              <div className="text-center mb-4">
                <div className="w-16 h-16 rounded-full bg-rose-500/20 flex items-center justify-center text-rose-500 font-semibold text-lg mx-auto mb-2">
                  JL
                </div>
                <h4 className="font-semibold text-foreground text-sm">Jessica L.</h4>
                <p className="text-xs text-accent">Harvard &apos;27</p>
                <div className="flex items-center justify-center gap-1 mt-1">
                  <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                  <span className="text-xs font-medium text-foreground">5.0</span>
                  <span className="text-xs text-muted-foreground">(24)</span>
                </div>
              </div>
              <div className="flex gap-2 mb-3">
                <div className="flex-1 px-2 py-1.5 rounded-lg bg-rose-500/10 text-center">
                  <span className="text-rose-500 text-[10px] font-medium">Essays</span>
                </div>
                <div className="flex-1 px-2 py-1.5 rounded-lg bg-secondary text-center">
                  <span className="text-muted-foreground text-[10px] font-medium">Activities</span>
                </div>
              </div>
              <p className="text-[10px] text-muted-foreground text-center mb-3">
                English major who helped 20+ students with personal statements
              </p>
              <div className="flex gap-2">
                <div className="flex-1 py-2 rounded-lg bg-accent text-center">
                  <span className="text-accent-foreground text-xs font-medium">Book Session</span>
                </div>
                <div className="w-10 py-2 rounded-lg bg-secondary flex items-center justify-center">
                  <MessageCircle className="w-4 h-4 text-muted-foreground" />
                </div>
              </div>
            </IPhoneFrame>
            <p className="mt-4 text-sm font-medium text-foreground">Tutor Profiles</p>
            <p className="text-xs text-muted-foreground">Detailed bios &amp; reviews</p>
          </div>

          {/* Screen 2 — Messaging */}
          <div className="flex flex-col items-center">
            <IPhoneFrame>
              {/* Chat header */}
              <div className="flex items-center gap-3 mb-4 pb-3 border-b border-border">
                <div className="w-8 h-8 rounded-full bg-violet-500/20 flex items-center justify-center text-violet-500 font-medium text-xs">
                  SM
                </div>
                <div className="flex-1">
                  <h4 className="font-medium text-foreground text-xs">Sam M.</h4>
                  <p className="text-[10px] text-muted-foreground">Stanford &apos;26</p>
                </div>
                <div className="w-2 h-2 rounded-full bg-emerald-500" />
              </div>

              {/* Messages */}
              <div className="space-y-2 mb-3">
                <div className="flex justify-end">
                  <div className="max-w-[80%] px-3 py-2 rounded-2xl rounded-br-md bg-accent text-accent-foreground text-[10px]">
                    Hi! I need help with SAT math
                  </div>
                </div>
                <div className="flex justify-start">
                  <div className="max-w-[80%] px-3 py-2 rounded-2xl rounded-bl-md bg-secondary text-foreground text-[10px]">
                    {"I'd love to help! What areas are you struggling with?"}
                  </div>
                </div>
                <div className="flex justify-end">
                  <div className="max-w-[80%] px-3 py-2 rounded-2xl rounded-br-md bg-accent text-accent-foreground text-[10px]">
                    Mostly geometry and word problems
                  </div>
                </div>
                <div className="flex justify-start">
                  <div className="max-w-[80%] px-3 py-2 rounded-2xl rounded-bl-md bg-secondary text-foreground text-[10px]">
                    {"Perfect, let's book a session!"}
                  </div>
                </div>
              </div>

              {/* Input */}
              <div className="flex items-center gap-2 px-3 py-2 rounded-full bg-secondary">
                <span className="text-[10px] text-muted-foreground flex-1">Type a message...</span>
                <ChevronRight className="w-4 h-4 text-accent" />
              </div>
            </IPhoneFrame>
            <p className="mt-4 text-sm font-medium text-foreground">Direct Messaging</p>
            <p className="text-xs text-muted-foreground">Chat before booking</p>
          </div>

          {/* Screen 3 — Booking */}
          <div className="flex flex-col items-center">
            <IPhoneFrame>
              <h4 className="font-semibold text-foreground text-sm mb-3">Book a Session</h4>

              <div className="flex items-center gap-2 mb-3">
                <Calendar className="w-4 h-4 text-accent" />
                <span className="text-xs text-foreground">March 2026</span>
              </div>

              {/* Mini calendar */}
              <div className="grid grid-cols-7 gap-1 mb-3">
                {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
                  <div key={i} className="text-[8px] text-muted-foreground text-center py-1">
                    {d}
                  </div>
                ))}
                {Array.from({ length: 31 }, (_, i) => (
                  <div
                    key={i}
                    className={`text-[10px] text-center py-1.5 rounded ${
                      i === 14
                        ? 'bg-accent text-accent-foreground'
                        : i === 15 || i === 18
                        ? 'bg-accent/20 text-accent'
                        : 'text-foreground'
                    }`}
                  >
                    {i + 1}
                  </div>
                ))}
              </div>

              <p className="text-[10px] text-muted-foreground mb-2">Available times</p>
              <div className="flex gap-2 mb-3">
                <div className="px-2 py-1 rounded bg-accent/20 text-accent text-[10px]">3:00 PM</div>
                <div className="px-2 py-1 rounded bg-secondary text-muted-foreground text-[10px]">
                  4:30 PM
                </div>
                <div className="px-2 py-1 rounded bg-secondary text-muted-foreground text-[10px]">
                  6:00 PM
                </div>
              </div>

              <div className="py-2 rounded-lg bg-accent text-center">
                <span className="text-accent-foreground text-xs font-medium">Confirm Booking</span>
              </div>
            </IPhoneFrame>
            <p className="mt-4 text-sm font-medium text-foreground">Easy Scheduling</p>
            <p className="text-xs text-muted-foreground">Book in seconds</p>
          </div>

        </div>

        {/* Platform feature cards */}
        <div className="mt-20 grid md:grid-cols-3 gap-6">
          <div className="flex items-start gap-4 p-6 rounded-xl bg-card border border-border hover:border-accent/30 transition-colors">
            <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center flex-shrink-0">
              <Sparkles className="w-5 h-5 text-accent" />
            </div>
            <div>
              <h4 className="font-semibold text-foreground mb-1">Smart Matching</h4>
              <p className="text-sm text-muted-foreground">
                Our algorithm pairs you with tutors based on your goals, target schools, and learning
                style.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-4 p-6 rounded-xl bg-card border border-border hover:border-accent/30 transition-colors">
            <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center flex-shrink-0">
              <Shield className="w-5 h-5 text-accent" />
            </div>
            <div>
              <h4 className="font-semibold text-foreground mb-1">Vetted Tutors</h4>
              <p className="text-sm text-muted-foreground">
                Rigorous application process ensures only the best undergrads from top universities
                join our platform.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-4 p-6 rounded-xl bg-card border border-border hover:border-accent/30 transition-colors">
            <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center flex-shrink-0">
              <Users className="w-5 h-5 text-accent" />
            </div>
            <div>
              <h4 className="font-semibold text-foreground mb-1">Customizable Profiles</h4>
              <p className="text-sm text-muted-foreground">
                Tutors showcase their expertise, experience, and rates. Find the right fit for your
                needs and budget.
              </p>
            </div>
          </div>
        </div>

        {/* Tutor profile cards — hidden until real tutor data is available */}

      </div>
    </section>
  )
}
