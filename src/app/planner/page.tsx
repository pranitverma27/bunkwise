"use client";

import { useEffect, useState, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/Navigation";
import { parseHolidaysFile, ParsedHoliday } from "../actions/parse-holidays";

// Baseline Indian Holidays for 2026
const DEFAULT_INDIAN_HOLIDAYS: ParsedHoliday[] = [
  { date: "2026-01-26", name: "Republic Day" },
  { date: "2026-03-06", name: "Holi" },
  { date: "2026-03-27", name: "Good Friday" },
  { date: "2026-04-02", name: "Mahavir Jayanti" },
  { date: "2026-04-14", name: "Ambedkar Jayanti" },
  { date: "2026-05-01", name: "May Day" },
  { date: "2026-08-15", name: "Independence Day" },
  { date: "2026-09-04", name: "Janmashtami" },
  { date: "2026-10-02", name: "Gandhi Jayanti" },
  { date: "2026-10-22", name: "Dussehra" },
  { date: "2026-11-09", name: "Diwali" },
  { date: "2026-12-25", name: "Christmas" },
];

export default function PlannerPage() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTimetable, setActiveTimetable] = useState<any>(null);
  const [allLogs, setAllLogs] = useState<any[]>([]);
  
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  
  const [currentStats, setCurrentStats] = useState<any>(null);
  const [projectedStats, setProjectedStats] = useState<any>(null);
  const [missedClasses, setMissedClasses] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);

  // Holiday list states
  const [customHolidays, setCustomHolidays] = useState<ParsedHoliday[]>([]);
  const [uploadingHoliday, setUploadingHoliday] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Calendar states
  const [currentMonth, setCurrentMonth] = useState<Date>(new Date());
  
  const router = useRouter();

  // Load custom holidays on mount
  useEffect(() => {
    const saved = localStorage.getItem("bunkwise_custom_holidays");
    if (saved) {
      try {
        setCustomHolidays(JSON.parse(saved));
      } catch (e) {
        console.error("Failed to parse custom holidays", e);
      }
    }
  }, []);

  const holidays = [...DEFAULT_INDIAN_HOLIDAYS, ...customHolidays];

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

    if (tError || !timetable) {
      router.push("/onboarding");
      return;
    }

    setActiveTimetable(timetable);

    const { data: logs, error: lError } = await supabase
      .from("attendance_logs")
      .select("*")
      .eq("user_id", userId);

    const currentLogs = logs || [];
    setAllLogs(currentLogs);
    
    // Set initial dates to tomorrow
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tmrwStr = tomorrow.toISOString().split("T")[0];
    setStartDate(tmrwStr);
    setEndDate(tmrwStr);

    calculateBaseStats(timetable, currentLogs);
  }

  function calculateBaseStats(timetable: any, logs: any[]) {
    try {
      const subjects = timetable.raw_data?.subjects || [];
      const schedule = timetable.raw_data?.schedule || [];
      const semesterStart = new Date(timetable.raw_data?.semester_start || new Date().setMonth(new Date().getMonth() - 1));
      semesterStart.setHours(0, 0, 0, 0);
      
      const today = new Date();
      const subjectStats: any = {};

      subjects.forEach((s: string) => {
        const overrides = timetable.raw_data?.overrides?.[s] || { attended: 0, bunked: 0 };
        subjectStats[s] = { 
          present: overrides.attended, 
          absent: overrides.bunked, 
          total: overrides.attended + overrides.bunked 
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
            if (!log || log.status === "present") {
              subjectStats[cls.subject].present++;
              subjectStats[cls.subject].total++;
            } else if (log.status === "absent") {
              subjectStats[cls.subject].absent++;
              subjectStats[cls.subject].total++;
            }
          }
        });
      }

      setCurrentStats(subjectStats);
    } catch (err) {
      console.error(err);
    }
  }

  // Calculate missed classes and simulated stats when dates change
  useEffect(() => {
    if (!currentStats || !activeTimetable || !startDate || !endDate) return;
    
    const start = new Date(startDate);
    const end = new Date(endDate);
    if (end < start) return;

    const schedule = activeTimetable.raw_data?.schedule || [];
    const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    
    const missed: any[] = [];
    const simulated = JSON.parse(JSON.stringify(currentStats));

    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      const dayName = days[d.getDay()];
      const dayClasses = schedule.find((s: any) => s.day === dayName)?.classes || [];
      
      dayClasses.forEach((cls: any) => {
        missed.push({
          date: dateStr,
          subject: cls.subject,
          startTime: cls.startTime
        });
        
        if (simulated[cls.subject]) {
          simulated[cls.subject].absent++;
          simulated[cls.subject].total++;
        }
      });
    }

    setMissedClasses(missed);
    setProjectedStats(simulated);
  }, [startDate, endDate, currentStats, activeTimetable]);

  // Automatically transition the calendar view month when a date range is selected
  useEffect(() => {
    if (startDate) {
      const parts = startDate.split("-").map(Number);
      if (parts.length === 3) {
        // Set calendar to year and month of the selected start date (local timezone)
        setCurrentMonth(new Date(parts[0], parts[1] - 1, 1));
      }
    }
  }, [startDate]);

  async function handleSavePlan() {
    if (missedClasses.length === 0) {
      alert("No classes selected to bunk.");
      return;
    }
    setSaving(true);
    try {
      const inserts = missedClasses.map(m => ({
        user_id: user.id,
        subject_name: m.subject,
        start_time: m.startTime,
        date: m.date,
        status: "absent"
      }));
      
      const { error } = await supabase.from("attendance_logs").insert(inserts);
      
      if (error) {
        if (error.code === '23505') {
            alert("Some of these classes are already logged.");
        } else {
            throw error;
        }
      } else {
        alert("Bunk Plan saved successfully! Your dashboard will automatically update when these days pass.");
        router.push("/dashboard");
      }
    } catch (err: any) {
      alert("Failed to save plan: " + err.message);
    } finally {
      setSaving(false);
    }
  }

  // Handle Holiday list file upload
  async function handleHolidayUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingHoliday(true);
    try {
      const reader = new FileReader();
      reader.onload = async () => {
        const base64 = reader.result as string;
        try {
          const parsed = await parseHolidaysFile(base64, file.type);
          if (parsed && parsed.length > 0) {
            // Append and deduplicate by date
            const combined = [...customHolidays, ...parsed];
            const unique = combined.filter((val, idx, self) => 
              self.findIndex(t => t.date === val.date) === idx
            );
            setCustomHolidays(unique);
            localStorage.setItem("bunkwise_custom_holidays", JSON.stringify(unique));
            alert(`Successfully imported ${parsed.length} holidays!`);
          } else {
            alert("Could not identify any holidays in this file. Please ensure dates are clearly visible.");
          }
        } catch (err: any) {
          alert("Error parsing file: " + err.message);
        } finally {
          setUploadingHoliday(false);
        }
      };
      reader.readAsDataURL(file);
    } catch (err: any) {
      alert("Failed to read file");
      setUploadingHoliday(false);
    }
  }

  function handleClearCustomHolidays() {
    if (confirm("Are you sure you want to clear your uploaded custom holidays list?")) {
      setCustomHolidays([]);
      localStorage.removeItem("bunkwise_custom_holidays");
    }
  }

  // Range selecting inside Calendar
  function handleDateClick(dateStr: string) {
    if (!startDate || (startDate && endDate && startDate !== endDate)) {
      setStartDate(dateStr);
      setEndDate(dateStr);
    } else {
      const start = new Date(startDate);
      const clicked = new Date(dateStr);
      if (clicked < start) {
        setStartDate(dateStr);
        setEndDate(dateStr);
      } else {
        setEndDate(dateStr);
      }
    }
  }

  // Generate Month View Calendar helper values
  const getDaysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();
  const getFirstDayOfMonth = (year: number, month: number) => new Date(year, month, 1).getDay();

  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();
  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = getFirstDayOfMonth(year, month);

  const prevMonth = () => setCurrentMonth(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentMonth(new Date(year, month + 1, 1));

  // Determine holiday details for a given date
  const getHoliday = (dateStr: string) => holidays.find(h => h.date === dateStr);

  // Check if user has classes on a specific day of week
  const hasClassesOnDayOfWeek = (dateStr: string) => {
    if (!activeTimetable) return false;
    // Parse using local timezone parts to prevent timezone offsets
    const [y, m, d] = dateStr.split("-").map(Number);
    const dateObj = new Date(y, m - 1, d);
    const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    const dayName = dayNames[dateObj.getDay()];
    const dayClasses = activeTimetable.raw_data?.schedule?.find((s: any) => s.day === dayName)?.classes || [];
    return dayClasses.length > 0;
  };

  // Check if a date is within selected range
  const isSelected = (dateStr: string) => {
    if (!startDate || !endDate) return false;
    
    // Normalize all dates to local midnight date objects
    const [curY, curM, curD] = dateStr.split("-").map(Number);
    const cur = new Date(curY, curM - 1, curD);
    
    const [sY, sM, sD] = startDate.split("-").map(Number);
    const s = new Date(sY, sM - 1, sD);
    
    const [eY, eM, eD] = endDate.split("-").map(Number);
    const e = new Date(eY, eM - 1, eD);
    
    return cur >= s && cur <= e;
  };

  // Generate smart bunk suggestions based on holidays in 2026
  function getBunkSuggestions() {
    const suggestions: any[] = [];
    const processedHolidays = [...holidays].sort((a, b) => a.date.localeCompare(b.date));

    // Local timezone safe formatting helper
    const formatDateLocal = (date: Date) => {
      const y = date.getFullYear();
      const m = String(date.getMonth() + 1).padStart(2, "0");
      const d = String(date.getDate()).padStart(2, "0");
      return `${y}-${m}-${d}`;
    };

    processedHolidays.forEach(h => {
      const [hy, hm, hd] = h.date.split("-").map(Number);
      const hDate = new Date(hy, hm - 1, hd); // Parse local
      // Skip past holidays to keep it relevant
      if (hDate < new Date()) return;
      const day = hDate.getDay(); // 0 = Sun, 6 = Sat

      // Thursday Holiday -> Bridge Friday
      if (day === 4) {
        const friDate = new Date(hDate);
        friDate.setDate(hDate.getDate() + 1);
        const friStr = formatDateLocal(friDate);
        
        // Sunday is +3 days
        const sunDate = new Date(hDate);
        sunDate.setDate(hDate.getDate() + 3);
        const sunStr = formatDateLocal(sunDate);
        
        suggestions.push({
          type: "bridge",
          title: `${h.name} Extended Break`,
          bundleLabel: `${hDate.toLocaleDateString("en-IN", { day: "numeric", month: "short" })} – ${sunDate.toLocaleDateString("en-IN", { day: "numeric", month: "short" })}`,
          description: `Get a 4-day stretch by bunking Friday! Includes: Thursday (${h.name}), Friday (Bridge Day), Saturday & Sunday.`,
          start: h.date,
          end: sunStr
        });
      }

      // Tuesday Holiday -> Bridge Monday
      if (day === 2) {
        const satDate = new Date(hDate);
        satDate.setDate(hDate.getDate() - 3); // Go back to Saturday
        const satStr = formatDateLocal(satDate);
        
        suggestions.push({
          type: "bridge",
          title: `${h.name} Extended Break`,
          bundleLabel: `${satDate.toLocaleDateString("en-IN", { day: "numeric", month: "short" })} – ${hDate.toLocaleDateString("en-IN", { day: "numeric", month: "short" })}`,
          description: `Get a 4-day stretch by bunking Monday! Includes: Saturday, Sunday, Monday (Bridge Day), and Tuesday (${h.name}).`,
          start: satStr,
          end: h.date
        });
      }

      // Friday Holiday -> 3-day long weekend
      if (day === 5) {
        const sunDate = new Date(hDate);
        sunDate.setDate(hDate.getDate() + 2);
        const sunStr = formatDateLocal(sunDate);
        
        suggestions.push({
          type: "weekend",
          title: `${h.name} Long Weekend`,
          bundleLabel: `${hDate.toLocaleDateString("en-IN", { day: "numeric", month: "short" })} – ${sunDate.toLocaleDateString("en-IN", { day: "numeric", month: "short" })}`,
          description: `3-day natural holiday block: Friday (${h.name}), Saturday, and Sunday.`,
          start: h.date,
          end: sunStr
        });
      }

      // Monday Holiday -> 3-day long weekend
      if (day === 1) {
        const satDate = new Date(hDate);
        satDate.setDate(hDate.getDate() - 2);
        const satStr = formatDateLocal(satDate);
        
        suggestions.push({
          type: "weekend",
          title: `${h.name} Long Weekend`,
          bundleLabel: `${satDate.toLocaleDateString("en-IN", { day: "numeric", month: "short" })} – ${hDate.toLocaleDateString("en-IN", { day: "numeric", month: "short" })}`,
          description: `3-day natural holiday block: Saturday, Sunday, and Monday (${h.name}).`,
          start: satStr,
          end: h.date
        });
      }
    });

    return suggestions.slice(0, 4); // Limit to top 4 recommendations
  }

  const recommendations = getBunkSuggestions();

  if (loading || !currentStats) {
    return (
      <div className="min-h-screen bg-[#131313] flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <AppShell>
      <div className="container mx-auto px-container-padding max-w-[1100px] space-y-8 animate-in fade-in duration-500 pb-20">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="flex items-center gap-4">
            <span className="material-symbols-outlined text-primary text-4xl">travel_explore</span>
            <div>
              <h1 className="font-headline-lg text-white">Bunk Planner</h1>
              <p className="text-on-surface-variant font-body-md">Simulate your holiday stretch before committing to the bunk.</p>
            </div>
          </div>
          
          {/* Holiday Upload Action */}
          <div className="flex items-center gap-3">
            <input 
              type="file" 
              ref={fileInputRef} 
              onChange={handleHolidayUpload} 
              accept=".pdf,image/png,image/jpeg,image/jpg" 
              className="hidden" 
            />
            {customHolidays.length > 0 && (
              <button 
                onClick={handleClearCustomHolidays}
                className="px-4 py-2 border border-error/20 bg-error/5 text-error rounded-xl font-bold hover:bg-error/10 active:scale-95 transition-all text-xs flex items-center gap-2"
              >
                <span className="material-symbols-outlined text-sm">clear</span>
                Clear Custom List
              </button>
            )}
            <button 
              disabled={uploadingHoliday}
              onClick={() => fileInputRef.current?.click()}
              className="px-4 py-2 bg-white/5 hover:bg-white/10 text-white border border-white/10 rounded-xl font-bold active:scale-95 transition-all text-xs flex items-center gap-2"
            >
              <span className="material-symbols-outlined text-sm">upload_file</span>
              {uploadingHoliday ? "AI Processing..." : "Upload Holiday PDF/Image"}
            </button>
          </div>
        </div>

        {uploadingHoliday && (
          <div className="glass-card border border-primary/30 bg-primary/5 rounded-2xl p-5 flex items-center gap-4 animate-pulse">
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin shrink-0" />
            <div>
              <p className="text-primary font-bold text-sm">BunkWise AI is reading your Holiday Schedule...</p>
              <p className="text-on-surface-variant text-xs mt-0.5">Extracting academic dates using Gemini Vision. Please hold on.</p>
            </div>
          </div>
        )}

        {/* Dashboard 2-column Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* LEFT: Inputs, Upload status, Recommendations */}
          <div className="lg:col-span-5 space-y-6">
            
            {/* Range selector */}
            <div className="glass-card rounded-[2rem] p-6 space-y-6">
              <h2 className="font-headline-md text-white">Select Dates</h2>
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="flex-1 space-y-2">
                  <label className="font-label-sm text-on-surface-variant uppercase ml-1">Start Date</label>
                  <input 
                    type="date" 
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full bg-surface-container border border-white/10 py-3 px-3 text-white focus:border-primary transition-all rounded-xl text-sm"
                  />
                </div>
                <div className="flex-1 space-y-2">
                  <label className="font-label-sm text-on-surface-variant uppercase ml-1">End Date</label>
                  <input 
                    type="date" 
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full bg-surface-container border border-white/10 py-3 px-3 text-white focus:border-primary transition-all rounded-xl text-sm"
                  />
                </div>
              </div>
              <div className="bg-primary/10 border border-primary/20 rounded-xl p-4 flex items-center gap-3">
                <span className="material-symbols-outlined text-primary text-xl">info</span>
                <span className="text-primary font-body-md text-sm">
                  You will miss <strong>{missedClasses.length} classes</strong> across {new Set(missedClasses.map(m => m.subject)).size} subjects.
                </span>
              </div>
            </div>

            {/* Smart Recommendations */}
            <div className="glass-card rounded-[2rem] p-6 space-y-4">
              <h2 className="font-headline-md text-white flex items-center gap-2">
                <span className="material-symbols-outlined text-primary">auto_awesome</span>
                Smart Suggestions
              </h2>
              {recommendations.length === 0 ? (
                <p className="text-on-surface-variant text-xs italic py-2">No upcoming holiday recommendations found.</p>
              ) : (
                <div className="space-y-3">
                  {recommendations.map((rec, i) => (
                    <div 
                      key={i} 
                      onClick={() => {
                        setStartDate(rec.start);
                        setEndDate(rec.end);
                      }}
                      className={`p-4 rounded-xl border text-left transition-all bg-primary/5 border-primary/20 hover:bg-primary/10 cursor-pointer active:scale-98`}
                    >
                      <div className="flex justify-between items-start gap-2">
                        <h4 className="text-white font-bold text-sm">{rec.title}</h4>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${
                          rec.type === "bridge" ? "bg-primary/20 text-primary border border-primary/30" : "bg-white/10 text-on-surface-variant border border-white/20"
                        }`}>
                          {rec.bundleLabel}
                        </span>
                      </div>
                      <p className="text-on-surface-variant text-xs mt-1 leading-relaxed">{rec.description}</p>
                      <span className="text-[10px] text-primary font-bold mt-2.5 inline-flex items-center gap-1">
                        Click to select dates <span className="material-symbols-outlined text-xs">arrow_forward</span>
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>

          {/* RIGHT: Calendarmonth grid */}
          <div className="lg:col-span-7">
            <div className="glass-card rounded-[2rem] p-6 flex flex-col h-full justify-between">
              
              <div>
                {/* Calendar Header */}
                <div className="flex justify-between items-center mb-6">
                  <h2 className="font-headline-md text-white">
                    {currentMonth.toLocaleDateString("en-IN", { month: "long", year: "numeric" })}
                  </h2>
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={prevMonth}
                      className="p-2 rounded-xl hover:bg-white/5 border border-white/10 text-white transition-colors"
                    >
                      <span className="material-symbols-outlined text-base">chevron_left</span>
                    </button>
                    <button 
                      onClick={nextMonth}
                      className="p-2 rounded-xl hover:bg-white/5 border border-white/10 text-white transition-colors"
                    >
                      <span className="material-symbols-outlined text-base">chevron_right</span>
                    </button>
                  </div>
                </div>

                {/* Weekday Names */}
                <div className="grid grid-cols-7 gap-1 text-center mb-2">
                  {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day, i) => (
                    <span key={i} className="text-on-surface-variant font-label-sm text-xs py-1">
                      {day}
                    </span>
                  ))}
                </div>

                {/* Calendar Grid */}
                <div className="grid grid-cols-7 gap-1">
                  {/* Empty Offset cells */}
                  {Array.from({ length: firstDay }).map((_, i) => (
                    <div key={`empty-${i}`} className="aspect-square bg-transparent" />
                  ))}

                  {/* Day cells */}
                  {Array.from({ length: daysInMonth }).map((_, i) => {
                    const dayNum = i + 1;
                    const dateObj = new Date(year, month, dayNum);
                    // Standard YYYY-MM-DD
                    const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(dayNum).padStart(2, "0")}`;
                    
                    const isHoliday = getHoliday(dateStr);
                    const hasClasses = hasClassesOnDayOfWeek(dateStr);
                    const selected = isSelected(dateStr);
                    
                    // Recommended bridge day: Friday or Monday adjacent to Tuesday/Thursday holidays
                    const dayOfWeek = dateObj.getDay();
                    let isRecommendedBridge = false;
                    if (hasClasses && !isHoliday) {
                      if (dayOfWeek === 5) { // Friday
                        const thuStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(dayNum - 1).padStart(2, "0")}`;
                        if (getHoliday(thuStr)) isRecommendedBridge = true;
                      } else if (dayOfWeek === 1) { // Monday
                        const tueStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(dayNum + 1).padStart(2, "0")}`;
                        if (getHoliday(tueStr)) isRecommendedBridge = true;
                      }
                    }

                    return (
                      <button
                        key={dayNum}
                        onClick={() => handleDateClick(dateStr)}
                        className={`aspect-square rounded-xl p-1 flex flex-col justify-between items-start transition-all relative border ${
                          selected
                            ? "bg-primary border-primary text-on-primary shadow-lg scale-95 z-10"
                            : isHoliday
                            ? "bg-secondary-fixed/15 border-secondary-fixed/30 text-secondary-fixed hover:bg-secondary-fixed/25"
                            : isRecommendedBridge
                            ? "bg-primary/10 border-primary/30 text-primary hover:bg-primary/20"
                            : hasClasses
                            ? "bg-white/5 border-white/5 text-white hover:bg-white/10"
                            : "bg-transparent border-transparent text-on-surface-variant/40 hover:bg-white/5"
                        }`}
                      >
                        <span className="text-xs font-bold leading-none">{dayNum}</span>
                        
                        {/* Indicators (Holiday name / Classes indicator) */}
                        <div className="w-full flex items-center justify-between mt-auto">
                          {isHoliday && (
                            <span 
                              className={`text-[8px] truncate max-w-[85%] font-medium ${selected ? 'text-on-primary' : 'text-secondary-fixed'}`}
                              title={isHoliday.name}
                            >
                              {isHoliday.name}
                            </span>
                          )}
                          {!isHoliday && hasClasses && (
                            <div className={`w-1.5 h-1.5 rounded-full mx-auto ${selected ? 'bg-on-primary' : 'bg-primary'}`} />
                          )}
                        </div>

                        {/* Tooltip hint for bridge days */}
                        {!selected && isRecommendedBridge && (
                          <div className="absolute top-1 right-1 w-2 h-2 rounded-full bg-primary animate-ping" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Legend */}
              <div className="border-t border-white/5 pt-6 mt-8 flex flex-wrap gap-4 text-xs justify-center lg:justify-start">
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded-md bg-white/5 border border-white/5 flex items-center justify-center">
                    <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                  </div>
                  <span className="text-on-surface-variant">Class Days</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded-md bg-secondary-fixed/15 border border-secondary-fixed/30" />
                  <span className="text-on-surface-variant">Holidays</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded-md bg-primary/10 border border-primary/30 relative flex items-center justify-center">
                    <div className="w-2 h-2 rounded-full bg-primary" />
                  </div>
                  <span className="text-on-surface-variant">Suggested Bunks</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded-md bg-primary" />
                  <span className="text-on-surface-variant">Your Active Selection</span>
                </div>
              </div>

            </div>
          </div>

        </div>

        {/* Impact Analysis Panel */}
        {projectedStats && missedClasses.length > 0 && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <h2 className="font-headline-md text-white">Impact Analysis</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {Object.keys(projectedStats).filter(s => projectedStats[s].total > currentStats[s].total).map((subject) => {
                const curP = currentStats[subject].total > 0 ? (currentStats[subject].present / currentStats[subject].total) * 100 : 100;
                const projP = projectedStats[subject].total > 0 ? (projectedStats[subject].present / projectedStats[subject].total) * 100 : 100;
                const drop = curP - projP;
                const isDanger = projP < 75;

                return (
                  <div key={subject} className={`glass-card rounded-[1.5rem] p-6 border ${isDanger ? 'border-error/50 neon-glow-red-sm' : 'border-white/5'}`}>
                    <h3 className="font-label-lg text-white mb-4 line-clamp-1">{subject}</h3>
                    <div className="flex justify-between items-end">
                      <div className="space-y-1">
                        <span className="text-on-surface-variant font-label-sm block text-[10px]">CURRENT</span>
                        <span className="text-white font-headline-md text-2xl">{curP.toFixed(0)}%</span>
                      </div>
                      <div className="flex flex-col items-center pb-1">
                        <span className="material-symbols-outlined text-on-surface-variant/40 text-base">arrow_forward</span>
                        <span className="text-error font-label-sm font-bold text-xs">-{drop.toFixed(1)}%</span>
                      </div>
                      <div className="space-y-1 text-right">
                        <span className={`font-label-sm block text-[10px] ${isDanger ? 'text-error' : 'text-primary'}`}>PROJECTED</span>
                        <span className={`font-headline-md text-2xl ${isDanger ? 'text-error' : 'text-primary'}`}>{projP.toFixed(0)}%</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <button 
              onClick={handleSavePlan}
              disabled={saving}
              className="w-full primary-gradient text-on-primary py-4 rounded-2xl font-bold active:scale-95 transition-transform hover-glow-purple disabled:opacity-50 mt-8 shadow-xl text-lg flex justify-center items-center gap-2"
            >
              <span className="material-symbols-outlined">event_available</span>
              {saving ? "Saving Plan..." : "Commit to the Bunk"}
            </button>
          </div>
        )}

      </div>
    </AppShell>
  );
}
