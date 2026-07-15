"use client";

import { useEffect, useState, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/Navigation";

const getIsLab = (startTime: string, endTime: string) => {
  if (!startTime || !endTime) return false;
  const [startH, startM] = startTime.split(":").map(Number);
  const [endH, endM] = endTime.split(":").map(Number);
  const diffMinutes = (endH * 60 + endM) - (startH * 60 + startM);
  return diffMinutes >= 90;
};

export default function SubjectsPage() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTimetable, setActiveTimetable] = useState<any>(null);
  const [allLogs, setAllLogs] = useState<any[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  
  const [subjects, setSubjects] = useState<string[]>([]);
  const [selectedSubject, setSelectedSubject] = useState<string>("");
  
  const [timeline, setTimeline] = useState<any[]>([]);
  const [viewType, setViewType] = useState<"lecture" | "lab">("lecture");
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [inputPresent, setInputPresent] = useState<string>("");
  const [inputTotal, setInputTotal] = useState<string>("");
  const [targetGoal, setTargetGoal] = useState<number>(75);

  const router = useRouter();

  useEffect(() => {
    async function checkUser() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          router.push("/auth");
        } else {
          setUser(session.user);
          await fetchData(session.user.id);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    checkUser();
  }, [router]);

  async function fetchData(userId: string) {
    const { data: timetable, error: tError } = await supabase
      .from("timetables")
      .select("*")
      .eq("user_id", userId)
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (tError || !timetable) {
      router.push("/onboarding");
      return;
    }

    setActiveTimetable(timetable);
    setTargetGoal(timetable.raw_data?.attendance_goal || 75);
    
    const subjs = timetable.raw_data?.subjects || [];
    setSubjects(subjs);
    if (subjs.length > 0) {
      setSelectedSubject(subjs[0]);
    }

    const { data: logs, error: lError } = await supabase
      .from("attendance_logs")
      .select("*")
      .eq("user_id", userId);

    setAllLogs(logs || []);
  }

  useEffect(() => {
    if (!activeTimetable || !selectedSubject) return;

    const schedule = activeTimetable.raw_data?.schedule || [];
    const semesterStart = new Date(activeTimetable.raw_data?.semester_start || new Date().setMonth(new Date().getMonth() - 1));
    semesterStart.setHours(0, 0, 0, 0);
    
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    
    const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    
    const generatedTimeline: any[] = [];

    for (let d = new Date(today); d >= semesterStart; d.setDate(d.getDate() - 1)) {
      const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      const dayName = days[d.getDay()];
      const dayClasses = schedule.find((s: any) => s.day === dayName)?.classes || [];
      
      const subjClasses = dayClasses.filter((c: any) => c.subject === selectedSubject);
      
      subjClasses.forEach((cls: any) => {
        const isLab = getIsLab(cls.startTime, cls.endTime);
        if (viewType === "lab" && !isLab) return;
        if (viewType === "lecture" && isLab) return;

        const [endH, endM] = (cls.endTime || "00:00").split(":").map(Number);
        const classEndTime = new Date(d);
        classEndTime.setHours(endH, endM, 0, 0);
        
        if (classEndTime > new Date()) return;
        
        const log = allLogs.find(l => l.date === dateStr && l.subject_name === selectedSubject && l.start_time === cls.startTime);
        
        generatedTimeline.push({
          date: dateStr,
          dayName,
          startTime: cls.startTime,
          endTime: cls.endTime,
          status: log ? log.status : "present",
          isAuto: !log,
          logId: log ? log.id : null,
          idKey: `${dateStr}-${cls.startTime}`
        });
      });
    }

    setTimeline(generatedTimeline);
  }, [selectedSubject, activeTimetable, allLogs, viewType]);

  // Find auto-tracked totals and overrides
  const getSubjectStatsSummary = () => {
    if (!activeTimetable || !selectedSubject) return { autoPresent: 0, autoBunked: 0, present: 0, absent: 0, total: 0, hasOverrides: false };
    
    const schedule = activeTimetable.raw_data?.schedule || [];
    const semesterStart = new Date(activeTimetable.raw_data?.semester_start || new Date().setMonth(new Date().getMonth() - 1));
    semesterStart.setHours(0, 0, 0, 0);
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    
    let autoPresent = 0;
    let autoBunked = 0;
    
    const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    
    // Create a temporary date pointer
    const datePtr = new Date(today);
    while (datePtr >= semesterStart) {
      const dateStr = `${datePtr.getFullYear()}-${String(datePtr.getMonth() + 1).padStart(2, "0")}-${String(datePtr.getDate()).padStart(2, "0")}`;
      const dayName = days[datePtr.getDay()];
      const dayClasses = schedule.find((s: any) => s.day === dayName)?.classes || [];
      const subjClasses = dayClasses.filter((c: any) => c.subject === selectedSubject);
      
      subjClasses.forEach((cls: any) => {
        const isLab = getIsLab(cls.startTime, cls.endTime);
        if (viewType === "lab" && !isLab) return;
        if (viewType === "lecture" && isLab) return;

        const [endH, endM] = (cls.endTime || "00:00").split(":").map(Number);
        const classEndTime = new Date(datePtr);
        classEndTime.setHours(endH, endM, 0, 0);
        if (classEndTime > new Date()) return;
        
        const log = allLogs.find(l => l.date === dateStr && l.subject_name === selectedSubject && l.start_time === cls.startTime);
        if (!log || log.status === "present") {
          autoPresent++;
        } else if (log.status === "absent") {
          autoBunked++;
        }
      });
      // Decrement day
      datePtr.setDate(datePtr.getDate() - 1);
    }
    
    const overrides = activeTimetable.raw_data?.overrides?.[selectedSubject] || {};
    const isLabView = viewType === "lab";
    const lecAttended = overrides.attended ?? 0;
    const lecBunked = overrides.bunked ?? 0;
    const labAttended = overrides.labAttended ?? 0;
    const labBunked = overrides.labBunked ?? 0;

    const currentAttendedOffset = isLabView ? labAttended : lecAttended;
    const currentBunkedOffset = isLabView ? labBunked : lecBunked;

    return {
      autoPresent,
      autoBunked,
      present: autoPresent + currentAttendedOffset,
      absent: autoBunked + currentBunkedOffset,
      total: autoPresent + currentAttendedOffset + autoBunked + currentBunkedOffset,
      hasOverrides: currentAttendedOffset !== 0 || currentBunkedOffset !== 0
    };
  };

  const summary = getSubjectStatsSummary();

  const getRecoveryStats = () => {
    const P = summary.present;
    const T = summary.total;
    const G = targetGoal / 100;
    
    if (T === 0) {
      return { status: "empty", value: 0 };
    }
    
    const currentPct = (P / T) * 100;
    
    if (currentPct < targetGoal) {
      // Recovery mode
      if (G >= 1) return { status: "impossible", value: 0 };
      const classesNeeded = Math.ceil((G * T - P) / (1 - G));
      return { status: "recover", value: classesNeeded, currentPct };
    } else {
      // Bunk budget mode
      if (G === 0) return { status: "infinite", value: 0 };
      const maxBunks = Math.floor((P - G * T) / G);
      return { status: "bunk", value: maxBunks, currentPct };
    }
  };

  useEffect(() => {
    setInputPresent(summary.present.toString());
    setInputTotal(summary.total.toString());
  }, [selectedSubject, summary.present, summary.total]);

  async function handleDirectOverride(e: React.FormEvent) {
    e.preventDefault();
    if (!user || !activeTimetable || !selectedSubject) return;
    
    const newPresent = parseInt(inputPresent);
    const newTotal = parseInt(inputTotal);
    
    if (isNaN(newPresent) || isNaN(newTotal)) {
      alert("Please enter valid numbers");
      return;
    }
    if (newPresent < 0 || newTotal < 0) {
      alert("Numbers cannot be negative");
      return;
    }
    if (newPresent > newTotal) {
      alert("Attended classes cannot be greater than total classes");
      return;
    }
    
    setActionLoading("override-save");
    try {
      const currentData = { ...activeTimetable.raw_data };
      if (!currentData.overrides) currentData.overrides = {};
      if (!currentData.overrides[selectedSubject]) currentData.overrides[selectedSubject] = { attended: 0, bunked: 0, labAttended: 0, labBunked: 0 };
      
      const newAttendedOffset = newPresent - summary.autoPresent;
      const newBunkedOffset = (newTotal - newPresent) - summary.autoBunked;
      
      const isLabView = viewType === "lab";
      if (isLabView) {
        currentData.overrides[selectedSubject].labAttended = newAttendedOffset;
        currentData.overrides[selectedSubject].labBunked = newBunkedOffset;
      } else {
        currentData.overrides[selectedSubject].attended = newAttendedOffset;
        currentData.overrides[selectedSubject].bunked = newBunkedOffset;
      }
      
      const { error } = await supabase
        .from("timetables")
        .update({ raw_data: currentData })
        .eq("id", activeTimetable.id);
        
      if (error) throw error;
      
      setActiveTimetable({ ...activeTimetable, raw_data: currentData });
      
      // Refetch logs to trigger state update
      const { data: logs } = await supabase
        .from("attendance_logs")
        .select("*")
        .eq("user_id", user.id);
      setAllLogs(logs || []);
    } catch (err: any) {
      alert("Failed to save: " + err.message);
    } finally {
      setActionLoading(null);
    }
  }

  async function handleResetOverrides() {
    if (!user || !activeTimetable || !selectedSubject) return;
    setActionLoading("override-reset");
    try {
      const currentData = { ...activeTimetable.raw_data };
      if (currentData.overrides && currentData.overrides[selectedSubject]) {
        delete currentData.overrides[selectedSubject];
      }
      
      const { error } = await supabase
        .from("timetables")
        .update({ raw_data: currentData })
        .eq("id", activeTimetable.id);
        
      if (error) throw error;
      
      setActiveTimetable({ ...activeTimetable, raw_data: currentData });
      
      // Refetch logs
      const { data: logs } = await supabase
        .from("attendance_logs")
        .select("*")
        .eq("user_id", user.id);
      setAllLogs(logs || []);
    } catch (err: any) {
      alert("Failed to reset: " + err.message);
    } finally {
      setActionLoading(null);
    }
  }

  async function handleUpdateStatus(item: any, newStatus: "present" | "absent" | "cancelled") {
    if (!user) return;
    setActionLoading(item.idKey);

    try {
      if (item.logId) {
        const { error } = await supabase
          .from("attendance_logs")
          .update({ status: newStatus })
          .eq("id", item.logId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("attendance_logs")
          .insert({
            user_id: user.id,
            subject_name: selectedSubject,
            start_time: item.startTime,
            date: item.date,
            status: newStatus
          });
        if (error) throw error;
      }
      
      const { data: logs } = await supabase
        .from("attendance_logs")
        .select("*")
        .eq("user_id", user.id);
      
      setAllLogs(logs || []);
    } catch (err: any) {
      alert("Failed to update: " + err.message);
    } finally {
      setActionLoading(null);
    }
  }

  if (loading || !activeTimetable) {
    return (
      <div className="min-h-screen bg-[#131313] flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <AppShell>
      <div className="container mx-auto px-container-padding max-w-[800px] space-y-stack-lg animate-in fade-in duration-500">
        
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div className="flex items-center gap-4">
            <span className="material-symbols-outlined text-primary text-4xl">history</span>
            <div>
              <h1 className="font-headline-lg text-white">Full History</h1>
              <p className="text-on-surface-variant font-body-md">View and edit your past classes.</p>
            </div>
          </div>
        </div>

        <div className="relative px-10">
          {/* Left scroll button */}
          <button
            type="button"
            onClick={() => scrollRef.current?.scrollBy({ left: -200, behavior: "smooth" })}
            className="absolute left-0 top-1/2 -translate-y-1/2 z-10 w-9 h-9 rounded-full bg-surface-container/95 backdrop-blur border border-white/10 hover:bg-white/10 flex items-center justify-center text-white active:scale-90 transition-all shadow-md cursor-pointer"
          >
            <span className="material-symbols-outlined text-base">chevron_left</span>
          </button>

          <div 
            ref={scrollRef}
            className="flex overflow-x-auto pb-4 gap-3 snap-x custom-scrollbar scroll-smooth"
          >
            {subjects.map((sub) => (
              <button
                key={sub}
                onClick={() => setSelectedSubject(sub)}
                className={`snap-start whitespace-nowrap px-6 py-3 rounded-2xl font-label-md transition-all ${
                  selectedSubject === sub 
                    ? 'bg-primary text-on-primary font-bold shadow-lg shadow-primary/20' 
                    : 'bg-surface-container text-on-surface-variant hover:bg-white/5'
                }`}
              >
                {sub}
              </button>
            ))}
          </div>

          {/* Right scroll button */}
          <button
            type="button"
            onClick={() => scrollRef.current?.scrollBy({ left: 200, behavior: "smooth" })}
            className="absolute right-0 top-1/2 -translate-y-1/2 z-10 w-9 h-9 rounded-full bg-surface-container/95 backdrop-blur border border-white/10 hover:bg-white/10 flex items-center justify-center text-white active:scale-90 transition-all shadow-md cursor-pointer"
          >
            <span className="material-symbols-outlined text-base">chevron_right</span>
          </button>
        </div>

        {/* Toggle Switcher for Lecture vs. Lab */}
        {selectedSubject && (
          <div className="flex bg-surface-container p-1 rounded-2xl w-full sm:max-w-[320px] border border-white/5">
            <button
              type="button"
              onClick={() => setViewType("lecture")}
              className={`flex-1 py-2.5 text-center rounded-xl font-label-md transition-all font-bold text-sm ${
                viewType === "lecture"
                  ? "bg-primary text-on-primary shadow-md"
                  : "text-on-surface-variant hover:text-white"
              }`}
            >
              Lectures
            </button>
            <button
              type="button"
              onClick={() => setViewType("lab")}
              className={`flex-1 py-2.5 text-center rounded-xl font-label-md transition-all font-bold text-sm ${
                viewType === "lab"
                  ? "bg-primary text-on-primary shadow-md"
                  : "text-on-surface-variant hover:text-white"
              }`}
            >
              Labs
            </button>
          </div>
        )}

        {/* Direct Attendance Override */}
        {selectedSubject && (
          <div className="glass-card rounded-[2rem] p-8 space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <h2 className="font-headline-md text-white text-xl">Direct Attendance Override</h2>
                <p className="text-on-surface-variant font-body-sm text-sm">Directly set the totals for {selectedSubject} without clicking individual classes.</p>
              </div>
              {summary.hasOverrides && (
                <button
                  type="button"
                  onClick={handleResetOverrides}
                  disabled={actionLoading !== null}
                  className="px-4 py-2 border border-error/20 text-error hover:bg-error/5 text-xs font-bold rounded-xl active:scale-95 transition-all flex items-center gap-2"
                >
                  <span className="material-symbols-outlined text-[16px]">restart_alt</span>
                  Reset to Auto
                </button>
              )}
            </div>

            <form onSubmit={handleDirectOverride} className="flex flex-col sm:flex-row gap-6 items-end">
              <div className="flex-1 space-y-2 w-full">
                <label className="font-label-sm text-on-surface-variant uppercase ml-1 text-xs">Attended Classes</label>
                <input
                  type="number"
                  min="0"
                  value={inputPresent}
                  onChange={(e) => setInputPresent(e.target.value)}
                  className="w-full bg-surface-container border-b border-white/10 py-3 px-3 text-white focus:border-primary transition-all rounded-t-xl"
                  placeholder="e.g. 15"
                />
              </div>

              <div className="flex-1 space-y-2 w-full">
                <label className="font-label-sm text-on-surface-variant uppercase ml-1 text-xs">Total Classes</label>
                <input
                  type="number"
                  min="0"
                  value={inputTotal}
                  onChange={(e) => setInputTotal(e.target.value)}
                  className="w-full bg-surface-container border-b border-white/10 py-3 px-3 text-white focus:border-primary transition-all rounded-t-xl"
                  placeholder="e.g. 20"
                />
              </div>

              <div className="w-full sm:w-auto">
                <button
                  type="submit"
                  disabled={actionLoading !== null}
                  className="w-full primary-gradient text-on-primary px-8 py-3.5 rounded-xl font-bold active:scale-95 transition-all shadow-lg flex items-center justify-center gap-2 text-sm"
                >
                  <span className="material-symbols-outlined text-base">save</span>
                  {actionLoading === "override-save" ? "Saving..." : "Save"}
                </button>
              </div>
            </form>

            <div className="flex justify-between items-center bg-white/5 p-4 rounded-xl border border-white/10 font-mono text-sm">
              <span className="text-on-surface-variant">Current Attendance:</span>
              <span className={`font-bold text-base ${summary.total > 0 && (summary.present / summary.total) * 100 < 75 ? "text-error" : "text-secondary-fixed"}`}>
                {summary.total > 0 ? ((summary.present / summary.total) * 100).toFixed(1) : "0.0"}% ({summary.present}/{summary.total} classes)
              </span>
            </div>
          </div>
        )}

        {/* Bunk Budget & Recovery Calculator */}
        {selectedSubject && (
          <div className="glass-card rounded-[2rem] p-8 space-y-6">
            <div>
              <h2 className="font-headline-md text-white text-xl flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-2xl">calculate</span>
                Bunk Budget & Recovery Calculator
              </h2>
              <p className="text-on-surface-variant font-body-sm text-sm">
                Calculate consecutive classes to attend or safe bunks left for {selectedSubject}.
              </p>
            </div>

            <div className="space-y-4">
              <label className="font-label-sm text-on-surface-variant uppercase ml-1 text-xs block">Target Attendance Goal %</label>
              <div className="flex items-center gap-4 bg-white/5 p-4 rounded-2xl border border-white/5">
                <input
                  type="range"
                  min="50"
                  max="100"
                  value={targetGoal}
                  onChange={(e) => setTargetGoal(Number(e.target.value))}
                  className="flex-1 accent-primary h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer"
                />
                <div className="flex items-center gap-1.5">
                  <input
                    type="number"
                    min="50"
                    max="100"
                    value={targetGoal}
                    onChange={(e) => setTargetGoal(Math.min(100, Math.max(50, Number(e.target.value))))}
                    className="w-16 bg-surface-container border border-white/10 rounded-xl py-1.5 text-center text-white font-bold font-mono focus:border-primary focus:outline-none text-sm"
                  />
                  <span className="text-white font-bold text-sm">%</span>
                </div>
              </div>
            </div>

            {(() => {
              const recovery = getRecoveryStats();
              if (recovery.status === "empty") {
                return (
                  <div className="bg-primary/10 border border-primary/20 rounded-2xl p-5 flex items-start gap-4">
                    <span className="material-symbols-outlined text-primary text-3xl">info</span>
                    <div className="space-y-1">
                      <p className="text-white font-bold text-sm">No Attendance Logs Yet</p>
                      <p className="text-on-surface-variant text-xs leading-relaxed">
                        There are no recorded classes for this subject. Use the "Direct Attendance Override" form above or mark individual classes below as "Attended" or "Bunked" to run the calculations.
                      </p>
                    </div>
                  </div>
                );
              }
              if (recovery.status === "recover") {
                return (
                  <div className="bg-error/10 border border-error/20 rounded-2xl p-5 flex items-start gap-4">
                    <span className="material-symbols-outlined text-error text-3xl">warning</span>
                    <div className="space-y-1">
                      <p className="text-white font-bold text-sm">
                        Attend the next <span className="text-error font-mono text-lg font-black">{recovery.value}</span> classes consecutively.
                      </p>
                      <p className="text-on-surface-variant text-xs leading-relaxed">
                        To bring your {selectedSubject} attendance from {recovery.currentPct?.toFixed(1)}% to your target of {targetGoal}%, you must not miss any of the next {recovery.value} classes.
                      </p>
                    </div>
                  </div>
                );
              }
              if (recovery.status === "bunk") {
                return (
                  <div className="bg-secondary-fixed/10 border border-secondary-fixed/30 rounded-2xl p-5 flex items-start gap-4">
                    <span className="material-symbols-outlined text-secondary-fixed text-3xl">check_circle</span>
                    <div className="space-y-1">
                      <p className="text-white font-bold text-sm">
                        You can safely bunk up to <span className="text-secondary-fixed font-mono text-lg font-black">{recovery.value}</span> classes.
                      </p>
                      <p className="text-on-surface-variant text-xs leading-relaxed">
                        Your current attendance ({recovery.currentPct?.toFixed(1)}%) is above target. Bunking {recovery.value} classes will leave your attendance at or above {targetGoal}%.
                      </p>
                    </div>
                  </div>
                );
              }
              if (recovery.status === "impossible") {
                return (
                  <div className="bg-error/10 border border-error/20 rounded-2xl p-5 flex items-start gap-4">
                    <span className="material-symbols-outlined text-error text-3xl">error</span>
                    <div className="space-y-1">
                      <p className="text-white font-bold text-sm">Mathematically Impossible</p>
                      <p className="text-on-surface-variant text-xs leading-relaxed">
                        You have already missed classes, so you cannot reach a 100% attendance rate for {selectedSubject}. Lower your target to calculate recovery.
                      </p>
                    </div>
                  </div>
                );
              }
              return null;
            })()}
          </div>
        )}

        <div className="space-y-4">
          {timeline.length === 0 ? (
            <div className="glass-card p-10 rounded-3xl text-center">
              <span className="material-symbols-outlined text-on-surface-variant/30 text-5xl mb-4">calendar_month</span>
              <p className="text-on-surface-variant font-body-lg">No classes have occurred for this subject yet.</p>
            </div>
          ) : (
            timeline.map((item) => (
              <div key={item.idKey} className="glass-card rounded-[1.5rem] p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-start gap-4">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${
                    item.status === 'present' ? 'bg-secondary-fixed/20 text-secondary-fixed' :
                    item.status === 'absent' ? 'bg-error/20 text-error' :
                    'bg-on-surface-variant/20 text-on-surface-variant'
                  }`}>
                    <span className="material-symbols-outlined">
                      {item.status === 'present' ? 'check_circle' : item.status === 'absent' ? 'cancel' : 'event_busy'}
                    </span>
                  </div>
                  <div>
                    <h3 className="font-label-lg text-white">
                      {new Date(item.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                    </h3>
                    <p className="text-on-surface-variant font-body-sm mt-1 flex items-center gap-2">
                      <span className="material-symbols-outlined text-[16px]">schedule</span>
                      {item.startTime} - {item.endTime}
                    </p>
                    {item.isAuto && item.status === 'present' && (
                      <span className="inline-block mt-2 font-label-sm text-[10px] uppercase tracking-wider text-primary bg-primary/10 px-2 py-0.5 rounded">
                        Auto-Tracked
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex bg-surface-container rounded-xl p-1 shrink-0 self-start sm:self-center">
                  <button 
                    onClick={() => handleUpdateStatus(item, 'present')}
                    disabled={actionLoading === item.idKey}
                    className={`px-4 py-2 text-sm font-medium rounded-lg transition-all ${
                      item.status === 'present' ? 'bg-secondary-fixed text-black shadow-md' : 'text-on-surface-variant hover:text-white'
                    }`}
                  >
                    Attended
                  </button>
                  <button 
                    onClick={() => handleUpdateStatus(item, 'absent')}
                    disabled={actionLoading === item.idKey}
                    className={`px-4 py-2 text-sm font-medium rounded-lg transition-all ${
                      item.status === 'absent' ? 'bg-error text-white shadow-md' : 'text-on-surface-variant hover:text-white'
                    }`}
                  >
                    Bunked
                  </button>
                  <button 
                    onClick={() => handleUpdateStatus(item, 'cancelled')}
                    disabled={actionLoading === item.idKey}
                    className={`px-4 py-2 text-sm font-medium rounded-lg transition-all ${
                      item.status === 'cancelled' ? 'bg-on-surface-variant text-black shadow-md' : 'text-on-surface-variant hover:text-white'
                    }`}
                  >
                    Cancelled
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

      </div>
    </AppShell>
  );
}
