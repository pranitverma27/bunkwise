"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";

export default function LandingPage() {
  const [loading, setLoading] = useState(true);
  const [logoHref, setLogoHref] = useState("/");
  const router = useRouter();

  useEffect(() => {
    async function checkUser() {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        setLogoHref("/dashboard");
        router.push("/dashboard");
      }
      setLoading(false);
    }
    checkUser();
  }, [router]);

  if (loading) return null;

  return (
    <div className="font-body-md overflow-x-hidden bg-[#131313] text-[#e5e2e1] min-h-screen">
      {/* Top Navigation Bar */}
      <header className="fixed top-0 left-0 w-full z-50 flex justify-between items-center px-6 md:px-12 py-5 bg-[#131313]/90 backdrop-blur-xl border-b border-white/10 transition-all">
        <div className="flex items-center gap-2">
          <Link href={logoHref} className="font-headline-lg font-bold tracking-tight text-primary text-2xl md:text-3xl select-none cursor-pointer" style={{ fontFamily: 'Space Grotesk' }}>BunkWise</Link>
        </div>
        <div className="flex items-center gap-4 md:gap-6">
          <Link 
            href="/auth" 
            className="text-on-surface-variant hover:text-white font-label-md text-sm transition-colors px-3 py-2 rounded-lg"
          >
            Login
          </Link>
          <Link 
            href="/auth" 
            className="primary-gradient text-on-primary font-label-md text-sm font-bold px-5 md:px-6 py-2.5 rounded-xl hover-glow-purple active:scale-95 transition-all shadow-lg"
          >
            Sign Up
          </Link>
        </div>
      </header>

      <main className="pt-24 pb-32">
        {/* Hero Section */}
        <section className="px-container-padding max-w-7xl mx-auto text-center mb-stack-lg">
          <div className="inline-block px-4 py-1 mb-6 rounded-full glass-card border-primary/30">
            <span className="font-label-sm text-primary uppercase tracking-widest">Attendance risk predictor</span>
          </div>
          <h1 className="font-display-lg mb-4 text-white" style={{ fontFamily: 'Space Grotesk' }}>
            Bunk <span className="text-primary-container">scientifically.</span>
          </h1>
          <p className="text-headline-md text-on-surface-variant max-w-2xl mx-auto mb-stack-md" style={{ fontFamily: 'Space Grotesk' }}>
            Zero setup. One upload. Zero HOD calls.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <Link href="/auth" className="bg-primary-container text-white px-8 py-4 rounded-xl font-bold flex items-center gap-3 neon-glow-purple hover:scale-105 transition-transform">
              <svg className="w-6 h-6" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
              </svg>
              Get Started with Google
            </Link>
            <button 
              onClick={() => document.getElementById("features")?.scrollIntoView({ behavior: "smooth" })}
              className="border-2 border-tertiary text-tertiary px-8 py-4 rounded-xl font-bold hover:bg-tertiary/10 transition-colors"
            >
              See How It Works
            </button>
          </div>
        </section>

        {/* Risk Tiers Bento Grid */}
        <section className="px-container-padding max-w-7xl mx-auto mb-stack-lg">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-stack-md">
            {/* Tier: Chill (Safe) */}
            <div className="glass-card p-6 rounded-xl flex flex-col justify-between group hover:glass-card-active transition-all neon-glow-green border-secondary/20 h-full">
              <div>
                <div className="flex justify-between items-start mb-4">
                  <span className="material-symbols-outlined text-secondary-fixed text-4xl material-symbols-filled">sentiment_very_satisfied</span>
                  <div className="bg-secondary-fixed/20 px-3 py-1 rounded-full">
                    <span className="font-label-sm text-secondary-fixed">CHILL</span>
                  </div>
                </div>
                <h3 className="font-headline-md text-white mb-2" style={{ fontFamily: 'Space Grotesk' }}>The Zen Master</h3>
                <p className="text-on-surface-variant mb-6">Attendance at 85%+. You can literally skip a week and nobody would blink.</p>
              </div>
              <div className="space-y-3">
                <div className="flex justify-between font-label-sm">
                  <span>Safety Buffer</span>
                  <span className="text-secondary-fixed">8 Lectures</span>
                </div>
                <div className="w-full bg-surface-container-highest h-3 rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-secondary-fixed to-secondary-container w-[92%]"></div>
                </div>
              </div>
            </div>

            {/* Tier: Risky (Warning) */}
            <div className="glass-card p-6 rounded-xl flex flex-col justify-between group hover:glass-card-active transition-all border-primary/20 h-full">
              <div>
                <div className="flex justify-between items-start mb-4">
                  <span className="material-symbols-outlined text-primary text-4xl material-symbols-filled">warning</span>
                  <div className="bg-primary/20 px-3 py-1 rounded-full">
                    <span className="font-label-sm text-primary">RISKY</span>
                  </div>
                </div>
                <h3 className="font-headline-md text-white mb-2" style={{ fontFamily: 'Space Grotesk' }}>Living on Edge</h3>
                <p className="text-on-surface-variant mb-6">76%. One more missed lab and you're officially in the "Special Guest" list for Friday meetings.</p>
              </div>
              <div className="space-y-3">
                <div className="flex justify-between font-label-sm">
                  <span>Safety Buffer</span>
                  <span className="text-primary">1 Lecture</span>
                </div>
                <div className="w-full bg-surface-container-highest h-3 rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-primary to-primary-container w-[76%]"></div>
                </div>
              </div>
            </div>

            {/* Tier: HOD Territory (Critical) */}
            <div className="glass-card p-6 rounded-xl flex flex-col justify-between group hover:glass-card-active transition-all neon-glow-red border-error/30 h-full relative overflow-hidden">
              <div className="absolute inset-0 warning-stripes opacity-30 pointer-events-none"></div>
              <div className="relative z-10">
                <div className="flex justify-between items-start mb-4">
                  <span className="material-symbols-outlined text-error text-4xl material-symbols-filled">dangerous</span>
                  <div className="bg-error/20 px-3 py-1 rounded-full">
                    <span className="font-label-sm text-error">HOD ALERT</span>
                  </div>
                </div>
                <h3 className="font-headline-md text-white mb-2" style={{ fontFamily: 'Space Grotesk' }}>HOD's Office</h3>
                <p className="text-on-surface-variant mb-6">64%. At this point, you should just start addressing the HOD as 'Dad'. It's Joever.</p>
              </div>
              <div className="relative z-10 space-y-3">
                <div className="flex justify-between font-label-sm">
                  <span>Required to Fix</span>
                  <span className="text-error">12 Straight Days</span>
                </div>
                <div className="w-full bg-surface-container-highest h-3 rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-error to-error-container w-[64%]"></div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Feature Spotlight */}
        <section id="features" className="px-container-padding max-w-7xl mx-auto scroll-mt-24">
          <div className="glass-card-active rounded-3xl p-8 md:p-12 flex flex-col md:flex-row items-center gap-stack-lg">
            <div className="flex-1">
              <h2 className="font-headline-lg text-white mb-6" style={{ fontFamily: 'Space Grotesk' }}>
                How BunkWise <span className="text-primary-container">Works</span>
              </h2>
              <ul className="space-y-6">
                <li className="flex gap-4">
                  <span className="material-symbols-outlined text-primary bg-primary/10 p-3.5 rounded-2xl h-fit border border-primary/20" style={{ fontSize: '24px' }}>sync</span>
                  <div>
                    <h4 className="font-headline-md text-white font-bold" style={{ fontFamily: 'Space Grotesk' }}>1. AI Timetable Upload & Parse</h4>
                    <p className="text-on-surface-variant font-body-md mt-1">Upload a screenshot of your timetable. Our AI instantly extracts subjects, timings, and labs, mapping them into your active semester calendar.</p>
                  </div>
                </li>
                <li className="flex gap-4">
                  <span className="material-symbols-outlined text-secondary-fixed bg-secondary-fixed/10 p-3.5 rounded-2xl h-fit border border-secondary-fixed/20" style={{ fontSize: '24px' }}>explore</span>
                  <div>
                    <h4 className="font-headline-md text-white font-bold" style={{ fontFamily: 'Space Grotesk' }}>2. Autopilot Tracking</h4>
                    <p className="text-on-surface-variant font-body-md mt-1">No tedious daily logging. BunkWise assumes you attend all classes by default. You only open the app to mark a class as bunked or cancelled.</p>
                  </div>
                </li>
                <li className="flex gap-4">
                  <span className="material-symbols-outlined text-tertiary bg-tertiary/10 p-3.5 rounded-2xl h-fit border border-tertiary/20" style={{ fontSize: '24px' }}>calendar_month</span>
                  <div>
                    <h4 className="font-headline-md text-white font-bold" style={{ fontFamily: 'Space Grotesk' }}>3. Smart Holiday Bunk Planner</h4>
                    <p className="text-on-surface-variant font-body-md mt-1">Integrated Indian holidays calendar automatically highlights and bundles long weekends to suggest perfect bunk schedules. You can also upload custom holiday lists (PDF, JPG, JPEG).</p>
                  </div>
                </li>
                <li className="flex gap-4">
                  <span className="material-symbols-outlined text-primary bg-primary/10 p-3.5 rounded-2xl h-fit border border-primary/20" style={{ fontSize: '24px' }}>calculate</span>
                  <div>
                    <h4 className="font-headline-md text-white font-bold" style={{ fontFamily: 'Space Grotesk' }}>4. Attendance Recovery Calculator</h4>
                    <p className="text-on-surface-variant font-body-md mt-1">Dynamic per-subject calculator tells you exactly how many consecutive classes you need to attend to recover, or how many safe bunks you have left based on your target goal.</p>
                  </div>
                </li>
                <li className="flex gap-4">
                  <span className="material-symbols-outlined text-secondary-fixed bg-secondary-fixed/10 p-3.5 rounded-2xl h-fit border border-secondary-fixed/20" style={{ fontSize: '24px' }}>share</span>
                  <div>
                    <h4 className="font-headline-md text-white font-bold" style={{ fontFamily: 'Space Grotesk' }}>5. Interactive Stats Cards</h4>
                    <p className="text-on-surface-variant font-body-md mt-1">Generate high-resolution statistics cards of your attendance status to share directly on WhatsApp and other platforms with full Open Graph rich previews.</p>
                  </div>
                </li>
              </ul>
            </div>
            <div className="flex-1 w-full max-w-md">
              <div className="relative group">
                <div className="absolute -inset-1 bg-gradient-to-r from-primary via-tertiary to-secondary-fixed rounded-2xl blur opacity-25 group-hover:opacity-50 transition duration-1000 group-hover:duration-200"></div>
                <div className="relative bg-background rounded-2xl p-4 overflow-hidden border border-white/5">
                  <img alt="Dashboard Preview" className="rounded-xl w-full h-auto" src="https://lh3.googleusercontent.com/aida-public/AB6AXuC0tvKceUDS1ivIwnDt4iYy7E9dM4r-rCq4gY5uW23i-8q4gm8-gufoCEt0C0LNyezHYfK8N1fSQ-qe9i6bnMdbcvcwinSSB2UhiqE-f0UPVrWWke0kT3Bxb6aUcIjw1RL1RZKjDMQ1kmEnhWhVbhKp4rna5PkI6VI4JI_7givzG4qbVk1j9crwqRH_jzLEVyeDTMF6Qc2PQKpN3VUn6F7iZeqTlhJ7NLvHVSAcetaav2PtZDIZzKNvYkM8oeUpnAuZSC6ZoEmn_8w"/>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Bottom Navigation Bar (Mobile) - Hidden on Landing usually, but I'll add a simplified CTA */}
      <footer className="fixed bottom-0 left-0 w-full z-50 flex justify-center items-center px-4 py-4 pb-safe bg-surface/80 backdrop-blur-xl border-t border-white/10 rounded-t-xl md:hidden">
        <Link href="/auth" className="bg-primary-container text-white w-full py-4 rounded-xl font-bold text-center shadow-lg active:scale-95 transition-transform">
          Get Started
        </Link>
      </footer>
    </div>
  );
}
