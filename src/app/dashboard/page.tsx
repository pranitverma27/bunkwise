"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/Navigation";
import TimetableReview from "@/components/TimetableReview";

const getIsLab = (startTime: string, endTime: string) => {
  if (!startTime || !endTime) return false;
  const [startH, startM] = startTime.split(":").map(Number);
  const [endH, endM] = endTime.split(":").map(Number);
  const diffMinutes = (endH * 60 + endM) - (startH * 60 + startM);
  return diffMinutes >= 90;
};

export default function DashboardPage() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTimetable, setActiveTimetable] = useState<any>(null);
  const [allLogs, setAllLogs] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [isEditingTimetable, setIsEditingTimetable] = useState(false);
  const getLocalDateStr = (d = new Date()) => {
    const tzOffset = d.getTimezoneOffset() * 60000;
    return new Date(d.getTime() - tzOffset).toISOString().split("T")[0];
  };

  const [displayName, setDisplayName] = useState("");
  const [quickActionDate, setQuickActionDate] = useState(getLocalDateStr());
  const [toggleMode, setToggleMode] = useState<"bunk" | "cancel">("bunk");
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
        console.error("Auth check failed", err);
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

    if (tError) {
      console.error("Timetable fetch error", tError);
      return;
    }

    if (!timetable) {
      router.push("/onboarding");
      return;
    }

    setActiveTimetable(timetable);

    // Fetch display name
    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("id", userId)
      .maybeSingle();
    if (profile?.full_name) setDisplayName(profile.full_name);

    const { data: logs, error: lError } = await supabase
      .from("attendance_logs")
      .select("*")
      .eq("user_id", userId);

    if (lError) console.error("Logs fetch error", lError);

    const currentLogs = logs || [];
    setAllLogs(currentLogs);
    calculateFullStats(timetable, currentLogs);
  }

  function calculateFullStats(timetable: any, logs: any[]) {
    try {
      const subjects = timetable.raw_data?.subjects || [];
      const schedule = timetable.raw_data?.schedule || [];
      const semesterStart = new Date(timetable.raw_data?.semester_start || new Date().setMonth(new Date().getMonth() - 1));
      semesterStart.setHours(0, 0, 0, 0);

      const now = new Date();
      const rawEnd = timetable.raw_data?.semester_end;
      const semesterEnd = rawEnd ? new Date(rawEnd) : null;
      if (semesterEnd) semesterEnd.setHours(23, 59, 59, 999);
      const today = semesterEnd && semesterEnd < now ? semesterEnd : now;

      const subjectStats: any = {};

      subjects.forEach((s: string) => {
        const overrides = timetable.raw_data?.overrides?.[s] || {};
        const lecAttended = overrides.attended ?? 0;
        const lecBunked = overrides.bunked ?? 0;
        const labAttended = overrides.labAttended ?? 0;
        const labBunked = overrides.labBunked ?? 0;
        subjectStats[s] = {
          lecture: { 
            present: lecAttended, 
            absent: lecBunked, 
            total: lecAttended + lecBunked, 
            hasOverrides: lecAttended !== 0 || lecBunked !== 0
          },
          lab: {
            present: labAttended,
            absent: labBunked,
            total: labAttended + labBunked,
            hasOverrides: labAttended !== 0 || labBunked !== 0
          }
        };
      });

      const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

      for (let d = new Date(semesterStart); d <= today; d.setDate(d.getDate() + 1)) {
        const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
        const dayName = days[d.getDay()];
        const dayClasses = schedule.find((s: any) => s.day === dayName)?.classes || [];
        
        dayClasses.forEach((cls: any) => {
          if (!subjectStats[cls.subject]) return;
          const [endH, endM] = (cls.endTime || "00:00").split(":").map(Number);
          const classEndTime = new Date(d);
          classEndTime.setHours(endH, endM, 0, 0);

          if (classEndTime <= today) {
            const log = logs.find(l => l.date === dateStr && l.subject_name === cls.subject && l.start_time === cls.startTime);
            const isLab = getIsLab(cls.startTime, cls.endTime);
            const target = isLab ? subjectStats[cls.subject].lab : subjectStats[cls.subject].lecture;
            
            if (!log || log.status === "present") {
              target.present++;
              target.total++;
            } else if (log.status === "absent") {
              target.absent++;
              target.total++;
            }
          }
        });
      }

      const processedLectures = Object.entries(subjectStats).map(([name, s]: any) => {
        const percentage = s.lecture.total > 0 ? (s.lecture.present / s.lecture.total) * 100 : 100;
        let tier = "Chill";
        let colorClass = "text-secondary-fixed";

        if (percentage < 70) { tier = "HOD Territory"; colorClass = "text-error"; }
        else if (percentage < 75) { tier = "Danger"; colorClass = "text-error"; }
        else if (percentage < 80) { tier = "Risky"; colorClass = "text-primary"; }
        else if (percentage < 85) { tier = "Safe"; colorClass = "text-secondary-fixed"; }

        return { name, ...s.lecture, percentage, tier, colorClass, isLab: false };
      });

      const processedLabs = Object.entries(subjectStats)
        .map(([name, s]: any) => {
          const percentage = s.lab.total > 0 ? (s.lab.present / s.lab.total) * 100 : 100;
          let tier = "Chill";
          let colorClass = "text-secondary-fixed";

          if (percentage < 70) { tier = "HOD Territory"; colorClass = "text-error"; }
          else if (percentage < 75) { tier = "Danger"; colorClass = "text-error"; }
          else if (percentage < 80) { tier = "Risky"; colorClass = "text-primary"; }
          else if (percentage < 85) { tier = "Safe"; colorClass = "text-secondary-fixed"; }

          return { name, ...s.lab, percentage, tier, colorClass, isLab: true };
        })
        .filter((s: any) => s.total > 0);

      const totalPresent = processedLectures.reduce((acc, s) => acc + s.present, 0) + processedLabs.reduce((acc, s) => acc + s.present, 0);
      const totalPossible = processedLectures.reduce((acc, s) => acc + s.total, 0) + processedLabs.reduce((acc, s) => acc + s.total, 0);
      const overallPercentage = totalPossible > 0 ? (totalPresent / totalPossible) * 100 : 100;
      const semesterEnded = !!(semesterEnd && semesterEnd < now);

      // Most bunked subject
      const combinedAll = [...processedLectures, ...processedLabs];
      const mostBunked = combinedAll.reduce((prev, cur) => cur.absent > (prev?.absent || -1) ? cur : prev, null as any);

      // Vibe
      let vibe = "Ghost Student";
      if (overallPercentage > 90) vibe = "Academic Weapon 🏆";
      else if (overallPercentage >= 75) vibe = "Balanced Life ✌️";
      else if (overallPercentage >= 50) vibe = "Living on the Edge ⚡";

      let overallHeadline = "All good bhai.";
      let safeBunks = Math.floor((totalPresent - 0.75 * totalPossible) / 0.75);

      if (overallPercentage < 70) overallHeadline = "Dad is coming.";
      else if (overallPercentage < 75) overallHeadline = "It's Joever.";
      else if (overallPercentage < 80) overallHeadline = "Living on edge.";
      else if (overallPercentage < 85) overallHeadline = "You're fine.";

      setStats({
        overallPercentage, overallHeadline, safeBunks: Math.max(0, safeBunks),
        lectures: processedLectures,
        labs: processedLabs,
        semesterEnded, mostBunked, vibe,
        totalPresent, totalPossible
      });
    } catch (err) {
      console.error("Stats calculation failed", err);
      setStats({ overallPercentage: 0, overallHeadline: "Error loading stats", safeBunks: 0, lectures: [], labs: [] });
    }
  }

  async function handleUpdateOffset(subject: string, type: "attended" | "bunked", delta: number, isLab: boolean) {
    if (!user || !activeTimetable || !stats) return;

    const subjectList = isLab ? stats.labs : stats.lectures;
    const subjectStats = subjectList.find((s: any) => s.name === subject);
    if (delta === -1 && type === "attended" && subjectStats && subjectStats.present <= 0) return;
    if (delta === -1 && type === "bunked" && subjectStats && subjectStats.absent <= 0) return;

    setActionLoading(`${subject}-${isLab ? 'lab' : 'lec'}-offset`);
    
    try {
      const currentData = { ...activeTimetable.raw_data };
      if (!currentData.overrides) currentData.overrides = {};
      if (!currentData.overrides[subject]) currentData.overrides[subject] = { attended: 0, bunked: 0, labAttended: 0, labBunked: 0 };
      
      const key = isLab 
        ? (type === "attended" ? "labAttended" : "labBunked")
        : (type === "attended" ? "attended" : "bunked");
      
      if (!currentData.overrides[subject][key]) currentData.overrides[subject][key] = 0;
      currentData.overrides[subject][key] += delta;

      const { error } = await supabase
        .from("timetables")
        .update({ raw_data: currentData })
        .eq("id", activeTimetable.id);

      if (error) throw error;
      
      setActiveTimetable({ ...activeTimetable, raw_data: currentData });
      calculateFullStats({ ...activeTimetable, raw_data: currentData }, allLogs);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setActionLoading(null);
    }
  }

  async function handleResetOffsets(subject: string) {
    if (!user || !activeTimetable) return;
    setActionLoading(`${subject}-reset`);
    
    try {
      const currentData = { ...activeTimetable.raw_data };
      if (currentData.overrides && currentData.overrides[subject]) {
        delete currentData.overrides[subject];
      }

      const { error } = await supabase
        .from("timetables")
        .update({ raw_data: currentData })
        .eq("id", activeTimetable.id);

      if (error) throw error;
      
      setActiveTimetable({ ...activeTimetable, raw_data: currentData });
      calculateFullStats({ ...activeTimetable, raw_data: currentData }, allLogs);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setActionLoading(null);
    }
  }

  async function handleUpdateTimetable(finalData: any) {
    if (!user || !activeTimetable) return;
    try {
      const currentData = { 
        ...activeTimetable.raw_data,
        subjects: finalData.subjects,
        schedule: finalData.schedule
      };

      const { error } = await supabase
        .from("timetables")
        .update({ raw_data: currentData })
        .eq("id", activeTimetable.id);

      if (error) throw error;
      
      setActiveTimetable({ ...activeTimetable, raw_data: currentData });
      calculateFullStats({ ...activeTimetable, raw_data: currentData }, allLogs);
      setIsEditingTimetable(false);
    } catch (err: any) {
      alert("Failed to update timetable: " + err.message);
    }
  }

  const getClassesForDate = (dateStr: string) => {
    if (!activeTimetable) return [];
    const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    const [y, m, d] = dateStr.split("-").map(Number);
    const dateObj = new Date(y, m - 1, d);
    const dayName = days[dateObj.getDay()];
    return activeTimetable.raw_data?.schedule?.find((s: any) => s.day === dayName)?.classes || [];
  };

  async function handleMarkDayAbsent() {
    if (!user || !activeTimetable) return;
    const classes = getClassesForDate(quickActionDate);
    if (classes.length === 0) {
      alert("No classes scheduled for this day.");
      return;
    }

    setActionLoading("mark-day-absent");
    try {
      const promises = classes.map(async (cls: any) => {
        const existingLog = allLogs.find(
          l => l.date === quickActionDate &&
               l.subject_name === cls.subject &&
               l.start_time === cls.startTime
        );

        if (existingLog) {
          if (existingLog.status === "absent") return;
          const { error } = await supabase
            .from("attendance_logs")
            .update({ status: "absent" })
            .eq("id", existingLog.id);
          if (error) throw error;
        } else {
          const { error } = await supabase
            .from("attendance_logs")
            .insert({
              user_id: user.id,
              subject_name: cls.subject,
              start_time: cls.startTime,
              date: quickActionDate,
              status: "absent"
            });
          if (error) throw error;
        }
      });

      await Promise.all(promises);

      const { data: logs, error: lError } = await supabase
        .from("attendance_logs")
        .select("*")
        .eq("user_id", user.id);

      if (lError) throw lError;

      const currentLogs = logs || [];
      setAllLogs(currentLogs);
      calculateFullStats(activeTimetable, currentLogs);
      alert(`All classes on ${new Date(quickActionDate).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })} marked absent!`);
    } catch (err: any) {
      alert("Failed to mark day absent: " + err.message);
    } finally {
      setActionLoading(null);
    }
  }

  async function handleCancelDay() {
    if (!user || !activeTimetable) return;
    const classes = getClassesForDate(quickActionDate);
    if (classes.length === 0) {
      alert("No classes scheduled for this day.");
      return;
    }

    setActionLoading("mark-day-cancelled");
    try {
      const promises = classes.map(async (cls: any) => {
        const existingLog = allLogs.find(
          l => l.date === quickActionDate &&
               l.subject_name === cls.subject &&
               l.start_time === cls.startTime
        );

        if (existingLog) {
          if (existingLog.status === "cancelled") return;
          const { error } = await supabase
            .from("attendance_logs")
            .update({ status: "cancelled" })
            .eq("id", existingLog.id);
          if (error) throw error;
        } else {
          const { error } = await supabase
            .from("attendance_logs")
            .insert({
              user_id: user.id,
              subject_name: cls.subject,
              start_time: cls.startTime,
              date: quickActionDate,
              status: "cancelled"
            });
          if (error) throw error;
        }
      });

      await Promise.all(promises);

      const { data: logs, error: lError } = await supabase
        .from("attendance_logs")
        .select("*")
        .eq("user_id", user.id);

      if (lError) throw lError;

      const currentLogs = logs || [];
      setAllLogs(currentLogs);
      calculateFullStats(activeTimetable, currentLogs);
      alert(`All classes on ${new Date(quickActionDate).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })} marked cancelled!`);
    } catch (err: any) {
      alert("Failed to cancel day: " + err.message);
    } finally {
      setActionLoading(null);
    }
  }

  async function handleUnmarkDayAbsent() {
    if (!user || !activeTimetable) return;
    const classes = getClassesForDate(quickActionDate);
    if (classes.length === 0) return;

    setActionLoading("unmark-day-absent");
    try {
      const logIdsToDelete = allLogs
        .filter(l => l.date === quickActionDate && classes.some((cls: any) => cls.subject === l.subject_name && cls.startTime === l.start_time))
        .map(l => l.id);

      if (logIdsToDelete.length > 0) {
        const { error } = await supabase
          .from("attendance_logs")
          .delete()
          .in("id", logIdsToDelete);
        if (error) throw error;
      }

      const { data: logs, error: lError } = await supabase
        .from("attendance_logs")
        .select("*")
        .eq("user_id", user.id);

      if (lError) throw lError;

      const currentLogs = logs || [];
      setAllLogs(currentLogs);
      calculateFullStats(activeTimetable, currentLogs);
      alert(`Unmarked classes for ${new Date(quickActionDate).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}!`);
    } catch (err: any) {
      alert("Failed to unmark: " + err.message);
    } finally {
      setActionLoading(null);
    }
  }

  async function handleUnmarkDayCancelled() {
    if (!user || !activeTimetable) return;
    const classes = getClassesForDate(quickActionDate);
    if (classes.length === 0) return;

    setActionLoading("unmark-day-cancelled");
    try {
      const logIdsToDelete = allLogs
        .filter(l => l.date === quickActionDate && classes.some((cls: any) => cls.subject === l.subject_name && cls.startTime === l.start_time))
        .map(l => l.id);

      if (logIdsToDelete.length > 0) {
        const { error } = await supabase
          .from("attendance_logs")
          .delete()
          .in("id", logIdsToDelete);
        if (error) throw error;
      }

      const { data: logs, error: lError } = await supabase
        .from("attendance_logs")
        .select("*")
        .eq("user_id", user.id);

      if (lError) throw lError;

      const currentLogs = logs || [];
      setAllLogs(currentLogs);
      calculateFullStats(activeTimetable, currentLogs);
      alert(`Unmarked classes for ${new Date(quickActionDate).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}!`);
    } catch (err: any) {
      alert("Failed to unmark: " + err.message);
    } finally {
      setActionLoading(null);
    }
  }

  async function handleToggleClassStatus(cls: any) {
    if (!user || !activeTimetable) return;

    setActionLoading(`toggle-${cls.subject}-${cls.startTime}`);
    try {
      const existingLog = allLogs.find(
        l => l.date === quickActionDate &&
             l.subject_name === cls.subject &&
             l.start_time === cls.startTime
      );

      const targetStatus = toggleMode === "bunk" ? "absent" : "cancelled";

      if (existingLog) {
        if (existingLog.status === targetStatus) {
          const { error } = await supabase
            .from("attendance_logs")
            .delete()
            .eq("id", existingLog.id);
          if (error) throw error;
        } else {
          const { error } = await supabase
            .from("attendance_logs")
            .update({ status: targetStatus })
            .eq("id", existingLog.id);
          if (error) throw error;
        }
      } else {
        const { error } = await supabase
          .from("attendance_logs")
          .insert({
            user_id: user.id,
            subject_name: cls.subject,
            start_time: cls.startTime,
            date: quickActionDate,
            status: targetStatus
          });
        if (error) throw error;
      }

      const { data: logs, error: lError } = await supabase
        .from("attendance_logs")
        .select("*")
        .eq("user_id", user.id);

      if (lError) throw lError;

      const currentLogs = logs || [];
      setAllLogs(currentLogs);
      calculateFullStats(activeTimetable, currentLogs);
    } catch (err: any) {
      alert("Failed to toggle class status: " + err.message);
    } finally {
      setActionLoading(null);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#131313] flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="min-h-screen bg-[#131313] flex flex-col items-center justify-center space-y-4">
        <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
        <p className="text-on-surface-variant font-label-md">Calculating risk tiers...</p>
      </div>
    );
  }
  // ── Semester Ended Celebration Screen ──────────────────────────────────
  if (stats?.semesterEnded) {
    const pct = stats.overallPercentage;
    const passed = pct >= 75;
    return (
      <AppShell>
        <div className="container mx-auto px-container-padding max-w-[600px] flex flex-col items-center pb-20 animate-in fade-in duration-500">

          {/* Hero Card */}
          <div className={`w-full rounded-[2.5rem] p-10 text-center space-y-3 mb-8 glass-card ${passed ? "neon-glow-safe" : "neon-glow-red"}`}>
            <div className="text-6xl select-none">{passed ? "🎓" : "😬"}</div>
            <h1 className="font-headline-lg text-white text-3xl">
              {displayName ? `${displayName}'s ` : ""}Semester Wrapped
            </h1>
            <p className={`text-6xl font-black leading-none mt-2 ${passed ? "text-secondary-fixed" : "text-error"}`}>
              {pct.toFixed(1)}%
            </p>
            <p className="text-on-surface-variant font-body-md">Final Attendance</p>
            <div className={`inline-block px-5 py-2 rounded-full font-bold text-sm mt-2 ${passed ? "bg-secondary-fixed/20 text-secondary-fixed" : "bg-error/20 text-error"}`}>
              {stats.vibe}
            </div>
          </div>

          {/* Stats Grid */}
          <div className="w-full grid grid-cols-3 gap-4 mb-8">
            <div className="glass-card rounded-2xl p-4 text-center">
              <p className="font-headline-md text-secondary-fixed text-2xl font-black">{stats.totalPresent}</p>
              <p className="text-on-surface-variant font-label-sm text-[10px] uppercase tracking-wider mt-1">Attended</p>
            </div>
            <div className="glass-card rounded-2xl p-4 text-center">
              <p className="font-headline-md text-error text-2xl font-black">{stats.totalPossible - stats.totalPresent}</p>
              <p className="text-on-surface-variant font-label-sm text-[10px] uppercase tracking-wider mt-1">Bunked</p>
            </div>
            <div className="glass-card rounded-2xl p-4 text-center">
              <p className="font-headline-md text-white text-2xl font-black">{stats.totalPossible}</p>
              <p className="text-on-surface-variant font-label-sm text-[10px] uppercase tracking-wider mt-1">Total</p>
            </div>
          </div>

          {/* Most Bunked */}
          {stats.mostBunked?.absent > 0 && (
            <div className="w-full glass-card rounded-2xl p-5 flex items-center gap-4 mb-8">
              <span className="text-3xl select-none">👻</span>
              <div className="flex-1 min-w-0">
                <p className="text-on-surface-variant font-label-sm text-[10px] uppercase tracking-wider">Most Avoided Subject</p>
                <p className="text-white font-headline-sm text-lg mt-0.5 truncate">{stats.mostBunked.name}</p>
                <p className="text-error font-label-sm text-xs mt-0.5">{stats.mostBunked.absent} bunks — {stats.mostBunked.percentage.toFixed(0)}% attendance</p>
              </div>
            </div>
          )}

          {/* Subject Breakdown */}
          <div className="w-full space-y-3 mb-8">
            <h2 className="font-label-lg text-on-surface-variant uppercase tracking-wider ml-1">Final Breakdown</h2>
            {[...stats.lectures, ...stats.labs].map((s: any) => (
              <div key={`${s.name}-${s.isLab ? 'lab' : 'lec'}`} className="glass-card rounded-2xl p-4 flex items-center gap-4">
                <div className="flex-1 min-w-0">
                  <p className="text-white font-label-md truncate">{s.name} <span className="opacity-60 text-xs">{s.isLab ? "(Lab)" : "(Lecture)"}</span></p>
                  <div className="w-full bg-white/5 rounded-full h-1.5 mt-2">
                    <div
                      className={`h-1.5 rounded-full transition-all ${s.percentage >= 75 ? "bg-secondary-fixed" : "bg-error"}`}
                      style={{ width: `${Math.min(100, s.percentage)}%` }}
                    />
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <p className={`font-headline-sm font-bold text-lg ${s.colorClass}`}>{s.percentage.toFixed(0)}%</p>
                  <p className="text-on-surface-variant font-label-sm text-xs">{s.present}/{s.total}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Actions */}
          <div className="w-full space-y-3">
            <button
              onClick={() => router.push("/share")}
              className="w-full primary-gradient text-on-primary py-4 rounded-2xl font-bold active:scale-95 transition-all shadow-xl flex items-center justify-center gap-3"
            >
              <span className="material-symbols-outlined">badge</span>
              Personality Card
            </button>
            <button
              onClick={() => router.push("/onboarding")}
              className="w-full border border-white/10 text-white py-4 rounded-2xl font-bold hover:bg-white/5 active:scale-95 transition-all flex items-center justify-center gap-3"
            >
              <span className="material-symbols-outlined">add</span>
              Start New Semester
            </button>
          </div>

        </div>
      </AppShell>
    );
  }

  if (isEditingTimetable && activeTimetable) {
    return (
      <div className="min-h-screen bg-[#131313]">
        <TimetableReview
          data={activeTimetable.raw_data}
          onConfirm={handleUpdateTimetable}
          onCancel={() => setIsEditingTimetable(false)}
        />
      </div>
    );
  }

  return (
    <AppShell showAdd={true}>
      <div className="container mx-auto px-container-padding max-w-[800px] space-y-stack-lg animate-in fade-in duration-500">
        
        {/* Risk Score Card */}
        <section>
          <div className={`glass-card ${stats.overallPercentage < 75 ? 'neon-glow-red' : stats.overallPercentage < 80 ? 'neon-glow-purple' : 'neon-glow-safe'} rounded-[2.5rem] p-10 relative overflow-hidden transition-all duration-700`}>
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-8 relative z-10">
              <div className="space-y-4">
                <div className={`px-4 py-1 rounded-full uppercase tracking-widest font-label-sm w-fit ${stats.overallPercentage < 75 ? 'bg-error/20 text-error' : stats.overallPercentage < 80 ? 'bg-primary/20 text-primary' : 'bg-secondary-fixed/20 text-secondary-fixed'}`}>
                  {stats.overallPercentage < 75 ? 'DANGER' : stats.overallPercentage < 85 ? 'RISKY' : 'CHILL'}
                </div>
                <h1 className="font-headline-lg text-white">
                  {displayName ? `Hey, ${displayName}! ` : ""}{stats.overallHeadline}
                </h1>
                <p className="text-on-surface-variant font-body-lg text-xl">
                  You have <span className="text-secondary-fixed font-bold">{stats.safeBunks} safe bunks</span> left for the week.
                </p>
              </div>
              <div className="text-right">
                <span className={`block font-display-lg leading-none ${stats.overallPercentage < 75 ? 'text-error' : stats.overallPercentage < 80 ? 'text-primary' : 'text-secondary-fixed'}`} style={{ fontSize: '80px' }}>
                  {stats.overallPercentage.toFixed(0)}%
                </span>
                <span className="text-on-surface-variant font-label-sm uppercase tracking-widest mt-2 block">Overall Attendance</span>
              </div>
            </div>
          </div>
        </section>

        {/* Quick Actions / Mark Day Absent */}
        <section>
          <div className="glass-card rounded-[2rem] p-8 space-y-6 border border-white/5">
            <div className="flex items-center gap-4">
              <span className="material-symbols-outlined text-primary text-3xl">event_busy</span>
              <div>
                <h2 className="font-headline-md text-white text-xl">Quick Absence Logger</h2>
                <p className="text-on-surface-variant font-body-sm text-sm">
                  Mark an entire day absent to automatically flag all scheduled classes on that date as bunked.
                </p>
              </div>
            </div>

            <div className="flex flex-col md:flex-row md:items-end gap-6">
              <div className="flex-1 space-y-2">
                <label className="font-label-sm text-on-surface-variant uppercase ml-1 text-xs block">Select Date</label>
                <div className="flex flex-wrap gap-2.5">
                  <input
                    type="date"
                    value={quickActionDate}
                    onChange={(e) => setQuickActionDate(e.target.value)}
                    className="bg-surface-container border border-white/10 py-2.5 px-4 text-white focus:border-primary transition-all rounded-xl text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => setQuickActionDate(getLocalDateStr())}
                    className={`px-4 py-2 rounded-xl text-xs font-bold transition-all border ${
                      quickActionDate === getLocalDateStr()
                        ? 'bg-primary/20 text-primary border-primary/30'
                        : 'bg-white/5 text-on-surface-variant border-white/10 hover:bg-white/10'
                    }`}
                  >
                    Today
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const yesterday = new Date();
                      yesterday.setDate(yesterday.getDate() - 1);
                      setQuickActionDate(getLocalDateStr(yesterday));
                    }}
                    className={`px-4 py-2 rounded-xl text-xs font-bold transition-all border ${
                      quickActionDate === getLocalDateStr(new Date(new Date().setDate(new Date().getDate() - 1)))
                        ? 'bg-primary/20 text-primary border-primary/30'
                        : 'bg-white/5 text-on-surface-variant border-white/10 hover:bg-white/10'
                    }`}
                  >
                    Yesterday
                  </button>
                </div>
              </div>

              <div className="shrink-0 flex flex-wrap gap-2.5">
                {(() => {
                  const classes = getClassesForDate(quickActionDate);
                  if (classes.length === 0) {
                    return (
                      <button
                        type="button"
                        disabled
                        className="w-full md:w-auto px-6 py-3 bg-white/5 text-on-surface-variant/40 font-bold rounded-xl disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-sm border border-white/5"
                      >
                        <span className="material-symbols-outlined text-base">block</span>
                        No Classes Scheduled
                      </button>
                    );
                  }

                  const isDayMarkedAbsent = classes.every((cls: any) => 
                    allLogs.some(l => l.date === quickActionDate && l.subject_name === cls.subject && l.start_time === cls.startTime && l.status === "absent")
                  );
                  
                  const isDayCancelled = classes.every((cls: any) => 
                    allLogs.some(l => l.date === quickActionDate && l.subject_name === cls.subject && l.start_time === cls.startTime && l.status === "cancelled")
                  );

                  if (isDayMarkedAbsent) {
                    return (
                      <button
                        type="button"
                        onClick={handleUnmarkDayAbsent}
                        disabled={actionLoading === "unmark-day-absent"}
                        className="w-full md:w-auto px-8 py-3 bg-white/10 hover:bg-white/15 text-white font-bold rounded-xl active:scale-95 transition-all border border-white/20 flex items-center justify-center gap-2 text-sm"
                      >
                        <span className="material-symbols-outlined text-base">undo</span>
                        {actionLoading === "unmark-day-absent" ? "Updating..." : "Unmark Day Absent"}
                      </button>
                    );
                  }

                  if (isDayCancelled) {
                    return (
                      <button
                        type="button"
                        onClick={handleUnmarkDayCancelled}
                        disabled={actionLoading === "unmark-day-cancelled"}
                        className="w-full md:w-auto px-8 py-3 bg-white/10 hover:bg-white/15 text-white font-bold rounded-xl active:scale-95 transition-all border border-white/20 flex items-center justify-center gap-2 text-sm"
                      >
                        <span className="material-symbols-outlined text-base">undo</span>
                        {actionLoading === "unmark-day-cancelled" ? "Updating..." : "Unmark Cancelled Day"}
                      </button>
                    );
                  }

                  return (
                    <div className="flex flex-wrap gap-2.5 w-full md:w-auto">
                      <button
                        type="button"
                        onClick={handleMarkDayAbsent}
                        disabled={actionLoading !== null}
                        className="flex-1 md:flex-initial px-6 py-3 bg-[#b91c1c] hover:bg-[#991b1b] text-white font-bold rounded-xl active:scale-95 transition-all shadow-lg flex items-center justify-center gap-2 text-sm"
                      >
                        <span className="material-symbols-outlined text-base">close</span>
                        {actionLoading === "mark-day-absent" ? "Updating..." : "Mark Day Absent"}
                      </button>
                      <button
                        type="button"
                        onClick={handleCancelDay}
                        disabled={actionLoading !== null}
                        className="flex-1 md:flex-initial px-6 py-3 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl active:scale-95 transition-all shadow-lg flex items-center justify-center gap-2 text-sm"
                      >
                        <span className="material-symbols-outlined text-base">event_busy</span>
                        {actionLoading === "mark-day-cancelled" ? "Updating..." : "Cancel Day"}
                      </button>
                    </div>
                  );
                })()}
              </div>
            </div>

            {/* Class Previews */}
             <div className="bg-white/5 p-4 rounded-xl border border-white/5 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-white/5 pb-2.5">
                <span className="text-on-surface-variant font-label-sm text-[10px] uppercase tracking-wider block">
                  Scheduled Classes (Tap to toggle status)
                </span>
                
                {/* Toggle mode switch */}
                <div className="flex items-center gap-1 bg-black/30 p-0.5 rounded-lg border border-white/5 text-[11px] font-bold">
                  <button
                    type="button"
                    onClick={() => setToggleMode("bunk")}
                    className={`px-3 py-1 rounded-md transition-all cursor-pointer ${
                      toggleMode === "bunk"
                        ? "bg-primary text-on-primary shadow-sm"
                        : "text-on-surface-variant hover:text-white"
                    }`}
                  >
                    Bunk Mode
                  </button>
                  <button
                    type="button"
                    onClick={() => setToggleMode("cancel")}
                    className={`px-3 py-1 rounded-md transition-all cursor-pointer ${
                      toggleMode === "cancel"
                        ? "bg-amber-600 text-white shadow-sm"
                        : "text-on-surface-variant hover:text-white"
                    }`}
                  >
                    Cancel Mode
                  </button>
                </div>
              </div>

              {(() => {
                const classes = getClassesForDate(quickActionDate);
                if (classes.length === 0) {
                  return <p className="text-on-surface-variant/50 font-body-sm text-xs italic">No classes scheduled on this day.</p>;
                }
                return (
                  <div className="flex flex-wrap gap-2 pt-1">
                    {classes.map((cls: any, i: number) => {
                      // Check if already marked absent or cancelled
                      const isAbsent = allLogs.some(
                        l => l.date === quickActionDate &&
                             l.subject_name === cls.subject &&
                             l.start_time === cls.startTime &&
                             l.status === "absent"
                      );
                      const isCancelled = allLogs.some(
                        l => l.date === quickActionDate &&
                             l.subject_name === cls.subject &&
                             l.start_time === cls.startTime &&
                             l.status === "cancelled"
                      );
                      const key = `toggle-${cls.subject}-${cls.startTime}`;
                      const isToggling = actionLoading === key;
                      return (
                        <button
                          key={i}
                          type="button"
                          onClick={() => handleToggleClassStatus(cls)}
                          disabled={actionLoading !== null}
                          className={`px-3 py-1.5 rounded-full text-xs font-medium border flex items-center gap-1.5 active:scale-95 transition-all cursor-pointer disabled:opacity-50 ${
                            isAbsent
                              ? "bg-error/15 border-error/40 text-error hover:bg-error/25"
                              : isCancelled
                              ? "bg-amber-600/15 border-amber-600/40 text-amber-500 line-through hover:bg-amber-600/25"
                              : "bg-secondary-fixed/10 border-secondary-fixed/30 text-secondary-fixed hover:bg-secondary-fixed/20"
                          }`}
                          title="Click to toggle status for this class"
                        >
                          <span className="material-symbols-outlined text-[14px]">
                            {isAbsent ? "close" : isCancelled ? "event_busy" : "check"}
                          </span>
                          {cls.subject} ({cls.startTime})
                          {isAbsent && " - Bunked"}
                          {isCancelled && " - Cancelled"}
                          {isToggling && " (...)"}
                        </button>
                      );
                    })}
                  </div>
                );
              })()}
            </div>
          </div>
        </section>

            {/* Lectures Tracker */}
            <section className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="font-headline-md text-white">Lecture Tracker</h2>
                <button 
                  onClick={() => router.push('/subjects')}
                  className="flex items-center gap-2 text-primary font-label-md hover:underline transition-all"
                >
                  <span className="material-symbols-outlined text-sm">history</span>
                  Full History
                </button>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {stats.lectures.map((subject: any) => (
                  <div key={`${subject.name}-lec`} className="glass-card rounded-[2rem] p-8 flex flex-col gap-6 hover:glass-card-active transition-all group">
                    <div className="flex justify-between items-start gap-4">
                      <div className="flex-1">
                        <h3 className="font-headline-md text-white text-xl leading-tight line-clamp-2">{subject.name}</h3>
                        <span className="font-label-sm text-on-surface-variant uppercase tracking-tighter mt-1 block">LECTURE SLOT</span>
                      </div>
                      <div className="text-right">
                        <span className={`font-headline-md ${subject.colorClass}`}>{subject.percentage.toFixed(1)}%</span>
                      </div>
                    </div>
                    
                    <div className="w-full h-4 bg-white/5 rounded-full overflow-hidden border border-white/5">
                      <div 
                        className={`h-full rounded-full transition-all duration-1000 ${subject.percentage < 75 ? 'danger-gradient' : 'safe-gradient'}`} 
                        style={{ width: `${subject.percentage}%` }}
                      ></div>
                    </div>
                    
                    <div className="grid grid-cols-3 gap-3">
                      <div className="space-y-2">
                        <span className="font-label-sm text-on-surface-variant uppercase ml-1 text-[10px]">Attended</span>
                        <div className="flex items-center justify-between bg-white/5 p-1 rounded-xl border border-white/10">
                          <button 
                            onClick={() => handleUpdateOffset(subject.name, "attended", -1, false)}
                            disabled={!!(actionLoading && actionLoading.startsWith(subject.name)) || subject.present <= 0}
                            className="w-7 h-7 rounded-lg bg-white/5 flex items-center justify-center hover:bg-white/10 transition-colors disabled:opacity-50 text-white font-bold"
                          >-</button>
                          <span className="font-headline-md text-white text-base">{subject.present}</span>
                          <button 
                            onClick={() => handleUpdateOffset(subject.name, "attended", 1, false)}
                            disabled={!!(actionLoading && actionLoading.startsWith(subject.name))}
                            className="w-7 h-7 rounded-lg bg-white/5 flex items-center justify-center hover:bg-white/10 transition-colors disabled:opacity-50 text-white font-bold"
                          >+</button>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <span className="font-label-sm text-on-surface-variant uppercase ml-1 text-[10px]">Bunked</span>
                        <div className="flex items-center justify-between bg-white/5 p-1 rounded-xl border border-white/10">
                          <button 
                            onClick={() => handleUpdateOffset(subject.name, "bunked", -1, false)}
                            disabled={!!(actionLoading && actionLoading.startsWith(subject.name)) || subject.absent <= 0}
                            className="w-7 h-7 rounded-lg bg-white/5 flex items-center justify-center hover:bg-white/10 transition-colors disabled:opacity-50 text-white font-bold"
                          >-</button>
                          <span className="font-headline-md text-white text-base">{subject.absent}</span>
                          <button 
                            onClick={() => handleUpdateOffset(subject.name, "bunked", 1, false)}
                            disabled={!!(actionLoading && actionLoading.startsWith(subject.name))}
                            className="w-7 h-7 rounded-lg bg-white/5 flex items-center justify-center hover:bg-white/10 transition-colors disabled:opacity-50 text-white font-bold"
                          >+</button>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <span className="font-label-sm text-on-surface-variant uppercase ml-1 text-[10px]">Total</span>
                        <div className="flex items-center justify-center h-[38px] bg-white/5 rounded-xl border border-white/10">
                          <span className="font-headline-md text-white text-base">{subject.total}</span>
                        </div>
                      </div>
                    </div>
                    
                    {subject.hasOverrides ? (
                      <button 
                        onClick={() => handleResetOffsets(subject.name)}
                        disabled={!!(actionLoading && actionLoading.startsWith(subject.name))}
                        className={`w-full py-4 rounded-2xl border border-error/20 text-error font-label-md hover:bg-error/5 transition-all flex items-center justify-center gap-3 active:scale-95 ${actionLoading && actionLoading.startsWith(subject.name) ? 'opacity-50' : ''}`}
                      >
                        <span className="material-symbols-outlined text-[22px]">restart_alt</span>
                        {actionLoading === `${subject.name}-reset` ? "Processing..." : "Reset Manual Edits"}
                      </button>
                    ) : (
                      <div className="w-full py-4 rounded-2xl border border-white/5 text-on-surface-variant/50 font-label-md flex items-center justify-center gap-3 cursor-not-allowed">
                        <span className="material-symbols-outlined text-[22px]">auto_awesome</span>
                        Auto-Tracked
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </section>

            {/* Labs Tracker */}
            {stats.labs.length > 0 && (
              <section className="space-y-6">
                <div className="flex items-center justify-between">
                  <h2 className="font-headline-md text-white">Lab Tracker</h2>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  {stats.labs.map((subject: any) => (
                    <div key={`${subject.name}-lab`} className="glass-card rounded-[2rem] p-8 flex flex-col gap-6 hover:glass-card-active transition-all group">
                      <div className="flex justify-between items-start gap-4">
                        <div className="flex-1">
                          <h3 className="font-headline-md text-white text-xl leading-tight line-clamp-2">{subject.name}</h3>
                          <span className="font-label-sm text-on-surface-variant uppercase tracking-tighter mt-1 block">LAB SESSION (2H)</span>
                        </div>
                        <div className="text-right">
                          <span className={`font-headline-md ${subject.colorClass}`}>{subject.percentage.toFixed(1)}%</span>
                        </div>
                      </div>
                      
                      <div className="w-full h-4 bg-white/5 rounded-full overflow-hidden border border-white/5">
                        <div 
                          className={`h-full rounded-full transition-all duration-1000 ${subject.percentage < 75 ? 'danger-gradient' : 'safe-gradient'}`} 
                          style={{ width: `${subject.percentage}%` }}
                        ></div>
                      </div>
                      
                      <div className="grid grid-cols-3 gap-3">
                        <div className="space-y-2">
                          <span className="font-label-sm text-on-surface-variant uppercase ml-1 text-[10px]">Attended</span>
                          <div className="flex items-center justify-between bg-white/5 p-1 rounded-xl border border-white/10">
                            <button 
                              onClick={() => handleUpdateOffset(subject.name, "attended", -1, true)}
                              disabled={!!(actionLoading && actionLoading.startsWith(subject.name)) || subject.present <= 0}
                              className="w-7 h-7 rounded-lg bg-white/5 flex items-center justify-center hover:bg-white/10 transition-colors disabled:opacity-50 text-white font-bold"
                            >-</button>
                            <span className="font-headline-md text-white text-base">{subject.present}</span>
                            <button 
                              onClick={() => handleUpdateOffset(subject.name, "attended", 1, true)}
                              disabled={!!(actionLoading && actionLoading.startsWith(subject.name))}
                              className="w-7 h-7 rounded-lg bg-white/5 flex items-center justify-center hover:bg-white/10 transition-colors disabled:opacity-50 text-white font-bold"
                            >+</button>
                          </div>
                        </div>
                        <div className="space-y-2">
                          <span className="font-label-sm text-on-surface-variant uppercase ml-1 text-[10px]">Bunked</span>
                          <div className="flex items-center justify-between bg-white/5 p-1 rounded-xl border border-white/10">
                            <button 
                              onClick={() => handleUpdateOffset(subject.name, "bunked", -1, true)}
                              disabled={!!(actionLoading && actionLoading.startsWith(subject.name)) || subject.absent <= 0}
                              className="w-7 h-7 rounded-lg bg-white/5 flex items-center justify-center hover:bg-white/10 transition-colors disabled:opacity-50 text-white font-bold"
                            >-</button>
                            <span className="font-headline-md text-white text-base">{subject.absent}</span>
                            <button 
                              onClick={() => handleUpdateOffset(subject.name, "bunked", 1, true)}
                              disabled={!!(actionLoading && actionLoading.startsWith(subject.name))}
                              className="w-7 h-7 rounded-lg bg-white/5 flex items-center justify-center hover:bg-white/10 transition-colors disabled:opacity-50 text-white font-bold"
                            >+</button>
                          </div>
                        </div>
                        <div className="space-y-2">
                          <span className="font-label-sm text-on-surface-variant uppercase ml-1 text-[10px]">Total</span>
                          <div className="flex items-center justify-center h-[38px] bg-white/5 rounded-xl border border-white/10">
                            <span className="font-headline-md text-white text-base">{subject.total}</span>
                          </div>
                        </div>
                      </div>
                      
                      {subject.hasOverrides ? (
                        <button 
                          onClick={() => handleResetOffsets(subject.name)}
                          disabled={!!(actionLoading && actionLoading.startsWith(subject.name))}
                          className={`w-full py-4 rounded-2xl border border-error/20 text-error font-label-md hover:bg-error/5 transition-all flex items-center justify-center gap-3 active:scale-95 ${actionLoading && actionLoading.startsWith(subject.name) ? 'opacity-50' : ''}`}
                        >
                          <span className="material-symbols-outlined text-[22px]">restart_alt</span>
                          {actionLoading === `${subject.name}-reset` ? "Processing..." : "Reset Manual Edits"}
                        </button>
                      ) : (
                        <div className="w-full py-4 rounded-2xl border border-white/5 text-on-surface-variant/50 font-label-md flex items-center justify-center gap-3 cursor-not-allowed">
                          <span className="material-symbols-outlined text-[22px]">auto_awesome</span>
                          Auto-Tracked
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Bunk Optimizer Sneak Peek */}
            <section className="pb-12">
              <div className="flex items-center gap-4 mb-8">
                <span className="material-symbols-outlined text-primary text-3xl">rocket_launch</span>
                <h2 className="font-headline-md text-white">AI Bunk Optimizer</h2>
              </div>
              <div className="glass-card-active rounded-[2.5rem] overflow-hidden border border-primary/20">
                <div className="bg-primary/10 border-b border-white/5 px-8 py-5 flex items-center justify-between">
                  <span className="font-label-md text-primary tracking-widest">LONG WEEKEND DETECTED!</span>
                  <span className="font-label-sm bg-primary/20 text-primary px-4 py-1.5 rounded-full">MARCH 24-27</span>
                </div>
                <div className="p-10 flex flex-col lg:flex-row gap-12 items-center">
                  <div className="w-full lg:w-80 shrink-0">
                    <div className="aspect-video lg:aspect-square rounded-2xl overflow-hidden border border-white/10 relative">
                      <img className="w-full h-full object-cover" src="https://lh3.googleusercontent.com/aida-public/AB6AXuC49nXF1TR4Y1eo5TvxhU0npzscOCNtC8ktEQyJpDylLHVRe5v1D6Xjvf3lHNNLWznU8r1-4Le_hQg041U-5MSR9FkHOiFWLM3fh0VEjkhzTD0Jl_5KyqdiOg8NYXqezIabHj-jr-6mexJ7qkWc-vqijiPE_sugQIEdukWVauD5wkXv0pjcE_GDjD_0xOSsrtykWMJ_zxrGySGF_9XoMYBCQkZzlcDn0UrGscr0sGqlcjUqUiW2GeRR5tLYTbZbi6f9p6D7BD9mZl0" alt="Travel"/>
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent"></div>
                    </div>
                  </div>
                  <div className="flex-1 space-y-6">
                    <h3 className="font-headline-lg text-white">Holi Break Maximizer</h3>
                    <p className="text-on-surface-variant font-body-lg text-xl leading-relaxed">
                      Bunk just 1 lecture on Friday to get a <span className="text-white font-bold">4-day stretch</span>. Your attendance will drop only by 0.8%. 
                    </p>
                    <div className="flex flex-wrap gap-5 pt-4">
                      <button 
                        onClick={() => router.push("/planner")}
                        className="px-10 py-4 bg-primary text-on-primary font-bold rounded-2xl hover-glow-purple active:scale-95 transition-all shadow-xl"
                      >Plan Trip</button>
                      <button 
                        onClick={() => router.push("/planner")}
                        className="px-10 py-4 border border-white/10 text-white font-bold rounded-2xl hover:bg-white/5 active:scale-95 transition-all"
                      >See Full Impact</button>
                    </div>
                  </div>
                </div>
              </div>
            </section>

      </div>
    </AppShell>
  );
}
