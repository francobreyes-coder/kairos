import { GraduationCap, Clock, DollarSign, Zap } from 'lucide-react'

const benefits = [
  {
    icon: GraduationCap,
    title: 'Recent Experience',
    description:
      'Our tutors were in your shoes just 1–3 years ago. They know what admissions officers are looking for right now.',
  },
  {
    icon: Clock,
    title: 'Perfect Timing',
    description:
      "In Greek, kairos means the opportune moment. Get expert guidance exactly when you need it most in your application journey.",
  },
  {
    icon: DollarSign,
    title: 'Accessible Rates',
    description:
      "Peer tutoring at a fraction of traditional counselor costs. Quality guidance shouldn't require a luxury price tag.",
  },
  {
    icon: Zap,
    title: 'Real Results',
    description:
      "Learn from students who got into the schools you're dreaming about. Their firsthand experience translates directly to your success.",
  },
]

export function WhyKairos() {
  return (
    <section id="why-kairos" className="py-24 px-6">
      <div className="mx-auto max-w-6xl">
        <div className="grid lg:grid-cols-2 gap-12 items-center">

          {/* Left — copy */}
          <div>
            <h2 className="text-3xl md:text-4xl tracking-tight text-balance bg-gradient-to-r from-purple-600 via-purple-500 to-pink-400 bg-clip-text text-transparent" style={{ fontFamily: 'Shrikhand, cursive' }}>
              Why learn from undergrads?
            </h2>
            <p className="mt-6 text-lg text-muted-foreground leading-relaxed">
              Traditional college counselors are expensive and often out of touch. Students at top
              universities remember exactly what it took to get in—because they just did it.
            </p>
            <p className="mt-4 text-muted-foreground leading-relaxed">
              Our tutors know which essay approaches resonated with admissions officers, which study
              strategies actually work, and how to build an activities list that stands out. They're
              not guessing—they're sharing what worked for them.
            </p>
          </div>

          {/* Right — benefit cards */}
          <div className="grid sm:grid-cols-2 gap-4">
            {benefits.map((benefit) => (
              <div
                key={benefit.title}
                className="p-6 rounded-xl bg-card border border-border hover:border-accent/30 transition-colors"
              >
                <benefit.icon className="w-6 h-6 text-accent mb-4" />
                <h3 className="font-semibold text-foreground mb-2">{benefit.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{benefit.description}</p>
              </div>
            ))}
          </div>

        </div>
      </div>
    </section>
  )
}
