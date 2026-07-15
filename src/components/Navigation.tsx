"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

const navItems = [
  { label: "Dashboard", icon: "grid_view",      href: "/dashboard" },
  { label: "Subjects",  icon: "menu_book",     href: "/subjects"  },
  { label: "Bunk Planner", icon: "event_upcoming", href: "/planner"   },
  { label: "My Timetable", icon: "calendar_today", href: "/timetable" },
  { label: "Personality", icon: "badge",          href: "/share"     },
  { label: "Profile",   icon: "person",         href: "/profile"   },
];

export function TopNavBar({ showAdd = false }: { showAdd?: boolean }) {
  const [logoHref, setLogoHref] = useState("/");

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setLogoHref("/dashboard");
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setLogoHref(session ? "/dashboard" : "/");
    });

    return () => subscription.unsubscribe();
  }, []);

  return (
    <header className="fixed top-0 left-0 w-full z-50 flex justify-between items-center px-4 py-2 glass-nav border-b border-white/10 md:hidden">
      <Link href={logoHref} className="font-headline-md text-primary">
        BunkWise
      </Link>
      <div className="flex items-center gap-2">
        {showAdd && (
          <button 
            onClick={() => window.location.href = '/subjects'}
            className="p-2 rounded-full hover:bg-white/5 active:scale-90 transition-all"
          >
            <span className="material-symbols-outlined text-primary">add</span>
          </button>
        )}
        <Link href="/profile" className="p-2 rounded-full hover:bg-white/5 transition-colors flex items-center justify-center" aria-label="Profile">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6 text-on-surface-variant">
            <path strokeLinecap="round" strokeLinejoin="round" d="M17.982 18.725A7.488 7.488 0 0012 15.75a7.488 7.488 0 00-5.982 2.975m11.963 0a9 9 0 10-11.963 0m11.963 0A8.966 8.966 0 0112 21a8.966 8.966 0 01-5.982-2.275M15 9.75a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </Link>
      </div>
    </header>
  );
}

export function BottomNavBar() {
  const path = usePathname();
  return (
    <nav className="fixed bottom-0 left-0 w-full z-50 flex justify-around items-center px-4 py-3 pb-safe glass-nav border-t border-white/10 rounded-t-2xl md:hidden">
      {navItems.map((item) => {
        const active = path.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`flex flex-col items-center justify-center gap-1 transition-transform active:scale-90 ${
              active ? "text-primary font-bold" : "text-on-surface-variant/60"
            }`}
          >
            <span className={`material-symbols-outlined ${active ? "material-symbols-filled" : ""}`} style={{ fontSize: "24px" }}>
              {item.icon}
            </span>
            <span className="font-label-sm" style={{ fontSize: "10px" }}>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

export function Sidebar() {
  const path = usePathname();
  const router = useRouter();
  const [logoHref, setLogoHref] = useState("/");

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setLogoHref("/dashboard");
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setLogoHref(session ? "/dashboard" : "/");
    });

    return () => subscription.unsubscribe();
  }, []);
  
  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/");
  };
  
  return (
    <aside className="hidden md:flex fixed left-0 top-0 h-screen w-64 flex-col border-r border-white/10 bg-[#0e0e0e] p-6 z-50">
      <div className="mb-12">
        <Link href={logoHref} className="font-headline-md text-primary">
          BunkWise
        </Link>
      </div>
      <nav className="flex flex-col gap-3 flex-1">
        {navItems.map((item) => {
          const active = path.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-4 px-5 py-4 rounded-2xl transition-all ${
                active
                  ? "glass-card-active text-primary font-bold neon-glow-purple"
                  : "text-on-surface-variant hover:bg-white/5"
              }`}
            >
              <span className={`material-symbols-outlined ${active ? "material-symbols-filled" : ""}`}>
                {item.icon}
              </span>
              <span className="font-label-md tracking-wide">{item.label}</span>
            </Link>
          );
        })}
      </nav>
      <div className="mt-auto">
        <button 
          onClick={handleLogout}
          className="w-full flex items-center justify-center gap-3 py-4 rounded-2xl border border-error/20 bg-error/5 text-error font-bold hover:bg-error/10 transition-all active:scale-95 shadow-lg"
        >
          <span className="material-symbols-outlined" style={{ fontSize: "22px" }}>logout</span>
          <span className="font-label-md">Logout</span>
        </button>
      </div>
    </aside>
  );
}

export function AppShell({ children, showAdd = false }: { children: React.ReactNode; showAdd?: boolean }) {
  return (
    <>
      <TopNavBar showAdd={showAdd} />
      <Sidebar />
      <div className="md:pl-64">
        <main className="pt-20 pb-24 md:pt-12 md:pb-12 min-h-screen">
          {children}
        </main>
      </div>
      <BottomNavBar />
    </>
  );
}
