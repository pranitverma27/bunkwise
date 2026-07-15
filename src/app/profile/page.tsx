"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/Navigation";

export default function ProfilePage() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTimetable, setActiveTimetable] = useState<any>(null);
  const [totalLogs, setTotalLogs] = useState(0);
  const [resetting, setResetting] = useState(false);
  const [goal, setGoal] = useState<number>(75);
  const [savingGoal, setSavingGoal] = useState(false);
  const [quickStats, setQuickStats] = useState<any>(null);
  const [semesterDate, setSemesterDate] = useState("");
  const [savingSemester, setSavingSemester] = useState(false);
  const [semesterEndDate, setSemesterEndDate] = useState("");
  const [savingEndDate, setSavingEndDate] = useState(false);
  const [exportingCsv, setExportingCsv] = useState(false);
  const [allLogs, setAllLogs] = useState<any[]>([]);
  const [displayName, setDisplayName] = useState("");
  const [savedName, setSavedName] = useState("");
  const [savingName, setSavingName] = useState(false);
  
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
    // Fetch actual logs (not just count) so we can compute streaks
    const { data: logs } = await supabase
      .from("attendance_logs")
      .select("*")
      .eq("user_id", userId);

    setTotalLogs(logs?.length || 0);
    setAllLogs(logs || []);

    // Fetch display name from profiles
    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("id", userId)
      .maybeSingle();
    if (profile?.full_name) {
      setDisplayName(profile.full_name);
      setSavedName(profile.full_name);
    }

    const { data: timetable } = await supabase
      .from("timetables")
      .select("*")
      .eq("user_id", userId)
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (timetable) {
      setActiveTimetable(timetable);
      setGoal(timetable.raw_data?.attendance_goal || 75);
      const rawStart = timetable.raw_data?.semester_start;
      if (rawStart) setSemesterDate(new Date(rawStart).toISOString().split("T")[0]);
      const rawEnd = timetable.raw_data?.semester_end;
      if (rawEnd) setSemesterEndDate(new Date(rawEnd).toISOString().split("T")[0]);
      computeQuickStats(timetable, logs || []);
    }
  }

  function computeQuickStats(timetable: any, logs: any[]) {
    const subjects: string[] = timetable.raw_data?.subjects || [];
    const schedule: any[] = timetable.raw_data?.schedule || [];
    const semesterStart = new Date(timetable.raw_data?.semester_start || new Date().setMonth(new Date().getMonth() - 1));
    semesterStart.setHours(0, 0, 0, 0);
    const today = new Date();

    // Days tracked
    const msPerDay = 1000 * 60 * 60 * 24;
    const daysTracked = Math.max(1, Math.floor((today.getTime() - semesterStart.getTime()) / msPerDay) + 1);

    // Busiest day
    const dayCounts: Record<string, number> = {};
    schedule.forEach((day: any) => {
      dayCounts[day.day] = (day.classes || []).length;
    });
    const busiestDay = Object.entries(dayCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || "N/A";

    // Overall attendance + streak calculation
    const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    let totalPresent = 0;
    let totalClasses = 0;
    const subjectTotals: Record<string, { present: number; total: number }> = {};
    subjects.forEach(s => { subjectTotals[s] = { present: 0, total: 0 }; });

    // Build a list of school days with bunk status for streak
    const schoolDays: { date: string; hadBunk: boolean }[] = [];

    for (let d = new Date(semesterStart); d <= today; d.setDate(d.getDate() + 1)) {
      const dateStr = d.toISOString().split("T")[0];
      const dayName = days[d.getDay()];
      const dayClasses = schedule.find((s: any) => s.day === dayName)?.classes || [];
      if (dayClasses.length === 0) continue; // skip no-class days

      let dayHadFinishedClass = false;
      let dayHadBunk = false;

      dayClasses.forEach((cls: any) => {
        if (!subjectTotals[cls.subject]) return;
        const [endH, endM] = (cls.endTime || "00:00").split(":").map(Number);
        const classEnd = new Date(d);
        classEnd.setHours(endH, endM, 0, 0);
        if (classEnd <= today) {
          dayHadFinishedClass = true;
          const log = logs.find((l: any) => l.date === dateStr && l.subject_name === cls.subject);
          if (log?.status === "absent") {
            dayHadBunk = true;
            subjectTotals[cls.subject].total++;
            totalClasses++;
          } else {
            subjectTotals[cls.subject].present++;
            subjectTotals[cls.subject].total++;
            totalPresent++;
            totalClasses++;
          }
        }
      });

      if (dayHadFinishedClass) {
        schoolDays.push({ date: dateStr, hadBunk: dayHadBunk });
      }
    }

    // Compute streak going backwards from most recent school day
    let streakCount = 0;
    let streakType: "clean" | "bunk" | "none" = "none";
    if (schoolDays.length > 0) {
      const lastDay = schoolDays[schoolDays.length - 1];
      streakType = lastDay.hadBunk ? "bunk" : "clean";
      for (let i = schoolDays.length - 1; i >= 0; i--) {
        if (schoolDays[i].hadBunk === lastDay.hadBunk) {
          streakCount++;
        } else {
          break;
        }
      }
    }

    const overallPct = totalClasses > 0 ? Math.round((totalPresent / totalClasses) * 100) : 100;
    const semesterStartFormatted = semesterStart.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

    setQuickStats({
      subjects: subjects.length,
      daysTracked,
      busiestDay,
      overallPct,
      semesterStart: semesterStartFormatted,
      streakCount,
      streakType,
    });
  }

  async function handleSaveName() {
    if (!user || !displayName.trim()) return;
    setSavingName(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .upsert({ id: user.id, full_name: displayName.trim() });
      if (error) throw error;
      setSavedName(displayName.trim());
      alert(`Display name saved! You'll now see "Hey, ${displayName.trim()} 👋" on the dashboard.`);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSavingName(false);
    }
  }

  async function handleSaveSemesterEnd(dateToSave?: string) {
    if (!activeTimetable) return;
    const date = dateToSave ?? semesterEndDate;
    if (!date) return;
    setSavingEndDate(true);
    try {
      const currentData = { ...activeTimetable.raw_data, semester_end: date };
      const { error } = await supabase
        .from("timetables")
        .update({ raw_data: currentData })
        .eq("id", activeTimetable.id);
      if (error) throw error;
      const updated = { ...activeTimetable, raw_data: currentData };
      setActiveTimetable(updated);
      setSemesterEndDate(date);
      computeQuickStats(updated, allLogs);
      alert("Semester end date saved!");
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSavingEndDate(false);
    }
  }

  async function handleMarkSemesterEnded() {
    const today = new Date().toISOString().split("T")[0];
    setSemesterEndDate(today);
    await handleSaveSemesterEnd(today);
  }

  async function handleSaveSemesterDate() {
    if (!activeTimetable || !semesterDate) return;
    setSavingSemester(true);
    try {
      const currentData = { ...activeTimetable.raw_data, semester_start: semesterDate };
      const { error } = await supabase
        .from("timetables")
        .update({ raw_data: currentData })
        .eq("id", activeTimetable.id);
      if (error) throw error;
      const updated = { ...activeTimetable, raw_data: currentData };
      setActiveTimetable(updated);
      computeQuickStats(updated, allLogs);
      alert("Semester start date updated! Your stats have been recalculated.");
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSavingSemester(false);
    }
  }

  async function handleSaveGoal() {
    if (!activeTimetable) return;
    setSavingGoal(true);
    try {
      const currentData = { ...activeTimetable.raw_data, attendance_goal: goal };
      const { error } = await supabase
        .from("timetables")
        .update({ raw_data: currentData })
        .eq("id", activeTimetable.id);
      
      if (error) throw error;
      setActiveTimetable({ ...activeTimetable, raw_data: currentData });
      alert("Attendance goal updated!");
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSavingGoal(false);
    }
  }

  async function handleExportCSV() {
    if (!user) return;
    setExportingCsv(true);
    try {
      const { data: logs, error } = await supabase
        .from("attendance_logs")
        .select("*")
        .eq("user_id", user.id)
        .order("date", { ascending: false });

      if (error) throw error;

      if (!logs || logs.length === 0) {
        alert("No attendance logs found to export.");
        return;
      }

      const headers = ["Date", "Subject", "Status", "Logged At"];
      const rows = logs.map((log: any) => [
        log.date,
        `"${log.subject_name.replace(/"/g, '""')}"`,
        log.status,
        new Date(log.created_at).toLocaleString("en-IN"),
      ]);

      const csvContent = [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `bunkwise-attendance-${new Date().toISOString().split("T")[0]}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      alert("Export failed: " + err.message);
    } finally {
      setExportingCsv(false);
    }
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/");
  }

  async function handleResetData() {
    const confirmDelete = window.confirm(
      "WARNING: This will permanently delete your active timetable and all logged attendance data. You cannot undo this. Are you sure?"
    );
    
    if (!confirmDelete) return;
    
    setResetting(true);
    try {
      // Delete logs
      await supabase.from("attendance_logs").delete().eq("user_id", user.id);
      
      // Delete timetables
      await supabase.from("timetables").delete().eq("user_id", user.id);
      
      alert("All data has been reset.");
      router.push("/onboarding");
    } catch (err: any) {
      alert("Failed to reset data: " + err.message);
    } finally {
      setResetting(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#131313] flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <AppShell>
      <div className="container mx-auto px-container-padding max-w-[600px] space-y-stack-lg animate-in fade-in duration-500">
        
        <div className="flex items-center gap-4 mb-8">
          <div className="w-16 h-16 rounded-full bg-primary/20 text-primary flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-4xl">person</span>
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="font-headline-lg text-white">
              {savedName ? `Hey, ${savedName} 👋` : "Profile"}
            </h1>
            <p className="text-on-surface-variant font-body-md truncate">{user?.email}</p>
          </div>
        </div>

        {/* Stats Card */}
        <div className="glass-card rounded-[2rem] p-6 flex justify-between items-center">
          <div>
            <span className="font-label-sm text-on-surface-variant block mb-1">TOTAL CLASSES MODIFIED</span>
            <span className="font-headline-md text-white">{totalLogs}</span>
          </div>
          <div className="w-12 h-12 rounded-xl bg-secondary-fixed/20 text-secondary-fixed flex items-center justify-center">
            <span className="material-symbols-outlined">monitoring</span>
          </div>
        </div>

        {/* Streak Badge */}
        {quickStats && quickStats.streakType !== "none" && (
          <div
            className={`rounded-[1.5rem] p-5 flex items-center gap-5 border ${
              quickStats.streakType === "clean"
                ? "bg-secondary-fixed/10 border-secondary-fixed/30"
                : "bg-error/10 border-error/30"
            }`}
          >
            <span className="text-4xl select-none">
              {quickStats.streakType === "clean" ? "🔥" : "👻"}
            </span>
            <div>
              <p className={`font-headline-sm text-lg ${ quickStats.streakType === "clean" ? "text-secondary-fixed" : "text-error" }`}>
                {quickStats.streakType === "clean"
                  ? `${quickStats.streakCount}-day clean streak!`
                  : `${quickStats.streakCount}-day bunk streak...`}
              </p>
              <p className="text-on-surface-variant font-body-sm mt-0.5">
                {quickStats.streakType === "clean"
                  ? "Keep it up! You're on fire."
                  : "Maybe it's time to show up? 👀"}
              </p>
            </div>
          </div>
        )}

        {/* Personality Card Link */}
        <button 
          onClick={() => router.push('/share')}
          className="w-full glass-card border border-primary/20 bg-primary/5 rounded-[1.5rem] p-5 flex items-center justify-between hover:bg-primary/10 active:scale-95 transition-all shadow-lg"
        >
          <div className="flex items-center gap-4">
            <span className="material-symbols-outlined text-primary">badge</span>
            <div className="text-left">
              <span className="font-label-md text-white block">Personality Card</span>
              <span className="font-label-sm text-on-surface-variant text-xs">Generate and share your Marvel character card on WhatsApp</span>
            </div>
          </div>
          <span className="material-symbols-outlined text-on-surface-variant">chevron_right</span>
        </button>

        {/* Quick Stats Summary */}
        {quickStats && (
          <div className="space-y-3">
            <h2 className="font-label-lg text-on-surface-variant uppercase tracking-wider ml-2">Semester Overview</h2>
            <div className="glass-card rounded-[1.5rem] p-5 grid grid-cols-2 gap-4">
              <div className="bg-white/5 rounded-2xl p-4 flex flex-col gap-1">
                <span className="material-symbols-outlined text-primary text-xl">calendar_today</span>
                <span className="font-headline-sm text-white text-lg">{quickStats.semesterStart}</span>
                <span className="font-label-sm text-on-surface-variant text-[10px] uppercase tracking-wider">Semester Start</span>
              </div>
              <div className="bg-white/5 rounded-2xl p-4 flex flex-col gap-1">
                <span className="material-symbols-outlined text-secondary-fixed text-xl">book</span>
                <span className="font-headline-sm text-white text-lg">{quickStats.subjects} Subjects</span>
                <span className="font-label-sm text-on-surface-variant text-[10px] uppercase tracking-wider">Tracked</span>
              </div>
              <div className="bg-white/5 rounded-2xl p-4 flex flex-col gap-1">
                <span className="material-symbols-outlined text-primary text-xl">today</span>
                <span className="font-headline-sm text-white text-lg">{quickStats.daysTracked} Days</span>
                <span className="font-label-sm text-on-surface-variant text-[10px] uppercase tracking-wider">In Semester</span>
              </div>
              <div className="bg-white/5 rounded-2xl p-4 flex flex-col gap-1">
                <span className="material-symbols-outlined text-secondary-fixed text-xl">bolt</span>
                <span className="font-headline-sm text-white text-lg">{quickStats.busiestDay}</span>
                <span className="font-label-sm text-on-surface-variant text-[10px] uppercase tracking-wider">Busiest Day</span>
              </div>
            </div>
          </div>
        )}

        {/* Settings */}
        <div className="space-y-4 pt-4">
          <h2 className="font-label-lg text-on-surface-variant uppercase tracking-wider ml-2">Settings</h2>
          <div className="glass-card rounded-[1.5rem] p-6 space-y-5">
            {/* Display Name */}
            <div>
              <h3 className="font-headline-sm text-white mb-1">Display Name</h3>
              <p className="text-on-surface-variant font-body-sm mb-3">Shows as a greeting on your dashboard.</p>
              <input
                type="text"
                placeholder="e.g. Pranit"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                maxLength={30}
                className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-4 text-white font-bold focus:border-primary focus:outline-none placeholder:text-white/20"
              />
            </div>
            {displayName.trim() !== savedName && displayName.trim() && (
              <button
                onClick={handleSaveName}
                disabled={savingName}
                className="w-full bg-primary/20 text-primary hover:bg-primary/30 py-3 rounded-xl font-bold transition-all disabled:opacity-50"
              >
                {savingName ? "Saving..." : "Save Name"}
              </button>
            )}

            <div className="border-t border-white/10 pt-5">
              {/* Target Attendance */}
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="font-headline-sm text-white">Target Attendance</h3>
                  <p className="text-on-surface-variant font-body-sm mt-1">Set your minimum required percentage.</p>
                </div>
                <div className="flex items-center gap-2">
                  <input 
                    type="number" 
                    min="1" 
                    max="100" 
                    value={goal}
                    onChange={(e) => setGoal(Number(e.target.value))}
                    className="w-20 bg-white/5 border border-white/10 rounded-xl py-2 px-3 text-white text-center font-bold focus:border-primary focus:outline-none"
                  />
                  <span className="text-white font-bold">%</span>
                </div>
              </div>
              {(activeTimetable?.raw_data?.attendance_goal || 75) !== goal && (
                <button 
                  onClick={handleSaveGoal}
                  disabled={savingGoal}
                  className="w-full mt-4 bg-primary/20 text-primary hover:bg-primary/30 py-3 rounded-xl font-bold transition-all disabled:opacity-50"
                >
                  {savingGoal ? "Saving..." : "Save Attendance Goal"}
                </button>
              )}
            </div>

            <div className="border-t border-white/10 pt-5">
              <h3 className="font-headline-sm text-white mb-1">Semester Start Date</h3>
              <p className="text-on-surface-variant font-body-sm mb-3">Recalculates all stats from this date onwards.</p>
              <input
                type="date"
                value={semesterDate}
                onChange={(e) => setSemesterDate(e.target.value)}
                max={new Date().toISOString().split("T")[0]}
                className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-4 text-white font-bold focus:border-primary focus:outline-none appearance-none"
              />
              {semesterDate !== (activeTimetable?.raw_data?.semester_start ? new Date(activeTimetable.raw_data.semester_start).toISOString().split("T")[0] : "") && semesterDate && (
                <button
                  onClick={handleSaveSemesterDate}
                  disabled={savingSemester}
                  className="w-full mt-4 bg-secondary-fixed/20 text-secondary-fixed hover:bg-secondary-fixed/30 py-3 rounded-xl font-bold transition-all disabled:opacity-50"
                >
                  {savingSemester ? "Recalculating..." : "Save & Recalculate Stats"}
                </button>
              )}
            </div>

            <div className="border-t border-white/10 pt-5">
              <h3 className="font-headline-sm text-white mb-1">Semester End Date</h3>
              <p className="text-on-surface-variant font-body-sm mb-3">Stats will stop accumulating after this date.</p>
              <input
                type="date"
                value={semesterEndDate}
                onChange={(e) => setSemesterEndDate(e.target.value)}
                min={semesterDate || undefined}
                className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-4 text-white font-bold focus:border-primary focus:outline-none appearance-none"
              />
              <div className="flex gap-3 mt-4">
                <button
                  onClick={handleMarkSemesterEnded}
                  disabled={savingEndDate}
                  className="flex-1 bg-white/5 border border-white/10 text-on-surface-variant hover:bg-white/10 py-3 rounded-xl font-bold transition-all disabled:opacity-50 flex items-center justify-center gap-2 text-sm"
                >
                  <span className="material-symbols-outlined text-base">flag</span>
                  Semester Ended
                </button>
                {semesterEndDate !== (activeTimetable?.raw_data?.semester_end ? new Date(activeTimetable.raw_data.semester_end).toISOString().split("T")[0] : "") && semesterEndDate && (
                  <button
                    onClick={() => handleSaveSemesterEnd()}
                    disabled={savingEndDate}
                    className="flex-1 bg-secondary-fixed/20 text-secondary-fixed hover:bg-secondary-fixed/30 py-3 rounded-xl font-bold transition-all disabled:opacity-50 text-sm"
                  >
                    {savingEndDate ? "Saving..." : "Save End Date"}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>


        {/* Account Actions */}
        <div className="space-y-4 pt-4">
          <h2 className="font-label-lg text-on-surface-variant uppercase tracking-wider ml-2">Account</h2>
          
          <button 
            onClick={() => router.push('/onboarding')}
            className="w-full glass-card rounded-[1.5rem] p-5 flex items-center justify-between hover:bg-white/5 active:scale-95 transition-all"
          >
            <div className="flex items-center gap-4">
              <span className="material-symbols-outlined text-primary">upload_file</span>
              <span className="font-label-md text-white">Upload New Timetable</span>
            </div>
            <span className="material-symbols-outlined text-on-surface-variant">chevron_right</span>
          </button>

          <button 
            onClick={handleExportCSV}
            disabled={exportingCsv}
            className="w-full glass-card rounded-[1.5rem] p-5 flex items-center justify-between hover:bg-white/5 active:scale-95 transition-all disabled:opacity-50"
          >
            <div className="flex items-center gap-4">
              <span className="material-symbols-outlined text-secondary-fixed">download</span>
              <div className="text-left">
                <span className="font-label-md text-white block">Export Attendance (CSV)</span>
                <span className="font-label-sm text-on-surface-variant text-xs">{totalLogs} logs ready to export</span>
              </div>
            </div>
            {exportingCsv
              ? <div className="w-5 h-5 border-2 border-secondary-fixed border-t-transparent rounded-full animate-spin" />
              : <span className="material-symbols-outlined text-on-surface-variant">chevron_right</span>
            }
          </button>
          
          <button 
            onClick={handleLogout}
            className="w-full glass-card rounded-[1.5rem] p-5 flex items-center justify-between hover:bg-white/5 active:scale-95 transition-all"
          >
            <div className="flex items-center gap-4">
              <span className="material-symbols-outlined text-on-surface-variant">logout</span>
              <span className="font-label-md text-white">Sign Out</span>
            </div>
          </button>
        </div>

        {/* Danger Zone */}
        <div className="space-y-4 pt-8">
          <h2 className="font-label-lg text-error uppercase tracking-wider ml-2 flex items-center gap-2">
            <span className="material-symbols-outlined text-sm">warning</span>
            Danger Zone
          </h2>
          
          <div className="glass-card border border-error/20 bg-error/5 rounded-[1.5rem] p-6 space-y-4">
            <p className="text-on-surface-variant font-body-sm">
              Resetting your data will permanently delete your active timetable and all tracked attendance. This action cannot be undone.
            </p>
            <button 
              onClick={handleResetData}
              disabled={resetting}
              className="w-full bg-error/10 text-error hover:bg-error/20 py-4 rounded-xl font-bold active:scale-95 transition-all disabled:opacity-50 flex justify-center items-center gap-2"
            >
              <span className="material-symbols-outlined">delete_forever</span>
              {resetting ? "Deleting..." : "Reset All Data"}
            </button>
          </div>
        </div>

      </div>
    </AppShell>
  );
}
