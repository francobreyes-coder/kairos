import { Heart, Brain, Shield } from 'lucide-react'

const services = [
  {
    icon: Heart,
    title: 'Pathos',
    subtitle: 'Essays',
    description:
      "Work with tutors who crafted winning essays. Get feedback on structure, voice, and authenticity from students who've been accepted to your dream schools.",
    color: 'text-rose-500',
    bgColor: 'bg-rose-500/10',
    borderHover: 'hover:border-rose-500/30',
  },
  {
    icon: Brain,
    title: 'Logos',
    subtitle: 'Test Prep',
    description:
      'Learn proven strategies from high scorers. Our tutors share the techniques that helped them achieve top SAT, ACT, and AP scores.',
    color: 'text-violet-500',
    bgColor: 'bg-violet-500/10',
    borderHover: 'hover:border-violet-500/30',
  },
  {
    icon: Shield,
    title: 'Ethos',
    subtitle: 'Activities',
    description:
      'Build a compelling activities list with guidance from students who stood out. Learn how to frame your experiences for maximum impact.',
    color: 'text-emerald-500',
    bgColor: 'bg-emerald-500/10',
    borderHover: 'hover:border-emerald-500/30',
  },
]

export function HowItWorks() {
  return (
    <section id="how-it-works" className="py-24 px-6">
      <div className="mx-auto max-w-6xl">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl tracking-tight bg-gradient-to-r from-purple-600 via-purple-500 to-pink-400 bg-clip-text text-transparent" style={{ fontFamily: 'Shrikhand, cursive' }}>
            Three Pillars of Success
          </h2>
          <p className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto">
            Our tutors specialize in the areas that matter most. Connect with experts in essays,
            testing, and activities.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {services.map((service) => (
            <div
              key={service.title}
              className={`group relative p-8 rounded-2xl bg-card border border-border ${service.borderHover} transition-all duration-300 hover:shadow-lg hover:shadow-foreground/5`}
            >
              <div
                className={`w-12 h-12 rounded-xl ${service.bgColor} flex items-center justify-center mb-6`}
              >
                <service.icon className={`w-6 h-6 ${service.color}`} />
              </div>

              <div className="flex items-baseline gap-2 mb-3">
                <h3 className="text-xl font-semibold text-foreground">{service.title}</h3>
                <span className="text-sm text-muted-foreground">/ {service.subtitle}</span>
              </div>

              <p className="text-muted-foreground leading-relaxed">{service.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
