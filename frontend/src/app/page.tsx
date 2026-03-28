"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import NavBar from "@/components/NavBar";

// ── Canvas particle animation ─────────────────────────────────────────────────

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  opacity: number;
}

function ParticleCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animId: number;
    let particles: Particle[] = [];

    function resize() {
      if (!canvas) return;
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
    }

    function init() {
      if (!canvas) return;
      particles = Array.from({ length: 80 }, () => ({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        vx: (Math.random() - 0.5) * 0.6,
        vy: (Math.random() - 0.5) * 0.6,
        r: 1 + Math.random() * 2,
        opacity: 0.3 + Math.random() * 0.3,
      }));
    }

    function draw() {
      if (!canvas || !ctx) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Update and draw dots
      for (const p of particles) {
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < 0 || p.x > canvas.width) p.vx *= -1;
        if (p.y < 0 || p.y > canvas.height) p.vy *= -1;

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255,255,255,${p.opacity})`;
        ctx.fill();
      }

      // Draw connecting lines
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 150) {
            ctx.beginPath();
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            ctx.strokeStyle = `rgba(255,255,255,${0.15 * (1 - dist / 150)})`;
            ctx.lineWidth = 0.8;
            ctx.stroke();
          }
        }
      }

      animId = requestAnimationFrame(draw);
    }

    resize();
    init();
    draw();

    const ro = new ResizeObserver(() => { resize(); init(); });
    ro.observe(canvas);

    return () => {
      cancelAnimationFrame(animId);
      ro.disconnect();
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full"
      style={{ zIndex: 0 }}
    />
  );
}

// ── SVG icons ─────────────────────────────────────────────────────────────────

function IconTrampliin() {
  return (
    <svg width="80" height="80" viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Person jumping */}
      <circle cx="40" cy="12" r="5" fill="#F97316" />
      <line x1="40" y1="17" x2="40" y2="32" stroke="#F97316" strokeWidth="3" strokeLinecap="round" />
      <line x1="40" y1="22" x2="32" y2="28" stroke="#F97316" strokeWidth="3" strokeLinecap="round" />
      <line x1="40" y1="22" x2="48" y2="28" stroke="#F97316" strokeWidth="3" strokeLinecap="round" />
      <line x1="40" y1="32" x2="34" y2="42" stroke="#F97316" strokeWidth="3" strokeLinecap="round" />
      <line x1="40" y1="32" x2="46" y2="42" stroke="#F97316" strokeWidth="3" strokeLinecap="round" />
      {/* Trampoline board — curved */}
      <path d="M12 58 Q40 48 68 58" stroke="#F97316" strokeWidth="4" strokeLinecap="round" fill="none" />
      {/* Legs */}
      <line x1="18" y1="58" x2="14" y2="72" stroke="#F97316" strokeWidth="3" strokeLinecap="round" />
      <line x1="22" y1="58" x2="18" y2="72" stroke="#F97316" strokeWidth="3" strokeLinecap="round" />
      <line x1="58" y1="58" x2="62" y2="72" stroke="#F97316" strokeWidth="3" strokeLinecap="round" />
      <line x1="62" y1="58" x2="66" y2="72" stroke="#F97316" strokeWidth="3" strokeLinecap="round" />
      {/* Base bar */}
      <line x1="12" y1="72" x2="68" y2="72" stroke="#F97316" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

function IconBriefcase() {
  return (
    <svg width="48" height="48" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="6" y="18" width="36" height="24" rx="4" fill="#F97316" fillOpacity="0.15" stroke="#F97316" strokeWidth="2.5" />
      <path d="M16 18V14a4 4 0 014-4h8a4 4 0 014 4v4" stroke="#F97316" strokeWidth="2.5" strokeLinecap="round" />
      <line x1="6" y1="30" x2="42" y2="30" stroke="#F97316" strokeWidth="2" strokeDasharray="2 2" />
    </svg>
  );
}

function IconGraduate() {
  return (
    <svg width="48" height="48" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
      <polygon points="24,8 44,18 24,28 4,18" fill="#8B5CF6" fillOpacity="0.2" stroke="#8B5CF6" strokeWidth="2.5" strokeLinejoin="round" />
      <path d="M12 22v10c0 5 12 8 12 8s12-3 12-8V22" stroke="#8B5CF6" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      <line x1="44" y1="18" x2="44" y2="30" stroke="#8B5CF6" strokeWidth="2.5" strokeLinecap="round" />
      <circle cx="44" cy="31" r="2" fill="#8B5CF6" />
    </svg>
  );
}

function IconMentor() {
  return (
    <svg width="48" height="48" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="16" cy="14" r="6" fill="#10B981" fillOpacity="0.2" stroke="#10B981" strokeWidth="2.5" />
      <path d="M4 36c0-6.627 5.373-12 12-12" stroke="#10B981" strokeWidth="2.5" strokeLinecap="round" />
      <circle cx="32" cy="14" r="6" fill="#10B981" fillOpacity="0.2" stroke="#10B981" strokeWidth="2.5" />
      <path d="M44 36c0-6.627-5.373-12-12-12" stroke="#10B981" strokeWidth="2.5" strokeLinecap="round" />
      <line x1="16" y1="36" x2="32" y2="36" stroke="#10B981" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M24 24v8M21 29l3 3 3-3" stroke="#10B981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconCalendar() {
  return (
    <svg width="48" height="48" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="6" y="10" width="36" height="32" rx="4" fill="#F59E0B" fillOpacity="0.15" stroke="#F59E0B" strokeWidth="2.5" />
      <line x1="6" y1="20" x2="42" y2="20" stroke="#F59E0B" strokeWidth="2.5" />
      <line x1="16" y1="6" x2="16" y2="14" stroke="#F59E0B" strokeWidth="2.5" strokeLinecap="round" />
      <line x1="32" y1="6" x2="32" y2="14" stroke="#F59E0B" strokeWidth="2.5" strokeLinecap="round" />
      <rect x="14" y="26" width="6" height="6" rx="1.5" fill="#F59E0B" />
      <rect x="28" y="26" width="6" height="6" rx="1.5" fill="#F59E0B" />
      <rect x="14" y="36" width="6" height="4" rx="1.5" fill="#F59E0B" fillOpacity="0.5" />
    </svg>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function LandingPage() {
  return (
    <div className="flex flex-col min-h-screen bg-white">
      <NavBar />

      {/* ── HERO ──────────────────────────────────────────────────────────── */}
      <section
        className="relative flex flex-col min-h-screen overflow-hidden"
        style={{ background: "linear-gradient(135deg, #0F172A 0%, #1E1B4B 60%, #0F172A 100%)" }}
      >
        <ParticleCanvas />

        {/* Content */}
        <div
          className="relative flex flex-col flex-1 items-center justify-center px-4 text-center pb-40"
          style={{ zIndex: 10 }}
        >
          <h1
            className="mt-6 text-white font-bold tracking-tight"
            style={{ fontSize: "clamp(48px,8vw,72px)", animation: "fadeInUp 0.6s ease both 0.2s" }}
          >
            Трамплин
          </h1>

          <p
            className="mt-4 max-w-xl"
            style={{ fontSize: 22, color: "#CBD5E1", animation: "fadeInUp 0.6s ease both 0.4s" }}
          >
            Карьерная платформа для студентов и выпускников в IT
          </p>

          <p
            className="mt-3"
            style={{ fontSize: 16, color: "#94A3B8", animation: "fadeInUp 0.6s ease both 0.5s" }}
          >
            Вакансии · Стажировки · Менторство · События — всё на одной карте
          </p>

          <div
            className="mt-10 flex flex-col sm:flex-row gap-4 justify-center items-center w-full px-4 sm:px-0"
            style={{ animation: "fadeInUp 0.6s ease both 0.6s" }}
          >
            <Link
              href="/opportunities"
              className="inline-flex w-full sm:w-auto items-center justify-center gap-2 rounded-xl px-8 py-4 font-semibold text-white transition-transform hover:scale-105"
              style={{ background: "#F97316", fontSize: 16, boxShadow: "0 4px 24px rgba(249,115,22,0.4)" }}
            >
              Смотреть возможности
              <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3" />
              </svg>
            </Link>
            <Link
              href="/auth/register"
              className="inline-flex w-full sm:w-auto items-center justify-center rounded-xl px-8 py-4 font-semibold text-white transition-colors hover:bg-white/10"
              style={{ fontSize: 16, border: "2px solid rgba(255,255,255,0.3)", backdropFilter: "blur(8px)" }}
            >
              Зарегистрироваться
            </Link>
          </div>
        </div>

        {/* Stats badges */}
        

        <style>{`
          @keyframes fadeInUp {
            from { opacity: 0; transform: translateY(30px); }
            to   { opacity: 1; transform: translateY(0); }
          }
        `}</style>
      </section>

      {/* ── CATEGORIES ────────────────────────────────────────────────────── */}
      <section className="bg-white px-4" style={{ padding: "80px 16px" }}>
        <h2 className="text-center font-bold text-gray-900 mb-12" style={{ fontSize: 36 }}>
          Что вы найдёте на платформе
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 max-w-5xl mx-auto">
          {[
            {
              icon: <IconBriefcase />,
              title: "Вакансии",
              text: "Junior и стажёрские позиции в ведущих IT-компаниях",
              type: "vacancy",
            },
            {
              icon: <IconGraduate />,
              title: "Стажировки",
              text: "Оплачиваемые стажировки с возможностью трудоустройства",
              type: "internship",
            },
            {
              icon: <IconMentor />,
              title: "Менторство",
              text: "Персональные программы с опытными специалистами",
              type: "mentorship",
            },
            {
              icon: <IconCalendar />,
              title: "События",
              text: "Хакатоны, дни открытых дверей и лекции компаний",
              type: "event",
            },
          ].map(({ icon, title, text, type }) => (
            <Link
              key={type}
              href={`/opportunities?type=${type}`}
              className="group flex flex-col items-center text-center rounded-2xl border border-gray-100 bg-white p-8 transition-all duration-300"
              style={{ boxShadow: "0 1px 4px rgba(0,0,0,0.05)" }}
              onMouseEnter={(e) => {
                const el = e.currentTarget;
                el.style.transform = "translateY(-4px)";
                el.style.boxShadow = "0 12px 32px rgba(249,115,22,0.12)";
                el.style.borderColor = "#F97316";
              }}
              onMouseLeave={(e) => {
                const el = e.currentTarget;
                el.style.transform = "translateY(0)";
                el.style.boxShadow = "0 1px 4px rgba(0,0,0,0.05)";
                el.style.borderColor = "#F3F4F6";
              }}
            >
              <div className="mb-5">{icon}</div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">{title}</h3>
              <p className="text-sm text-gray-500 leading-relaxed">{text}</p>
            </Link>
          ))}
        </div>
      </section>

      {/* ── CTA ───────────────────────────────────────────────────────────── */}
      <section
        className="flex flex-col items-center justify-center text-center px-4"
        style={{ background: "#0F172A", padding: "80px 16px" }}
      >
        <h2
          className="font-bold text-white mb-4"
          style={{ fontSize: "clamp(28px,5vw,42px)" }}
        >
          Готов начать карьеру в IT?
        </h2>
        <p className="mb-10 max-w-md" style={{ fontSize: 18, color: "#94A3B8" }}>
          Зарегистрируйся и получи доступ ко всем возможностям
        </p>
        <Link
          href="/auth/register"
          className="inline-flex items-center gap-2 rounded-xl px-10 py-4 font-semibold text-white transition-transform hover:scale-105"
          style={{ background: "#F97316", fontSize: 17, boxShadow: "0 4px 24px rgba(249,115,22,0.35)" }}
        >
          Начать бесплатно
          <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3" />
          </svg>
        </Link>
      </section>

      {/* ── FOOTER ────────────────────────────────────────────────────────── */}
      <footer
        className="py-6 text-center text-xs"
        style={{ background: "#0F172A", color: "#475569", borderTop: "1px solid rgba(255,255,255,0.06)" }}
      >
        © {new Date().getFullYear()} Трамплин
      </footer>
    </div>
  );
}
