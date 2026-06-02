import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ThemeToggle } from '@/components/ThemeToggle';
import {
  LogIn,
  ShieldCheck,
  CalendarDays,
  Clock,
  FileText,
  Bell,
  ArrowRight,
  ChevronDown,
  Award,
  Zap,
  Mail,
  BarChart3,
} from 'lucide-react';

/* ── Image assets ── */
const LOGO_URL = 'https://miaoda-conversation-file.s3cdn.medo.dev/user-940k6ouwh91c/conv-bmt0l5ltqby8/20260515/file-bnj2ppyfkutc.png';
const CAMPUS_URL = 'https://miaoda-site-img.s3cdn.medo.dev/images/KLing_b19ec3c1-181a-4445-984d-fdb4e94ccfa9.jpg';

const WORKFLOW_IMGS = [
  'https://miaoda-site-img.s3cdn.medo.dev/images/KLing_7f512136-6833-4a0d-b380-76ae431909b6.jpg',
  'https://miaoda-site-img.s3cdn.medo.dev/images/KLing_5174af8c-4698-42c2-9a4a-0139bd810e83.jpg',
  'https://miaoda-site-img.s3cdn.medo.dev/images/KLing_4480dd99-f835-46a5-875e-3333d0f1dad2.jpg',
  'https://miaoda-site-img.s3cdn.medo.dev/images/KLing_dbe4645e-d65a-46ef-bfd0-c29c87673a8c.jpg',
];

const FEATURE_IMGS = [
  'https://miaoda-site-img.s3cdn.medo.dev/images/KLing_97822df2-e3d0-47a1-94d3-2d5aabaf91ac.jpg',
  'https://miaoda-site-img.s3cdn.medo.dev/images/KLing_4480dd99-f835-46a5-875e-3333d0f1dad2.jpg',
  'https://miaoda-site-img.s3cdn.medo.dev/images/KLing_5174af8c-4698-42c2-9a4a-0139bd810e83.jpg',
];

/* ── Sun ornament SVG ── */
function SunOrnament({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg">
      <g stroke="currentColor" strokeWidth="0.5">
        <circle cx="100" cy="100" r="90" />
        <circle cx="100" cy="100" r="70" />
        <circle cx="100" cy="100" r="50" />
        <circle cx="100" cy="100" r="30" />
        <line x1="100" y1="10" x2="100" y2="190" />
        <line x1="10" y1="100" x2="190" y2="100" />
        <line x1="36" y1="36" x2="164" y2="164" />
        <line x1="164" y1="36" x2="36" y2="164" />
      </g>
    </svg>
  );
}

/* ── Step connector ── */
function StepConnector() {
  return (
    <div className="hidden md:block absolute top-6 -right-1/2 w-full h-px">
      <div className="w-full h-full bg-gradient-to-r from-primary/40 to-transparent" />
    </div>
  );
}

/* ── Feature pill strip ── */
function FeaturePill({ icon: Icon, label }: { icon: React.ComponentType<{ className?: string }>; label: string }) {
  return (
    <div className="flex items-center gap-2 px-4 py-2 border border-primary/20 rounded bg-primary/[0.03] text-primary">
      <Icon className="w-3.5 h-3.5 shrink-0" />
      <span className="text-[10px] sm:text-xs tracking-[2px] uppercase font-medium">{label}</span>
    </div>
  );
}

/* ── Scroll indicator ── */
function ScrollIndicator() {
  return (
    <div className="flex flex-col items-center gap-1 mt-4 text-muted-foreground animate-bounce">
      <span className="text-[10px] tracking-[3px] uppercase">Scroll</span>
      <ChevronDown className="w-4 h-4" />
    </div>
  );
}

