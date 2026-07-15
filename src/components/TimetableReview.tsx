"use client";

import { useState } from "react";
import { ParsedTimetable } from "@/types/timetable";

interface Props {
  data: ParsedTimetable;
  onConfirm: (finalData: ParsedTimetable) => void;
  onCancel: () => void;
}

export default function TimetableReview({ data, onConfirm, onCancel }: Props) {
  const [editedData, setEditedData] = useState<ParsedTimetable>(data);
  const [step, setStep] = useState<"subjects" | "schedule">("subjects");
  const [newSubjectName, setNewSubjectName] = useState("");

  const TimePicker = ({ value, onChange, isOverlapping }: { value: string, onChange: (val: string) => void, isOverlapping: boolean }) => {
    const [h24, m24] = value.split(":").map(Number);
    const hour12 = h24 === 0 ? 12 : h24 > 12 ? h24 - 12 : h24;
    const period = h24 >= 12 ? "PM" : "AM";
    const minutes = Math.floor(m24 / 5) * 5;

    const handleUpdate = (h: number, m: number, p: string) => {
      let finalH = h;
      if (p === "PM" && h < 12) finalH += 12;
      if (p === "AM" && h === 12) finalH = 0;
      onChange(`${String(finalH).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
    };

    return (
      <div className={`flex items-center gap-1 font-label-md text-xs ${isOverlapping ? "text-error" : "text-white"}`}>
        <select 
          value={hour12}
          onChange={(e) => handleUpdate(parseInt(e.target.value), minutes, period)}
          className="bg-transparent border-none p-0 focus:ring-0 cursor-pointer appearance-none text-center"
        >
          {Array.from({length: 12}, (_, i) => i + 1).map(h => (
            <option key={h} value={h} className="bg-background">{String(h).padStart(2, "0")}</option>
          ))}
        </select>
        <span>:</span>
        <select 
          value={minutes}
          onChange={(e) => handleUpdate(hour12, parseInt(e.target.value), period)}
          className="bg-transparent border-none p-0 focus:ring-0 cursor-pointer appearance-none text-center"
        >
          {Array.from({length: 12}, (_, i) => i * 5).map(m => (
            <option key={m} value={m} className="bg-background">{String(m).padStart(2, "0")}</option>
          ))}
        </select>
        <select 
          value={period}
          onChange={(e) => handleUpdate(hour12, minutes, e.target.value)}
          className="bg-transparent border-none p-0 focus:ring-0 cursor-pointer appearance-none ml-1 text-primary font-bold"
        >
          <option value="AM" className="bg-background text-white">AM</option>
          <option value="PM" className="bg-background text-white">PM</option>
        </select>
      </div>
    );
  };

  const removeSubject = (subjectName: string) => {
    const newSubjects = editedData.subjects.filter(s => s !== subjectName);
    const newSchedule = editedData.schedule.map(day => ({
      ...day,
      classes: day.classes.filter(c => c.subject !== subjectName)
    }));
    setEditedData({ ...editedData, subjects: newSubjects, schedule: newSchedule });
  };

  const addManualSubject = () => {
    const cleanName = newSubjectName.trim();
    if (!cleanName || editedData.subjects.includes(cleanName)) return;
    setEditedData({ ...editedData, subjects: [...editedData.subjects, cleanName] });
    setNewSubjectName("");
  };

  const updateSubjectName = (oldName: string, newName: string) => {
    const newSubjects = editedData.subjects.map(s => s === oldName ? newName : s);
    const newSchedule = editedData.schedule.map(day => ({
      ...day,
      classes: day.classes.map(c => c.subject === oldName ? { ...c, subject: newName } : c)
    }));
    setEditedData({ ...editedData, subjects: newSubjects, schedule: newSchedule });
  };

  const removeClass = (dayIndex: number, classIndex: number) => {
    const newSchedule = [...editedData.schedule];
    const newClasses = [...newSchedule[dayIndex].classes];
    newClasses.splice(classIndex, 1);
    newSchedule[dayIndex] = { ...newSchedule[dayIndex], classes: newClasses };
    setEditedData({ ...editedData, schedule: newSchedule });
  };

  const addClass = (dayIndex: number) => {
    const newSchedule = [...editedData.schedule];
    newSchedule[dayIndex] = { 
      ...newSchedule[dayIndex], 
      classes: [...newSchedule[dayIndex].classes, {
        subject: editedData.subjects[0] || "Subject",
        startTime: "09:00",
        endTime: "10:00"
      }]
    };
    setEditedData({ ...editedData, schedule: newSchedule });
  };

  const updateClass = (dayIndex: number, classIndex: number, field: string, value: string) => {
    const newSchedule = [...editedData.schedule];
    const rawClasses = [...newSchedule[dayIndex].classes];
    rawClasses[classIndex] = { ...rawClasses[classIndex], [field]: value };
    newSchedule[dayIndex] = { ...newSchedule[dayIndex], classes: rawClasses };
    setEditedData({ ...editedData, schedule: newSchedule });
  };

  const hasOverlap = (dayIndex: number, classIndex: number) => {
    const day = editedData.schedule[dayIndex];
    const current = day.classes[classIndex];
    return day.classes.some((other, idx) => {
      if (idx === classIndex) return false;
      const t1s = parseInt(current.startTime.replace(":", ""));
      const t1e = parseInt(current.endTime.replace(":", ""));
      const t2s = parseInt(other.startTime.replace(":", ""));
      const t2e = parseInt(other.endTime.replace(":", ""));
      return Math.max(t1s, t2s) < Math.min(t1e, t2e);
    });
  };

  const globalHasErrors = editedData.schedule.some((day, dIdx) => 
    day.classes.some((_, cIdx) => hasOverlap(dIdx, cIdx))
  );

  return (
    <div className="bg-[#131313] min-h-screen text-[#e5e2e1] font-body-md animate-in fade-in duration-500">
      {/* Header */}
      <header className="p-gutter flex justify-between items-center border-b border-white/10 glass-nav sticky top-0 z-50">
        <div>
          <h2 className="font-headline-md text-primary" style={{ fontFamily: 'Space Grotesk' }}>
            {step === "subjects" ? "Review Subjects" : "Review Schedule"}
          </h2>
          <div className="flex gap-2 mt-2">
            <div className={`h-1 rounded-full transition-all duration-300 ${step === "subjects" ? "w-8 bg-primary" : "w-4 bg-white/10"}`}></div>
            <div className={`h-1 rounded-full transition-all duration-300 ${step === "schedule" ? "w-8 bg-primary" : "w-4 bg-white/10"}`}></div>
          </div>
        </div>
        <button onClick={onCancel} className="p-2 text-on-surface-variant hover:bg-white/5 rounded-full">
          <span className="material-symbols-outlined">close</span>
        </button>
      </header>

      <main className="p-container-padding pb-32 max-w-4xl mx-auto space-y-stack-md">
        {step === "subjects" ? (
          <>
            <div className="glass-card p-4 rounded-xl border-l-4 border-tertiary">
              <p className="text-sm font-medium text-white">We found {editedData.subjects.length} subjects. Tap a name to edit or remove.</p>
            </div>
            
            <div className="space-y-3">
              {editedData.subjects.map((sub, idx) => (
                <div key={idx} className="glass-card p-4 rounded-xl flex items-center justify-between group hover:border-primary/40 transition-all">
                  <input 
                    className="font-headline-md text-white bg-transparent border-none p-0 focus:ring-0 w-full"
                    style={{ fontFamily: 'Space Grotesk', fontSize: '20px' }}
                    value={sub}
                    onChange={(e) => updateSubjectName(sub, e.target.value)}
                  />
                  <button onClick={() => removeSubject(sub)} className="p-2 text-on-surface-variant hover:text-error transition-colors">
                    <span className="material-symbols-outlined">delete</span>
                  </button>
                </div>
              ))}
              
              <div className="relative mt-stack-md">
                <input 
                  type="text"
                  placeholder="Manually add subject..."
                  value={newSubjectName}
                  onChange={(e) => setNewSubjectName(e.target.value)}
                  className="w-full bg-surface-container-low border-b border-white/10 py-4 px-4 text-white focus:border-primary transition-all rounded-xl"
                />
                <button 
                  onClick={addManualSubject}
                  className="absolute right-2 top-2 bottom-2 primary-gradient text-on-primary px-6 rounded-lg text-xs font-bold"
                >
                  ADD
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="space-y-stack-md">
            <div className="glass-card p-4 rounded-xl border-l-4 border-secondary-fixed">
              <p className="text-sm font-medium text-white">
                {globalHasErrors ? <span className="text-error font-bold">⚠️ Warning: Overlapping classes!</span> : "Verify timings for your classes."}
              </p>
            </div>

            {editedData.schedule.map((day, dIdx) => (
              <div key={dIdx} className="space-y-3">
                <div className="flex justify-between items-center px-2">
                  <h3 className="font-label-md text-on-surface-variant uppercase tracking-widest">{day.day}</h3>
                  <button onClick={() => addClass(dIdx)} className="text-[10px] font-bold text-primary bg-primary/10 px-3 py-1 rounded-full uppercase">+ Add Class</button>
                </div>
                
                {day.classes.map((cls, cIdx) => (
                  <div key={cIdx} className={`glass-card p-4 rounded-xl flex justify-between items-center transition-all border-l-4 ${hasOverlap(dIdx, cIdx) ? "border-l-error" : "border-l-primary"}`}>
                    <div className="space-y-3 flex-1">
                      <select 
                        className="font-headline-md text-white bg-transparent border-none p-0 focus:ring-0 w-full appearance-none cursor-pointer"
                        style={{ fontFamily: 'Space Grotesk', fontSize: '18px' }}
                        value={cls.subject} 
                        onChange={(e) => updateClass(dIdx, cIdx, "subject", e.target.value)}
                      >
                        {editedData.subjects.map(s => <option key={s} value={s} className="bg-background">{s}</option>)}
                      </select>
                      
                      <div className="flex items-center gap-4 bg-white/5 w-fit px-4 py-2 rounded-xl border border-white/10">
                        <TimePicker value={cls.startTime} onChange={(val) => updateClass(dIdx, cIdx, "startTime", val)} isOverlapping={hasOverlap(dIdx, cIdx)} />
                        <div className="h-4 w-px bg-white/10"></div>
                        <TimePicker value={cls.endTime} onChange={(val) => updateClass(dIdx, cIdx, "endTime", val)} isOverlapping={hasOverlap(dIdx, cIdx)} />
                      </div>
                    </div>
                    <button onClick={() => removeClass(dIdx, cIdx)} className="p-3 text-on-surface-variant hover:text-error">
                      <span className="material-symbols-outlined">close</span>
                    </button>
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Footer CTA */}
      <footer className="fixed bottom-0 left-0 w-full p-4 glass-nav border-t border-white/10 z-50">
        <div className="max-w-md mx-auto grid grid-cols-2 gap-4">
          <button 
            onClick={() => step === "schedule" ? setStep("subjects") : onCancel()}
            className="py-4 rounded-xl border border-white/10 text-white font-bold hover:bg-white/5 transition-all"
          >
            Back
          </button>
          <button 
            onClick={() => step === "subjects" ? setStep("schedule") : onConfirm(editedData)}
            disabled={step === "schedule" && globalHasErrors}
            className={`py-4 rounded-xl font-bold transition-all shadow-lg ${step === "schedule" && globalHasErrors ? "bg-white/10 text-on-surface-variant/40" : "primary-gradient text-on-primary"}`}
          >
            {step === "subjects" ? "Next Step" : (globalHasErrors ? "Fix Overlaps" : "Finish Setup")}
          </button>
        </div>
      </footer>
    </div>
  );
}
