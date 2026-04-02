"use client";

import Link from "next/link";
import { BookOpen, Compass, Sparkles, Users } from "lucide-react";
import { Preview } from "@/components/ui/demo";

const heroImage =
  "https://images.unsplash.com/photo-1491841550275-ad7854e35ca6?auto=format&fit=crop&w=1600&q=80";
const cardImages = [
  "https://images.unsplash.com/photo-1521587760476-6c12a4b040da?auto=format&fit=crop&w=900&q=80",
  "https://images.unsplash.com/photo-1503676260728-1c00da094a0b?auto=format&fit=crop&w=900&q=80",
  "https://images.unsplash.com/photo-1481627834876-b7833e8f5570?auto=format&fit=crop&w=900&q=80",
];

export default function LandingPage() {
  return (
    <main className="min-h-full bg-canvas px-6 py-8 md:px-10 md:py-10 lg:px-14 lg:py-12">
      <div className="max-w-6xl mx-auto space-y-8 md:space-y-10">
        <section className="relative overflow-hidden rounded-3xl border border-border bg-surface shadow-sm">
          <div className="absolute inset-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={heroImage} alt="Students studying in a cozy library" className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-ink/55" />
          </div>

          <div className="relative p-6 md:p-10 lg:p-12">
            <div className="inline-flex items-center gap-2 rounded-full bg-surface/85 px-4 py-2 text-xs font-semibold text-ink">
              <Sparkles size={14} />
              SIMplify by SIM IT Club
            </div>

            <h1 className="mt-4 max-w-2xl text-3xl md:text-5xl font-extrabold text-surface leading-tight">
              Find your next study spot, faster.
            </h1>

            <p className="mt-4 max-w-2xl text-sm md:text-base text-surface/90 leading-relaxed">
              Real-time crowd updates, study buddy matching, and rewards that keep your momentum strong across campus.
            </p>

            <div className="mt-6 flex flex-wrap items-center gap-3">
              <Link
                href="/auth/login"
                className="inline-flex items-center justify-center rounded-full bg-brand px-5 py-3 text-sm font-semibold text-ink hover:bg-brand-dark transition-colors"
              >
                Get Started
              </Link>
              <Link
                href="/location"
                className="inline-flex items-center justify-center rounded-full border border-surface/40 bg-surface/15 px-5 py-3 text-sm font-semibold text-surface hover:bg-surface/25 transition-colors"
              >
                Explore Locations
              </Link>
            </div>
          </div>
        </section>

        <section className="rounded-3xl border border-border bg-surface p-4 md:p-6 lg:p-8 shadow-sm">
          <Preview />
        </section>

        <section className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
          {[
            {
              title: "Live Availability",
              desc: "Check crowd levels before you walk over.",
              icon: Compass,
              image: cardImages[0],
            },
            {
              title: "Study Buddies",
              desc: "Host or join focused sessions nearby.",
              icon: Users,
              image: cardImages[1],
            },
            {
              title: "Rewards Progress",
              desc: "Earn points and redeem club perks.",
              icon: BookOpen,
              image: cardImages[2],
            },
          ].map(({ title, desc, icon: Icon, image }) => (
            <article key={title} className="overflow-hidden rounded-2xl border border-border bg-surface shadow-sm">
              <div className="h-36 md:h-40">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={image} alt={title} className="w-full h-full object-cover" />
              </div>
              <div className="p-5 space-y-2">
                <div className="inline-flex items-center justify-center w-9 h-9 rounded-xl bg-brand-faint text-brand-dark">
                  <Icon size={16} />
                </div>
                <h2 className="text-lg font-bold text-ink">{title}</h2>
                <p className="text-sm text-ink-muted">{desc}</p>
              </div>
            </article>
          ))}
        </section>
      </div>
    </main>
  );
}
