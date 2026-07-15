"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import { parseTimetableImage } from "../actions/parse-timetable";
import { ParsedTimetable } from "@/types/timetable";
import TimetableReview from "@/components/TimetableReview";

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

export default function OnboardingPage() {
  const [step, setStep] = useState(1);
  const [semester, setSemester] = useState<string>("Jan - May");
  const [customStartMonth, setCustomStartMonth] = useState<number>(0); // January
  const [customEndMonth, setCustomEndMonth] = useState<number>(4); // May
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [parsedData, setParsedData] = useState<ParsedTimetable | null>(null);
  const [user, setUser] = useState<any>(null);
  const [logoHref, setLogoHref] = useState("/");
  const router = useRouter();

  useEffect(() => {
    async function checkUser() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push("/auth");
      } else {
        setUser(session.user);
        setLogoHref("/dashboard");
      }
    }
    checkUser();
  }, [router]);

  async function compressImage(file: File): Promise<{ base64: string; mimeType: string }> {
    return new Promise((resolve, reject) => {
      const isImg = file.type.startsWith("image/") || /\.(jpg|jpeg|png|webp|gif)$/i.test(file.name);
      if (!isImg) {
        const reader = new FileReader();
        reader.onload = () => resolve({ base64: reader.result as string, mimeType: file.type || "application/pdf" });
        reader.onerror = reject;
        reader.readAsDataURL(file);
        return;
      }

      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement("canvas");
          let width = img.width;
          let height = img.height;
          const MAX_WIDTH = 1000;
          const MAX_HEIGHT = 1000;

          if (width > height) {
            if (width > MAX_WIDTH) {
              height *= MAX_WIDTH / width;
              width = MAX_WIDTH;
            }
          } else {
            if (height > MAX_HEIGHT) {
              width *= MAX_HEIGHT / height;
              height = MAX_HEIGHT;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext("2d");
          if (!ctx) {
            resolve({ base64: e.target?.result as string, mimeType: "image/jpeg" });
            return;
          }
          ctx.drawImage(img, 0, 0, width, height);
          resolve({ base64: canvas.toDataURL("image/jpeg", 0.6), mimeType: "image/jpeg" });
        };
        img.onerror = reject;
        img.src = e.target?.result as string;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsAnalyzing(true);
    try {
      const { base64, mimeType } = await compressImage(file);
      
      // Safety size check to prevent Vercel/Next.js body limit crashes
      if (base64.length > 1.2 * 1024 * 1024) {
        throw new Error("File size is too large (exceeds 1MB limit after compression). Please upload a smaller image or PDF.");
      }

      const result = await parseTimetableImage(base64, mimeType);
      setParsedData(result);
      setIsAnalyzing(false);
    } catch (error: any) {
      console.error("Upload error details:", error);
      alert(error.message || "Failed to analyze timetable. Please try another file.");
      setIsAnalyzing(false);
    }
  }

  const [existingTimetable, setExistingTimetable] = useState<any>(null);
  const [pendingData, setPendingData] = useState<ParsedTimetable | null>(null);
  const [showReplaceWarning, setShowReplaceWarning] = useState(false);
  const [replacing, setReplacing] = useState(false);

  // Check for existing timetable on load
  useEffect(() => {
    async function checkExisting() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const { data } = await supabase
        .from("timetables")
        .select("id, raw_data")
        .eq("user_id", session.user.id)
        .eq("is_active", true)
        .maybeSingle();
      if (data) setExistingTimetable(data);
    }
    checkExisting();
  }, []);

  async function handleConfirmTimetable(finalData: ParsedTimetable) {
    if (!user) return;

    // If there's an existing active timetable, warn before replacing
    if (existingTimetable) {
      setPendingData(finalData);
      setShowReplaceWarning(true);
      return;
    }

    await saveTimetable(finalData);
  }

  async function saveTimetable(finalData: ParsedTimetable) {
    if (!user) return;
    setReplacing(true);
    try {
      // Calculate start and end dates based on semester selection
      const currentYear = new Date().getFullYear();
      let semesterStart: string;
      let semesterEnd: string;

      if (semester === "Jan - May") {
        semesterStart = `${currentYear}-01-01`;
        semesterEnd = `${currentYear}-05-31`;
      } else if (semester === "Jul - Nov") {
        semesterStart = `${currentYear}-07-01`;
        semesterEnd = `${currentYear}-11-30`;
      } else {
        const start = new Date(currentYear, customStartMonth, 1);
        const end = new Date(currentYear, customEndMonth + 1, 0); // Last day of end month
        if (customEndMonth < customStartMonth) {
          end.setFullYear(currentYear + 1); // Spans to next year
        }
        semesterStart = start.toISOString().split("T")[0];
        semesterEnd = end.toISOString().split("T")[0];
      }

      // Create profile if missing
      await supabase.from("profiles").upsert({ id: user.id }, { onConflict: "id" });

      // Deactivate ALL old timetables
      await supabase
        .from("timetables")
        .update({ is_active: false })
        .eq("user_id", user.id)
        .eq("is_active", true);

      // Delete all old attendance logs
      await supabase
        .from("attendance_logs")
        .delete()
        .eq("user_id", user.id);

      // Insert the new timetable
      const { error } = await supabase
        .from("timetables")
        .insert({
          user_id: user.id,
          raw_data: { 
            ...finalData, 
            semester_type: semester,
            semester_start: semesterStart,
            semester_end: semesterEnd
          },
          is_active: true
        });

      if (error) throw error;
      router.push("/dashboard");
    } catch (err: any) {
      alert("Failed to save timetable: " + err.message);
    } finally {
      setReplacing(false);
    }
  }


  if (showReplaceWarning && pendingData) {
    const oldSubjects: string[] = existingTimetable?.raw_data?.subjects || [];
    return (
      <div className="min-h-screen bg-[#131313] flex items-center justify-center p-6 animate-in fade-in duration-300">
        <div className="glass-card rounded-[2rem] p-8 max-w-md w-full space-y-6 border border-error/30">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-error/20 text-error flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-2xl">warning</span>
            </div>
            <div>
              <h2 className="font-headline-md text-white">Replace Timetable?</h2>
              <p className="text-on-surface-variant font-body-sm mt-0.5">This action cannot be undone.</p>
            </div>
          </div>

          <div className="bg-error/5 border border-error/20 rounded-2xl p-4 space-y-2">
            <p className="text-error font-label-sm uppercase tracking-wider text-xs">What will be deleted</p>
            <ul className="text-on-surface-variant font-body-sm space-y-1.5 mt-2">
              <li className="flex items-center gap-2">
                <span className="material-symbols-outlined text-sm text-error">close</span>
                All attendance logs ({oldSubjects.length > 0 ? `${oldSubjects.length} subjects` : "current semester"})
              </li>
              <li className="flex items-center gap-2">
                <span className="material-symbols-outlined text-sm text-error">close</span>
                All manual attendance overrides
              </li>
              <li className="flex items-center gap-2">
                <span className="material-symbols-outlined text-sm text-error">close</span>
                Semester start &amp; end dates
              </li>
            </ul>
            <p className="text-on-surface-variant font-body-sm space-y-1.5 mt-2 pt-2 border-t border-white/10">
              <span className="flex items-center gap-2">
                <span className="material-symbols-outlined text-sm text-secondary-fixed">check</span>
                Your display name &amp; attendance goal will be kept.
              </span>
            </p>
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => { setShowReplaceWarning(false); setPendingData(null); }}
              className="flex-1 py-4 rounded-2xl border border-white/10 text-white font-bold hover:bg-white/5 transition-all"
            >
              Cancel
            </button>
            <button
              onClick={() => { setShowReplaceWarning(false); saveTimetable(pendingData); }}
              disabled={replacing}
              className="flex-1 py-4 rounded-2xl bg-error/20 text-error font-bold hover:bg-error/30 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {replacing ? (
                <div className="w-5 h-5 border-2 border-error border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <span className="material-symbols-outlined text-base">delete_forever</span>
                  Yes, Replace
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (isAnalyzing) {

    return (
      <div className="min-h-screen bg-[#131313] flex flex-col items-center justify-center p-8 text-center space-y-8 animate-in fade-in duration-500">
        <div className="relative">
          <div className="w-24 h-24 border-4 border-primary/20 rounded-full animate-pulse shadow-[0_0_30px_rgba(188,19,254,0.3)]"></div>
          <div className="absolute inset-0 flex items-center justify-center">
             <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
          </div>
        </div>
        <div className="space-y-3">
          <h2 className="font-headline-lg text-white">AI is mapping your semester...</h2>
          <p className="text-on-surface-variant font-body-lg">Parsing hours, labs, and lecture slots from your upload.</p>
        </div>
      </div>
    );
  }

  if (parsedData) {
    return (
      <div className="min-h-screen bg-[#131313]">
         <TimetableReview 
           data={parsedData} 
           onConfirm={handleConfirmTimetable} 
           onCancel={() => setParsedData(null)} 
         />
      </div>
    );
  }

  return (
    <div className="bg-[#131313] text-[#e5e2e1] min-h-screen font-body-md overflow-x-hidden">
      <header className="fixed top-0 left-0 w-full z-50 flex justify-between items-center px-6 py-4 glass-nav border-b border-white/10">
        <Link href={logoHref} className="font-headline-md text-primary cursor-pointer">
          BunkWise
        </Link>
        <button onClick={() => router.push("/profile")} className="p-2 rounded-full hover:bg-white/5 flex items-center justify-center" aria-label="Profile">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6 text-on-surface-variant">
            <path strokeLinecap="round" strokeLinejoin="round" d="M17.982 18.725A7.488 7.488 0 0012 15.75a7.488 7.488 0 00-5.982 2.975m11.963 0a9 9 0 10-11.963 0m11.963 0A8.966 8.966 0 0112 21a8.966 8.966 0 01-5.982-2.275M15 9.75a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </button>
      </header>

      <main className="pt-28 pb-32 px-container-padding max-w-[1200px] mx-auto">
        <div className="mb-12 flex flex-col items-center">
          <h1 className="font-display-lg mb-6 text-center text-white" style={{ fontSize: '40px' }}>Set Your Game Plan</h1>
          <div className="flex gap-3 items-center">
            <div className={`h-1.5 rounded-full transition-all duration-300 ${step === 1 ? 'w-12 bg-primary shadow-[0_0_10px_rgba(188,19,254,0.5)]' : 'w-6 bg-white/10'}`}></div>
            <div className={`h-1.5 rounded-full transition-all duration-300 ${step === 2 ? 'w-12 bg-primary shadow-[0_0_10px_rgba(188,19,254,0.5)]' : 'w-6 bg-white/10'}`}></div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-8 space-y-8">
            {step === 1 ? (
              <section className="glass-card p-10 rounded-[2.5rem] animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="flex items-center gap-4 mb-8">
                  <div className="bg-primary/20 text-primary p-3 rounded-2xl material-symbols-outlined text-3xl">calendar_today</div>
                  <h2 className="font-headline-lg text-white">Choose Your Semester</h2>
                </div>
                <p className="text-on-surface-variant mb-10 text-xl font-body-lg">Tell us which cycle you're currently in to sync your academic calendar correctly.</p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                  {["Jan - May", "Jul - Nov", "Custom"].map((sem) => (
                    <button 
                      key={sem}
                      onClick={() => setSemester(sem)}
                      className={`flex flex-col items-start p-6 rounded-2xl border-2 transition-all group ${semester === sem ? 'border-primary bg-primary/10 shadow-[0_0_20px_rgba(188,19,254,0.1)]' : 'border-white/5 hover:border-white/20 bg-white/5'}`}
                    >
                      <span className={`font-headline-md mb-2 ${semester === sem ? 'text-primary' : 'text-white'}`}>{sem}</span>
                      <span className="text-on-surface-variant font-label-sm uppercase tracking-widest">{sem === "Jan - May" ? "Spring" : sem === "Jul - Nov" ? "Autumn" : "Custom Dates"}</span>
                    </button>
                  ))}
                </div>

                {semester === "Custom" && (
                  <div className="mt-8 p-6 bg-white/5 rounded-2xl border border-white/10 space-y-4 animate-in fade-in duration-300">
                    <h3 className="font-label-lg text-white uppercase tracking-wider text-xs">Configure Custom Semester Months</h3>
                    <div className="flex flex-col sm:flex-row gap-4">
                      <div className="flex-1 space-y-2">
                        <label className="text-on-surface-variant text-xs uppercase font-label-sm block">Start Month</label>
                        <select
                          value={customStartMonth}
                          onChange={(e) => setCustomStartMonth(Number(e.target.value))}
                          className="w-full bg-surface-container border border-white/10 p-3 text-white rounded-xl focus:border-primary transition-all text-sm outline-none"
                        >
                          {MONTHS.map((m, idx) => (
                            <option key={idx} value={idx} className="bg-[#131313]">{m}</option>
                          ))}
                        </select>
                      </div>
                      <div className="flex-1 space-y-2">
                        <label className="text-on-surface-variant text-xs uppercase font-label-sm block">End Month</label>
                        <select
                          value={customEndMonth}
                          onChange={(e) => setCustomEndMonth(Number(e.target.value))}
                          className="w-full bg-surface-container border border-white/10 p-3 text-white rounded-xl focus:border-primary transition-all text-sm outline-none"
                        >
                          {MONTHS.map((m, idx) => (
                            <option key={idx} value={idx} className="bg-[#131313]">{m}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>
                )}

                <div className="flex justify-end mt-12">
                  <button onClick={() => setStep(2)} className="px-10 py-5 primary-gradient text-on-primary rounded-2xl font-bold hover-glow-purple active:scale-95 transition-all text-lg shadow-xl">
                    Next Step
                  </button>
                </div>
              </section>
            ) : (
              <section className="glass-card p-10 rounded-[2.5rem] animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="flex items-center gap-4 mb-8">
                  <button onClick={() => setStep(1)} className="p-2 text-on-surface-variant hover:text-white transition-colors">
                    <span className="material-symbols-outlined">arrow_back</span>
                  </button>
                  <div className="bg-tertiary/20 text-tertiary p-3 rounded-2xl material-symbols-outlined text-3xl">upload_file</div>
                  <h2 className="font-headline-lg text-white">Timetable Intelligence</h2>
                </div>
                <p className="text-on-surface-variant mb-10 text-xl font-body-lg">Drop your timetable image or PDF. Our AI handles the boring part of mapping your hours.</p>
                
                <label className="drag-zone rounded-[2.5rem] p-12 flex flex-col items-center justify-center text-center cursor-pointer min-h-[320px] group">
                  <input type="file" accept="image/*,application/pdf" className="hidden" onChange={handleFileUpload} />
                  <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-500">
                    <span className="material-symbols-outlined text-primary text-5xl">cloud_upload</span>
                  </div>
                  <h3 className="font-headline-md text-white mb-3">Tap to Upload Timetable</h3>
                  <p className="text-on-surface-variant font-body-md mb-8 max-w-sm mx-auto">Supports PDF, JPG, PNG or Screenshots. Just make sure the text is readable.</p>
                  <div className="px-12 py-4 bg-primary text-on-primary font-bold rounded-2xl hover-glow-purple transition-all shadow-lg">
                    Browse Files
                  </div>
                </label>

                <div className="mt-8 flex items-center gap-3 px-4 py-3 bg-white/5 rounded-xl border border-white/5">
                  <span className="material-symbols-outlined text-secondary-fixed">verified_user</span>
                  <p className="text-on-surface-variant font-label-sm uppercase tracking-widest text-[10px]">Privacy first: All processing is secure and private.</p>
                </div>
              </section>
            )}
          </div>

          <div className="lg:col-span-4 space-y-8">
            <section className="glass-card p-8 rounded-[2rem] border-l-4 border-tertiary">
              <h3 className="font-headline-md text-white mb-8 flex items-center gap-3">
                <span className="material-symbols-outlined text-tertiary text-2xl">auto_awesome</span>
                The Process
              </h3>
              <div className="space-y-8">
                {[
                  { num: "1", title: "OCR Analysis", desc: "We scan your upload for course codes, timings, and venue patterns." },
                  { num: "2", title: "Schedule Logic", desc: "Our algorithm determines lab slots, theory lectures, and free periods." },
                  { num: "3", title: "Risk Mapping", desc: "Your 75% target is calculated based on working days in the semester." }
                ].map((item) => (
                  <div key={item.num} className="flex gap-4">
                    <div className="w-10 h-10 shrink-0 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center font-mono text-primary font-bold">{item.num}</div>
                    <div>
                      <h4 className="font-headline-md text-white text-base mb-1 tracking-tight">{item.title}</h4>
                      <p className="text-on-surface-variant text-sm font-body-md leading-relaxed">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </section>
            
            <div className="glass-card p-8 rounded-[2rem] bg-surface-container flex items-start gap-4 italic relative overflow-hidden">
               <div className="absolute top-0 right-0 p-4 opacity-10">
                 <span className="material-symbols-outlined text-6xl">format_quote</span>
               </div>
               <p className="text-on-surface-variant font-body-md text-sm leading-relaxed relative z-10">"The difference between a topper and a bunk-pro is just a well-parsed timetable. Let's make sure you don't accidentally meet the HOD."</p>
            </div>
          </div>
        </div>
      </main>

      <footer className="fixed bottom-0 left-0 w-full z-50 p-4 pb-safe glass-nav border-t border-white/10 md:hidden">
        <div className="flex flex-col items-center justify-center text-primary font-bold py-2">
          <div className="w-1 h-1 bg-primary rounded-full mb-1"></div>
          <span className="font-label-sm uppercase tracking-widest text-[10px]">Onboarding Mode</span>
        </div>
      </footer>
    </div>
  );
}
