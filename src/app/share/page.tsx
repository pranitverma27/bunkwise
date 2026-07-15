"use client";

import { useEffect, useState, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/Navigation";
import { toBlob } from "html-to-image";

const getIsLab = (startTime: string, endTime: string) => {
  if (!startTime || !endTime) return false;
  const [startH, startM] = startTime.split(":").map(Number);
  const [endH, endM] = endTime.split(":").map(Number);
  const diffMinutes = (endH * 60 + endM) - (startH * 60 + startM);
  return diffMinutes >= 90;
};

// ── Marvel Characters ─────────────────────────────────────────────────────────
const CHARACTERS = [
  {
    id: "ironman",
    name: "Iron Man",
    emoji: "🦾",
    minPct: 95,
    label: "95–100% — The Genius",
    quote: "I am Iron Man. And I never miss a deadline.",
    trait: "GENIUS · BILLIONAIRE · NEVER ABSENT",
    bg: "linear-gradient(160deg, #1a0000 0%, #7B1010 40%, #B22222 70%, #8B0000 100%)",
    accentGradient: "linear-gradient(90deg, #FFD700, #FFA500)",
    accent: "#FFD700",
    textMain: "#FFFFFF",
    textSub: "rgba(255,255,255,0.55)",
    cardBg: "rgba(0,0,0,0.4)",
    cardBorder: "rgba(255,215,0,0.35)",
    pattern: "arc",       // arc reactor rings
    headerColor: "#FFD700",
  },
  {
    id: "captainamerica",
    name: "Captain America",
    emoji: "🛡️",
    minPct: 90,
    label: "90–94.9% — The Soldier",
    quote: "I can do this all day.",
    trait: "SUPER SOLDIER · ALWAYS SHOWS UP",
    bg: "linear-gradient(160deg, #001a3a 0%, #003087 45%, #003580 70%, #BD3039 100%)",
    accentGradient: "linear-gradient(90deg, #C0C0C0, #E8E8E8)",
    accent: "#C0C0C0",
    textMain: "#FFFFFF",
    textSub: "rgba(255,255,255,0.55)",
    cardBg: "rgba(0,0,0,0.35)",
    cardBorder: "rgba(192,192,192,0.3)",
    pattern: "stars",     // star pattern
    headerColor: "#C0C0C0",
  },
  {
    id: "spiderman",
    name: "Spider-Man",
    emoji: "🕷️",
    minPct: 80,
    label: "80–89.9% — The Friendly Student",
    quote: "With great attendance comes great responsibility.",
    trait: "FRIENDLY NEIGHBOURHOOD STUDENT",
    bg: "linear-gradient(160deg, #1a0000 0%, #8B0000 30%, #E23636 60%, #003A6B 100%)",
    accentGradient: "linear-gradient(90deg, #E23636, #FF6B6B)",
    accent: "#FF6B6B",
    textMain: "#FFFFFF",
    textSub: "rgba(255,255,255,0.55)",
    cardBg: "rgba(0,0,0,0.4)",
    cardBorder: "rgba(226,54,54,0.35)",
    pattern: "web",       // web lines
    headerColor: "#FF6B6B",
  },
  {
    id: "thor",
    name: "Thor",
    emoji: "⚡",
    minPct: 70,
    label: "70–79.9% — The Asgardian",
    quote: "I'm still worthy. Probably.",
    trait: "GOD OF THUNDER · SOMETIMES IN ASGARD",
    bg: "linear-gradient(160deg, #0a0a1a 0%, #1a1a4a 40%, #2a2a8a 65%, #4a3a00 100%)",
    accentGradient: "linear-gradient(90deg, #FFD700, #FFF176)",
    accent: "#FFD700",
    textMain: "#FFFFFF",
    textSub: "rgba(255,255,255,0.55)",
    cardBg: "rgba(0,0,0,0.4)",
    cardBorder: "rgba(255,215,0,0.3)",
    pattern: "lightning", // bolt overlay
    headerColor: "#FFF176",
  },
  {
    id: "blackpanther",
    name: "Black Panther",
    emoji: "🐾",
    minPct: 60,
    label: "60–69.9% — The King",
    quote: "Wakanda Forever. Classes: negotiable.",
    trait: "KING OF WAKANDA · SELECTIVE PRESENCE",
    bg: "linear-gradient(160deg, #050010 0%, #1a0033 40%, #2d0052 65%, #4B0082 100%)",
    accentGradient: "linear-gradient(90deg, #9B59B6, #6C3483)",
    accent: "#C39BD3",
    textMain: "#FFFFFF",
    textSub: "rgba(255,255,255,0.5)",
    cardBg: "rgba(0,0,0,0.45)",
    cardBorder: "rgba(195,155,211,0.3)",
    pattern: "tribal",    // geometric pattern
    headerColor: "#C39BD3",
  },
  {
    id: "loki",
    name: "Loki",
    emoji: "🐍",
    minPct: 0,
    label: "<60% — The Trickster",
    quote: "I am burdened with glorious purpose... just not lectures.",
    trait: "GOD OF MISCHIEF · ATTENDANCE: A LIE",
    bg: "linear-gradient(160deg, #000a00 0%, #001a00 30%, #003300 55%, #1a1a00 100%)",
    accentGradient: "linear-gradient(90deg, #27AE60, #A9DFBF)",
    accent: "#27AE60",
    textMain: "#FFFFFF",
    textSub: "rgba(255,255,255,0.5)",
    cardBg: "rgba(0,0,0,0.45)",
    cardBorder: "rgba(39,174,96,0.3)",
    pattern: "mist",      // subtle green mist
    headerColor: "#A9DFBF",
  },
] as const;

type CharId = typeof CHARACTERS[number]["id"];

function assignCharacter(pct: number) {
  for (const c of CHARACTERS) {
    if (pct >= c.minPct) return c;
  }
  return CHARACTERS[CHARACTERS.length - 1];
}

// ── Pattern SVGs ─────────────────────────────────────────────────────────────
function PatternOverlay({ pattern }: { pattern: string }) {
  if (pattern === "arc") return (
    <div className="absolute inset-0 flex items-center justify-end pr-8 opacity-10 pointer-events-none">
      {[120, 95, 70, 45].map((s, i) => (
        <div key={i} className="absolute rounded-full border-2 border-yellow-400" style={{ width: s, height: s }} />
      ))}
    </div>
  );
  if (pattern === "stars") return (
    <div className="absolute inset-0 opacity-[0.07] pointer-events-none" style={{
      backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='40' height='40'%3E%3Ctext y='20' font-size='16'%3E★%3C/text%3E%3C/svg%3E\")",
    }} />
  );
  if (pattern === "web") return (
    <svg className="absolute inset-0 w-full h-full opacity-[0.07] pointer-events-none" xmlns="http://www.w3.org/2000/svg">
      {[0,1,2,3,4,5,6,7].map(i => (
        <line key={i} x1="100%" y1="0%" x2="0%" y2="100%"
          stroke="white" strokeWidth="0.5"
          transform={`rotate(${i * 22.5} 50% 50%)`}
          style={{ transformOrigin: "50% 50%" }}
        />
      ))}
      {[40,80,120,160,200,240].map((r, i) => (
        <circle key={i} cx="100%" cy="0%" r={r} fill="none" stroke="white" strokeWidth="0.5" />
      ))}
    </svg>
  );
  if (pattern === "lightning") return (
    <div className="absolute top-4 right-4 opacity-[0.08] pointer-events-none select-none" style={{ fontSize: 180, lineHeight: 1 }}>⚡</div>
  );
  if (pattern === "tribal") return (
    <div className="absolute inset-0 opacity-[0.06] pointer-events-none" style={{
      backgroundImage: "repeating-linear-gradient(45deg, #9B59B6 0px, #9B59B6 1px, transparent 1px, transparent 12px), repeating-linear-gradient(-45deg, #9B59B6 0px, #9B59B6 1px, transparent 1px, transparent 12px)",
    }} />
  );
  if (pattern === "mist") return (
    <div className="absolute inset-0 opacity-[0.08] pointer-events-none" style={{
      backgroundImage: "radial-gradient(ellipse at 80% 20%, #27AE60 0%, transparent 60%), radial-gradient(ellipse at 20% 80%, #145A32 0%, transparent 50%)",
    }} />
  );
  return null;
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function SharePage() {
  const [loading, setLoading] = useState(true);
  const [overallStats, setOverallStats] = useState({ present: 0, total: 0 });
  const [mostBunked, setMostBunked] = useState<string | null>(null);
  const [assignedChar, setAssignedChar] = useState<CharId>("ironman");
  const [displayName, setDisplayName] = useState("");
  const [generating, setGenerating] = useState(false);
  const [copied, setCopied] = useState(false);

  const cardRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    async function init() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) { router.push("/auth"); return; }
        const [ttRes, logsRes, profileRes] = await Promise.all([
          supabase.from("timetables").select("*").eq("user_id", session.user.id).eq("is_active", true).order("created_at", { ascending: false }).limit(1).maybeSingle(),
          supabase.from("attendance_logs").select("*").eq("user_id", session.user.id),
          supabase.from("profiles").select("full_name").eq("id", session.user.id).maybeSingle(),
        ]);
        if (!ttRes.data) { router.push("/onboarding"); return; }
        if (profileRes.data?.full_name) setDisplayName(profileRes.data.full_name);
        calculateStats(ttRes.data, logsRes.data || []);
      } catch (err) { console.error(err); }
      finally { setLoading(false); }
    }
    init();
  }, [router]);

  function calculateStats(timetable: any, logs: any[]) {
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
          total: lecAttended + lecBunked
        },
        lab: {
          present: labAttended,
          absent: labBunked,
          total: labAttended + labBunked
        }
      };
    });

    const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

    for (let d = new Date(semesterStart); d <= today; d.setDate(d.getDate() + 1)) {
      const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      const dayClasses = schedule.find((s: any) => s.day === days[d.getDay()])?.classes || [];
      
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

    let totalP = 0, totalT = 0, maxB = -1, worst: string | null = null;
    
    Object.entries(subjectStats).forEach(([name, s]: any) => {
      // Lectures
      totalP += s.lecture.present;
      totalT += s.lecture.total;
      if (s.lecture.absent > maxB) {
        maxB = s.lecture.absent;
        worst = name;
      }
      
      // Labs
      if (s.lab.total > 0) {
        totalP += s.lab.present;
        totalT += s.lab.total;
        if (s.lab.absent > maxB) {
          maxB = s.lab.absent;
          worst = name;
        }
      }
    });

    setOverallStats({ present: totalP, total: totalT });
    setMostBunked(worst);
    
    const pct = totalT > 0 ? (totalP / totalT) * 100 : 100;
    const auto = assignCharacter(pct);
    setAssignedChar(auto.id as CharId);
  }

  const [shareStatus, setShareStatus] = useState<string>("");

  async function uploadToPublicServer(blob: Blob, filename: string): Promise<string> {
    const formData = new FormData();
    formData.append("file", blob, filename);

    const res = await fetch("/api/share-upload", {
      method: "POST",
      body: formData
    });

    const json = await res.json();
    if (!res.ok) {
      throw new Error(json.error || "Anonymous proxy upload failed");
    }
    if (json.status !== "success" || !json.data?.url) {
      throw new Error("Invalid response from proxy upload server");
    }

    return json.data.url;
  }

  async function handleShare() {
    if (!cardRef.current) return;
    setGenerating(true);
    setShareStatus("Generating card image...");
    try {
      const char = CHARACTERS.find(c => c.id === assignedChar)!;
      const blob = await toBlob(cardRef.current, {
        cacheBust: true,
        pixelRatio: 3
      });
      if (!blob) throw new Error("Failed to capture card element");

      setShareStatus("Uploading to temporary server...");
      let publicImageUrl = "";
      try {
        publicImageUrl = await uploadToPublicServer(blob, `bunkwise-${char.name.replace(" ","")}.png`);
      } catch (uploadErr) {
        console.warn("Silent upload failed, falling back to download", uploadErr);
      }

      // Extract the path suffix from publicImageUrl (e.g., "https://tmpfiles.org/12345/img.png" -> "12345/img.png")
      const imgPath = publicImageUrl.includes("tmpfiles.org/")
        ? publicImageUrl.split("tmpfiles.org/")[1]
        : "";

      const shareLink = imgPath 
        ? `${window.location.origin}/share/card?img=${encodeURIComponent(imgPath)}`
        : window.location.origin;

      const shareTextWithImage = `My BunkWise Stats: I'm in ${char.name} mode! "${char.quote}" 🎓 Calculate your attendance risk and plan your bunks on BunkWise: ${shareLink}`;

      // Auto-copy caption text to clipboard
      try {
        await navigator.clipboard.writeText(shareTextWithImage);
        setCopied(true);
        setTimeout(() => setCopied(false), 4000);
      } catch (clipErr) {
        console.warn("Clipboard write failed", clipErr);
      }

      // If upload succeeded, redirect to WhatsApp directly with the prefilled message
      if (publicImageUrl) {
        setShareStatus("Opening WhatsApp...");
        const whatsappUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(shareTextWithImage)}`;
        window.location.href = whatsappUrl;
      } else {
        // Fallback: Download file if upload failed
        const file = new File([blob], `bunkwise-${char.name.replace(" ","")}.png`, { type: "image/png" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a"); a.href = url; a.download = file.name; a.click();
        URL.revokeObjectURL(url);
      }
    } catch (err: any) { 
      console.error(err); 
      alert("Failed to generate image: " + (err.message || String(err))); 
    }
    finally { 
      setGenerating(false); 
      setShareStatus("");
    }
  }

  if (loading) return (
    <div className="min-h-screen bg-[#131313] flex items-center justify-center">
      <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  );

  const pct = overallStats.total > 0 ? (overallStats.present / overallStats.total) * 100 : 100;
  const char = CHARACTERS.find(c => c.id === assignedChar)!;

  return (
    <AppShell>
      <div className="container mx-auto px-container-padding max-w-[500px] flex flex-col items-center animate-in fade-in duration-500 pb-20">

        <h1 className="font-headline-lg text-white mb-1 self-start">Personality Card</h1>
        <p className="text-on-surface-variant font-body-md mb-6 self-start">
          Based on your attendance, you are: <span className="font-bold" style={{ color: char.headerColor }}>
            {char.name}
          </span>
        </p>


        {/* Card */}
        <div
          ref={cardRef}
          className="w-full aspect-[3/4] relative rounded-[2rem] overflow-hidden flex flex-col justify-between p-8 shadow-2xl mb-8 transition-all duration-700"
          style={{ background: char.bg }}
        >
          <PatternOverlay pattern={char.pattern} />

          {/* Header */}
          <div className="relative z-10 flex justify-between items-start">
            <div>
              <span className="font-label-sm uppercase tracking-[0.25em] text-xs" style={{ color: char.textSub }}>BUNKWISE × MARVEL</span>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-3xl select-none">{char.emoji}</span>
                <span className="font-black text-2xl tracking-tight" style={{
                  color: char.headerColor,
                  fontFamily: "'Impact', 'Arial Black', sans-serif",
                  textShadow: `0 0 20px ${char.headerColor}60`,
                }}>
                  {char.name.toUpperCase()}
                </span>
              </div>
              {displayName && (
                <span className="block text-xs mt-1.5 tracking-widest uppercase" style={{ color: char.textSub }}>
                  {displayName}
                </span>
              )}
            </div>
          </div>

          {/* Body */}
          <div className="relative z-10 space-y-5">

            {/* Quote */}
            <div className="rounded-2xl px-5 py-4" style={{ background: char.cardBg, border: `1px solid ${char.cardBorder}` }}>
              <p className="italic text-sm leading-relaxed" style={{ color: char.textMain }}>
                "{char.quote}"
              </p>
            </div>

            {/* Attendance Bar */}
            <div className="rounded-2xl p-5" style={{ background: char.cardBg, border: `1px solid ${char.cardBorder}` }}>
              <div className="flex justify-between items-end mb-3">
                <span className="font-label-sm uppercase tracking-wider text-xs" style={{ color: char.textSub }}>Attendance</span>
                <span className="font-black text-4xl leading-none" style={{ color: char.accent }}>
                  {pct.toFixed(1)}%
                </span>
              </div>
              <div className="h-3 w-full rounded-full overflow-hidden" style={{ background: "rgba(128,128,128,0.2)" }}>
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${Math.min(pct, 100)}%`,
                    background: char.accentGradient,
                    boxShadow: `0 0 12px ${char.accent}80`,
                  }}
                />
              </div>
              <div className="flex justify-between mt-2.5">
                <span className="text-xs font-mono" style={{ color: char.textSub }}>{overallStats.present} attended</span>
                <span className="text-xs font-mono" style={{ color: char.textSub }}>{overallStats.total - overallStats.present} bunked</span>
              </div>
            </div>

            {/* Trait + Most Bunked */}
            <div className="flex justify-between items-end">
              <div>
                <p className="text-[10px] uppercase tracking-widest mb-1" style={{ color: char.textSub }}>Power Level</p>
                <p className="font-bold text-sm" style={{ color: char.headerColor }}>{char.trait}</p>
              </div>
              {mostBunked && (
                <div className="text-right max-w-[45%]">
                  <p className="text-[10px] uppercase tracking-widest mb-1" style={{ color: char.textSub }}>Nemesis</p>
                  <p className="font-bold text-sm line-clamp-2" style={{ color: char.textMain }}>{mostBunked}</p>
                </div>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="relative z-10 text-center" style={{ opacity: 0.3 }}>
            <p className="font-label-sm text-[10px] uppercase tracking-widest" style={{ color: char.textMain }}>
              Generated by BunkWise.app
            </p>
          </div>
        </div>

        {/* Range hint */}
        <p className="text-on-surface-variant font-label-sm text-xs mb-4 text-center opacity-60">{char.label}</p>

        {/* Share Button */}
        <button
          onClick={handleShare}
          disabled={generating}
          className="w-full primary-gradient text-on-primary py-4 rounded-2xl font-bold active:scale-95 transition-all disabled:opacity-50 shadow-xl flex justify-center items-center gap-3 text-lg"
        >
          {generating ? (
            <>
              <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
              <span>{shareStatus || "Sharing..."}</span>
            </>
          ) : (
            <>
              <span className="material-symbols-outlined">badge</span>
              Share Personality Card
            </>
          )}
        </button>

        {copied && (
          <div className="fixed bottom-24 left-1/2 -translate-x-1/2 bg-primary text-on-primary px-6 py-3.5 rounded-full font-label-md text-xs shadow-2xl animate-in fade-in slide-in-from-bottom-4 duration-300 z-50 text-center max-w-[90%] border border-primary-container">
            Caption copied to clipboard! Paste it as your caption.
          </div>
        )}

      </div>
    </AppShell>
  );
}
