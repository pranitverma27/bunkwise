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

export default function TimetablePage() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTimetable, setActiveTimetable] = useState<any>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  
  const router = useRouter();

  useEffect(() => {
    async function checkUser() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          router.push("/auth");
        } else {
          setUser(session.user);
          await fetchTimetable(session.user.id);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    checkUser();
  }, [router]);

  async function fetchTimetable(userId: string) {
    const { data, error } = await supabase
      .from("timetables")
      .select("*")
      .eq("user_id", userId)
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error(error);
      return;
    }
    
    if (!data) {
      router.push("/onboarding");
      return;
    }

    setActiveTimetable(data);
  }

  async function handleUpdateTimetable(finalData: any) {
    if (!user || !activeTimetable) return;
    setActionLoading(true);
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
      setIsEditing(false);
    } catch (err: any) {
      alert("Failed to update timetable: " + err.message);
    } finally {
      setActionLoading(false);
    }
  }

  if (loading || (!activeTimetable && !isEditing)) {
    return (
      <div className="min-h-screen bg-[#131313] flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (isEditing) {
    return (
      <div className="min-h-screen bg-[#131313]">
        <TimetableReview
          data={activeTimetable.raw_data}
          onConfirm={handleUpdateTimetable}
          onCancel={() => setIsEditing(false)}
        />
      </div>
    );
  }

  return (
    <AppShell>
      <div className="container mx-auto px-container-padding max-w-[800px] space-y-stack-lg animate-in fade-in duration-500">
        
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
          <div className="flex items-center gap-4">
            <span className="material-symbols-outlined text-primary text-4xl">calendar_today</span>
            <div>
              <h1 className="font-headline-lg text-white">My Timetable</h1>
              <p className="text-on-surface-variant font-body-md">View or modify your approved schedule slots.</p>
            </div>
          </div>
          
          <button
            onClick={() => setIsEditing(true)}
            className="w-full sm:w-auto px-6 py-3.5 primary-gradient text-on-primary font-bold rounded-xl hover-glow-purple active:scale-95 transition-all shadow-lg flex items-center justify-center gap-2 text-sm"
          >
            <span className="material-symbols-outlined text-base">edit</span>
            Correct Timetable
          </button>
        </div>

        <div className="space-y-6">
          {activeTimetable.raw_data?.schedule?.map((day: any, idx: number) => (
            <div key={idx} className="glass-card rounded-[2rem] p-6 space-y-4 border border-white/5">
              <h3 className="font-headline-md text-secondary-fixed text-lg uppercase tracking-wider pl-1">{day.day}</h3>
              
              {day.classes?.length === 0 ? (
                <p className="text-on-surface-variant/40 text-sm italic pl-1 py-2">No classes scheduled</p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {[...(day.classes || [])]
                    .sort((a: any, b: any) => a.startTime.localeCompare(b.startTime))
                    .map((c: any, cIdx: number) => {
                      const isLab = getIsLab(c.startTime, c.endTime);
                      return (
                        <div key={cIdx} className="bg-white/5 rounded-2xl p-5 border border-white/5 flex flex-col justify-between gap-3 group hover:border-white/10 transition-all">
                          <div className="min-w-0">
                            <p className="text-white text-base font-semibold truncate leading-snug">{c.subject}</p>
                            <span className={`inline-block px-2.5 py-1 rounded-md text-[10px] uppercase font-bold tracking-wider mt-2 ${
                              isLab ? 'bg-primary/20 text-primary' : 'bg-secondary-fixed/20 text-secondary-fixed'
                            }`}>
                              {isLab ? "🧪 Lab Session" : "📚 Lecture"}
                            </span>
                          </div>
                          <div className="text-on-surface-variant text-xs flex items-center gap-1.5 mt-2 pt-2 border-t border-white/5">
                            <span className="material-symbols-outlined text-sm">schedule</span>
                            {c.startTime} - {c.endTime}
                          </div>
                        </div>
                      );
                    })}
                </div>
              )}
            </div>
          ))}
        </div>
        
      </div>
    </AppShell>
  );
}