/* ── Section header ── */
function SectionHeader({ label, title }: { label: string; title: string }) {
  return (
    <div className="text-center mb-8 sm:mb-10 md:mb-14 opacity-0 intersect:opacity-100 transition duration-700 px-4">
      <p className="text-[10px] sm:text-xs tracking-[3px] sm:tracking-[4px] uppercase text-primary mb-2 sm:mb-3">{label}</p>
      <h2 className="font-playfair-display text-xl sm:text-2xl md:text-4xl font-semibold tracking-[2px] sm:tracking-[3px] uppercase text-foreground text-balance">
        {title}
      </h2>
      <div className="w-16 sm:w-20 h-0.5 bg-primary mx-auto mt-3 sm:mt-4" />
    </div>
  );
}

/* ── Main component ── */
export default function HomePage() {
  const navigate = useNavigate();
  const canvasRef = useRef<HTMLCanvasElement>(null);

  /* Particles effect */
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let w: number, h: number;
    const particles: Array<{
      x: number; y: number; size: number;
      speedX: number; speedY: number;
      opacity: number; glow: boolean;
    }> = [];

    const GOLD = 'rgba(212, 175, 55,';
    const COUNT = 35;

    function resize() {
      w = canvas!.width = window.innerWidth;
      h = canvas!.height = window.innerHeight;
    }

    function resetParticle(p: typeof particles[0]) {
      p.x = Math.random() * w;
      p.y = Math.random() * h;
      p.size = Math.random() * 2 + 0.5;
      p.speedX = (Math.random() - 0.5) * 0.3;
      p.speedY = (Math.random() - 0.5) * 0.3;
      p.opacity = Math.random() * 0.35 + 0.1;
      p.glow = Math.random() > 0.7;
    }

    for (let i = 0; i < COUNT; i++) {
      const p = { x: 0, y: 0, size: 0, speedX: 0, speedY: 0, opacity: 0, glow: false };
      resetParticle(p);
      particles.push(p);
    }

    resize();
    window.addEventListener('resize', resize);

    let raf: number;
    function animate() {
      ctx!.clearRect(0, 0, w, h);

      particles.forEach(p => {
        p.x += p.speedX;
        p.y += p.speedY;
        if (p.x < -10 || p.x > w + 10 || p.y < -10 || p.y > h + 10) resetParticle(p);

        ctx!.beginPath();
        ctx!.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx!.fillStyle = GOLD + p.opacity + ')';
        ctx!.fill();

        if (p.glow) {
          ctx!.beginPath();
          ctx!.arc(p.x, p.y, p.size * 3, 0, Math.PI * 2);
          ctx!.fillStyle = GOLD + (p.opacity * 0.12) + ')';
          ctx!.fill();
        }
      });

      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 120) {
            ctx!.beginPath();
            ctx!.moveTo(particles[i].x, particles[i].y);
            ctx!.lineTo(particles[j].x, particles[j].y);
            ctx!.strokeStyle = GOLD + (0.03 * (1 - dist / 120)) + ')';
            ctx!.stroke();
          }
        }
      }

      raf = requestAnimationFrame(animate);
    }
    animate();

    return () => {
      window.removeEventListener('resize', resize);
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <div className="relative min-h-screen bg-background text-foreground overflow-x-hidden">
      {/* Inline styles for shimmer animation */}
      <style>{`
        @keyframes shimmer {
          0% { background-position: -200% center; }
          100% { background-position: 200% center; }
        }
        @keyframes expand-line {
          from { transform: scaleX(0); }
          to { transform: scaleX(1); }
        }
        @keyframes border-flow {
          0% { background-position: 0% 50%; }
          100% { background-position: 200% 50%; }
        }
        .shimmer-text {
          background: linear-gradient(90deg, #D4AF37 0%, #F5E6A3 25%, #D4AF37 50%, #F5E6A3 75%, #D4AF37 100%);
          background-size: 200% auto;
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          animation: shimmer 4s linear infinite;
        }
        .top-accent {
          height: 3px;
          background: linear-gradient(90deg, transparent, hsl(var(--primary)), transparent);
          background-size: 200% auto;
          animation: border-flow 3s linear infinite;
        }
        .hero-divider {
          animation: expand-line 1.2s ease-out 0.8s both;
          transform-origin: center;
        }
      `}</style>

      {/* Particles Canvas */}
      <canvas ref={canvasRef} className="fixed inset-0 z-0 pointer-events-none" />

      {/* Sun ornaments */}
      <div className="fixed -top-24 -left-24 w-96 h-96 text-primary opacity-[0.04] animate-[spin_60s_linear_infinite] pointer-events-none z-0">
        <SunOrnament />
      </div>
      <div className="fixed -bottom-24 -right-24 w-96 h-96 text-primary opacity-[0.04] animate-[spin_60s_linear_infinite_reverse] pointer-events-none z-0">
        <SunOrnament />
      </div>

      {/* Theme Toggle */}
      <div className="fixed top-4 right-4 z-50">
        <ThemeToggle />
      </div>

      {/* Content */}
      <div className="relative z-10 flex flex-col min-h-screen">
        <div className="top-accent" />

        {/* ═══════ HERO ═══════ */}
        <section className="relative flex flex-col items-center justify-center text-center px-6 pt-20 pb-10 md:pt-28 md:pb-14">
          {/* College Logo */}
          <div
            className="w-20 h-20 md:w-24 md:h-24 rounded-full border-2 border-primary/30 p-1 mb-6 animate-fade-in"
            style={{ boxShadow: '0 0 30px rgba(212,175,55,0.15)' }}
          >
            <img
              src={LOGO_URL}
              alt="G.D. Sawant College Logo"
              className="w-full h-full object-cover rounded-full"
            />
          </div>

          {/* Badge */}
          <div className="inline-flex items-center gap-2 border border-primary/30 rounded-full px-4 sm:px-5 py-2 text-[10px] sm:text-xs tracking-[2px] sm:tracking-[3px] uppercase text-primary bg-primary/5 backdrop-blur-sm mb-5 sm:mb-6 animate-fade-in">
            <span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" style={{ boxShadow: '0 0 8px rgba(212,175,55,0.6)' }} />
            <span className="text-balance">G.D. Sawant College of Technology</span>
          </div>

          {/* Title */}
          <h1 className="font-playfair-display text-[2.6rem] sm:text-5xl md:text-7xl lg:text-8xl font-bold tracking-[3px] sm:tracking-[6px] md:tracking-[8px] uppercase shimmer-text mb-3 sm:mb-4 animate-fade-in" style={{ animationDelay: '0.2s' }}>
            LeaveSync
          </h1>

          {/* Divider */}
          <div className="w-20 sm:w-28 h-0.5 bg-primary mx-auto mb-4 sm:mb-5 hero-divider" />

          {/* Subtitle */}
          <p className="font-playfair-display text-base sm:text-lg md:text-2xl tracking-[3px] sm:tracking-[5px] uppercase text-muted-foreground mb-2 sm:mb-3 animate-fade-in" style={{ animationDelay: '0.4s' }}>
            College Leave Management Portal
          </p>

          {/* Tagline */}
          <p className="text-sm md:text-base font-light text-muted-foreground tracking-wide max-w-lg mx-auto leading-relaxed px-2 sm:px-0 animate-fade-in text-pretty" style={{ animationDelay: '0.6s' }}>
            A seamless, digital experience for faculty and administrators to manage leave applications with elegance and precision.
          </p>

          {/* Portal feature pills */}
          <div className="flex flex-wrap justify-center gap-2.5 sm:gap-3 mt-7 sm:mt-9 animate-fade-in" style={{ animationDelay: '0.8s' }}>
            <FeaturePill icon={CalendarDays} label="Leave Types" />
            <FeaturePill icon={BarChart3} label="Live Balance" />
            <FeaturePill icon={Mail} label="Email Alerts" />
            <FeaturePill icon={Award} label="Admin Approval" />
          </div>

          {/* Scroll indicator */}
          <div className="mt-10 sm:mt-14 animate-fade-in" style={{ animationDelay: '1s' }}>
            <ScrollIndicator />
          </div>
        </section>

        {/* ═══════ ROLE SELECTION ═══════ */}
        <section className="flex flex-wrap justify-center items-stretch gap-6 md:gap-10 px-4 sm:px-6 pb-14 md:pb-20">
          {/* Staff Card */}
          <div
            onClick={() => navigate('/staff/login')}
            className="group relative w-full max-w-[360px] bg-card border border-border/40 rounded cursor-pointer overflow-hidden flex flex-col items-center text-center p-8 sm:p-10 md:p-12 transition-all duration-500 hover:-translate-y-3 hover:scale-[1.02] animate-fade-in"
            style={{
              animationDelay: '0.5s',
              boxShadow: '0 4px 24px rgba(0,0,0,0.2)',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.boxShadow = '0 24px 80px rgba(0,0,0,0.4), 0 0 40px rgba(212,175,55,0.08)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.boxShadow = '0 4px 24px rgba(0,0,0,0.2)';
            }}
          >
            {/* Animated border on hover */}
            <div className="absolute inset-0 rounded opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" style={{
              padding: '2px',
              background: 'linear-gradient(135deg, transparent 40%, hsl(var(--primary)) 50%, transparent 60%)',
              backgroundSize: '250% 250%',
              WebkitMask: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
              WebkitMaskComposite: 'xor',
              maskComposite: 'exclude',
              animation: 'border-flow 2s linear infinite',
            }} />

            {/* Icon */}
            <div className="w-20 h-20 rounded-full border border-primary/30 flex items-center justify-center mb-7 bg-primary/5 transition-all duration-500 group-hover:border-primary group-hover:bg-primary/10 group-hover:shadow-[0_0_30px_rgba(212,175,55,0.2)]">
              <LogIn className="w-8 h-8 text-primary stroke-[1.5]" />
            </div>

            <h2 className="font-playfair-display text-2xl md:text-3xl font-semibold tracking-[3px] uppercase text-foreground mb-3">
              Staff Login
            </h2>
            <p className="text-sm text-muted-foreground leading-relaxed mb-8 max-w-[260px]">
              For faculty and teaching staff to submit leave requests, track balances, and view application status.
            </p>

            <span className="inline-flex items-center gap-2 px-8 py-3 border border-primary/40 text-primary text-sm font-medium tracking-[2px] uppercase rounded transition-all duration-400 group-hover:bg-primary group-hover:text-primary-foreground group-hover:border-primary group-hover:shadow-[0_8px_30px_rgba(212,175,55,0.3)]">
              Enter Portal
              <ArrowRight className="w-4 h-4" />
            </span>
          </div>

          {/* Admin Card */}
          <div
            onClick={() => navigate('/admin/login')}
            className="group relative w-full max-w-[360px] bg-card border border-border/40 rounded cursor-pointer overflow-hidden flex flex-col items-center text-center p-8 sm:p-10 md:p-12 transition-all duration-500 hover:-translate-y-3 hover:scale-[1.02] animate-fade-in"
            style={{
              animationDelay: '0.7s',
              boxShadow: '0 4px 24px rgba(0,0,0,0.2)',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.boxShadow = '0 24px 80px rgba(0,0,0,0.4), 0 0 40px rgba(212,175,55,0.08)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.boxShadow = '0 4px 24px rgba(0,0,0,0.2)';
            }}
          >
            {/* Animated border on hover */}
            <div className="absolute inset-0 rounded opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" style={{
              padding: '2px',
              background: 'linear-gradient(135deg, transparent 40%, hsl(var(--primary)) 50%, transparent 60%)',
              backgroundSize: '250% 250%',
              WebkitMask: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
              WebkitMaskComposite: 'xor',
              maskComposite: 'exclude',
              animation: 'border-flow 2s linear infinite',
            }} />

            {/* Icon */}
            <div className="w-20 h-20 rounded-full border border-primary/30 flex items-center justify-center mb-7 bg-primary/5 transition-all duration-500 group-hover:border-primary group-hover:bg-primary/10 group-hover:shadow-[0_0_30px_rgba(212,175,55,0.2)]">
              <ShieldCheck className="w-8 h-8 text-primary stroke-[1.5]" />
            </div>

            <h2 className="font-playfair-display text-2xl md:text-3xl font-semibold tracking-[3px] uppercase text-foreground mb-3">
              Admin Login
            </h2>
            <p className="text-sm text-muted-foreground leading-relaxed mb-8 max-w-[260px]">
              For department heads and administrators to review, approve, and manage all leave applications and staff accounts.
            </p>

            <span className="inline-flex items-center gap-2 px-8 py-3 border border-primary/40 text-primary text-sm font-medium tracking-[2px] uppercase rounded transition-all duration-400 group-hover:bg-primary group-hover:text-primary-foreground group-hover:border-primary group-hover:shadow-[0_8px_30px_rgba(212,175,55,0.3)]">
              Enter Portal
              <ArrowRight className="w-4 h-4" />
            </span>
          </div>
        </section>

        {/* ═══════ HOW IT WORKS ═══════ */}
        <section className="py-10 sm:py-14 md:py-20 px-4 sm:px-6">
          <SectionHeader label="The Process" title="How It Works" />

          <div className="flex flex-wrap justify-center gap-6 sm:gap-8 md:gap-4 max-w-[1100px] mx-auto">
            {[
              {
                num: '1',
                img: WORKFLOW_IMGS[0],
                title: 'Staff Applies',
                desc: 'Faculty selects leave type, fills dates & reason, and submits the request digitally.',
                icon: FileText,
              },
              {
                num: '2',
                img: WORKFLOW_IMGS[1],
                title: 'Auto Notifies',
                desc: 'The system instantly notifies administrators via in-app alerts and email.',
                icon: Bell,
              },
              {
                num: '3',
                img: WORKFLOW_IMGS[2],
                title: 'Admin Reviews',
                desc: 'Department head views all pending requests, checks balances, and decides.',
                icon: ShieldCheck,
              },
              {
                num: '4',
                img: WORKFLOW_IMGS[3],
                title: 'Instant Result',
                desc: 'Staff gets notified immediately — approved or rejected — with full details.',
                icon: Clock,
              },
            ].map((step, i) => (
              <div
                key={step.num}
                className="relative w-full sm:w-[45%] md:flex-1 md:min-w-[200px] md:max-w-[240px] flex flex-col items-center opacity-0 intersect:opacity-100 transition duration-700 intersect:translate-y-0 translate-y-4"
                style={{ transitionDelay: `${i * 100}ms` }}
              >
                {i < 3 && <StepConnector />}

                {/* Number */}
                <div className="relative z-10 w-12 h-12 rounded-full border-2 border-primary flex items-center justify-center font-playfair-display text-lg font-bold text-primary bg-primary/5 mb-4">
                  {step.num}
                </div>

                {/* Image */}
                <div className="w-full max-w-[280px] sm:max-w-none aspect-[4/3] rounded overflow-hidden border border-border/20 mb-4 relative group">
                  <img
                    src={step.img}
                    alt={step.title}
                    className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-background/80 via-transparent to-transparent" />
                </div>

                {/* Text */}
                <h3 className="font-playfair-display text-base font-semibold text-foreground tracking-wide mb-1">
                  {step.title}
                </h3>
                <p className="text-xs text-muted-foreground leading-relaxed text-center max-w-[240px] sm:max-w-[200px]">
                  {step.desc}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* ═══════ FEATURE SHOWCASE ═══════ */}
        <section className="py-10 sm:py-14 md:py-20 px-4 sm:px-6 bg-gradient-to-b from-transparent via-muted/30 to-transparent">
          <SectionHeader label="Capabilities" title="Portal Features" />

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6 sm:gap-8 max-w-[1000px] mx-auto px-4 sm:px-0">
            {[
              {
                img: FEATURE_IMGS[0],
                title: 'Leave Dashboard',
                desc: 'Staff and admins get a complete overview of all leave applications, balances, and status at a glance.',
                icon: CalendarDays,
              },
              {
                img: FEATURE_IMGS[1],
                title: 'Admin Approval Panel',
                desc: 'One-click approve or reject with optional notes. Real-time balance checks prevent over-allocation.',
                icon: ShieldCheck,
              },
              {
                img: FEATURE_IMGS[2],
                title: 'Smart Notifications',
                desc: 'Automated email alerts and in-app bell notifications for every action — no request goes unseen.',
                icon: Bell,
              },
            ].map((feature, i) => (
              <div
                key={feature.title}
                className="bg-card border border-border/20 rounded overflow-hidden transition-all duration-400 hover:border-primary/30 hover:shadow-lg opacity-0 intersect:opacity-100 transition duration-700 intersect:translate-y-0 translate-y-4"
                style={{ transitionDelay: `${i * 150}ms` }}
              >
                <div className="aspect-[16/10] sm:aspect-video overflow-hidden relative group">
                  <img
                    src={feature.img}
                    alt={feature.title}
                    className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-background/70 via-transparent to-transparent" />
                </div>
                <div className="p-5 md:p-6">
                  <div className="flex items-center gap-3 mb-2">
                    <feature.icon className="w-5 h-5 text-primary stroke-[1.5] shrink-0" />
                    <h4 className="font-playfair-display text-base font-semibold text-foreground tracking-wide">
                      {feature.title}
                    </h4>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {feature.desc}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ═══════ COLLEGE CAMPUS ═══════ */}
        <section className="py-14 md:py-20 px-4 sm:px-6 text-center">
          <SectionHeader label="Institution" title="Our College" />

          <div
            className="max-w-[700px] mx-auto relative p-2 sm:p-3 border border-primary/15 opacity-0 intersect:opacity-100 transition duration-700"
          >
            {/* Corner accents on frame */}
            <div className="absolute top-0 left-0 w-4 h-4 sm:w-6 sm:h-6 border-t-2 border-l-2 border-primary" />
            <div className="absolute bottom-0 right-0 w-4 h-4 sm:w-6 sm:h-6 border-b-2 border-r-2 border-primary" />

            <img
              src={CAMPUS_URL}
              alt="G.D. Sawant College of Technology Campus"
              className="w-full block opacity-90 hover:opacity-100 transition-opacity duration-500"
            />
          </div>
          <p className="font-playfair-display text-sm sm:text-base md:text-lg text-muted-foreground tracking-[2px] sm:tracking-[3px] uppercase mt-5 opacity-0 intersect:opacity-100 transition duration-700" style={{ transitionDelay: '200ms' }}>
            G.D. Sawant College of Technology
          </p>
        </section>

        {/* ═══════ FOOTER ═══════ */}
        <footer className="mt-auto py-10 px-6 text-center border-t border-border/10">
          <div className="w-12 h-12 rounded-full border border-primary/30 p-1 mx-auto mb-4 bg-primary/5">
            <img
              src={LOGO_URL}
              alt="G.D. Sawant College Logo"
              className="w-full h-full object-cover rounded-full"
            />
          </div>
          <p className="font-playfair-display text-sm text-muted-foreground tracking-[3px] uppercase">
            G.D. Sawant College of Technology
          </p>
          <p className="text-xs text-muted-foreground/40 mt-2 tracking-wider">
            LeaveSync &copy; 2026 &middot; All Rights Reserved
          </p>
        </footer>
      </div>
    </div>
  );
}
