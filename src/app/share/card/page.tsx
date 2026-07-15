import type { Metadata } from "next";
import Link from "next/link";

interface PageProps {
  searchParams: Promise<{ img?: string }>;
}

async function getDirectImageUrl(imgPath: string): Promise<string> {
  if (!imgPath) return "";
  
  // If it's a legacy or fallback Uguu.se link (contains no slashes), load it directly
  if (!imgPath.includes("/")) {
    return `https://d.uguu.se/${imgPath}`;
  }

  try {
    const previewUrl = `https://tmpfiles.org/${imgPath}`;
    
    // Fetch the preview HTML page from tmpfiles.org
    const res = await fetch(previewUrl, { cache: "no-store" });
    if (!res.ok) {
      console.warn(`Failed to fetch preview page: ${res.status}`);
      return `https://tmpfiles.org/dl/${imgPath}`;
    }

    const html = await res.text();
    
    // Extract the raw download URL from the HTML using regex
    const match = html.match(/href="(https:\/\/tmpfiles\.org\/dl\/[^"]+)"/);
    if (match && match[1]) {
      return match[1];
    }

    // Fallback if regex fails
    return `https://tmpfiles.org/dl/${imgPath}`;
  } catch (err) {
    console.error("Failed to parse direct download URL:", err);
    return `https://tmpfiles.org/dl/${imgPath}`;
  }
}

export async function generateMetadata({ searchParams }: PageProps): Promise<Metadata> {
  const params = await searchParams;
  const imgPath = params.img || "";
  const imageUrl = await getDirectImageUrl(imgPath);

  return {
    title: "BunkWise Personality Card",
    description: "Calculate your attendance risk and plan your bunks scientifically on BunkWise.",
    openGraph: {
      title: "BunkWise Personality Card",
      description: "Check out my Marvel attendance personality card on BunkWise!",
      images: imageUrl ? [{ url: imageUrl, width: 1200, height: 1600, alt: "BunkWise Personality Card" }] : [],
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: "BunkWise Personality Card",
      description: "Check out my Marvel attendance personality card on BunkWise!",
      images: imageUrl ? [imageUrl] : [],
    },
  };
}

export default async function SharedCardPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const imgPath = params.img || "";
  const imageUrl = await getDirectImageUrl(imgPath);

  return (
    <div className="min-h-screen bg-[#131313] text-white flex flex-col items-center justify-between p-6">
      {/* Header */}
      <header className="w-full max-w-md flex justify-center py-6">
        <Link href="/" className="font-headline-md text-primary text-2xl font-bold tracking-tight">
          BunkWise
        </Link>
      </header>

      {/* Main Content */}
      <main className="flex-1 w-full max-w-md flex flex-col items-center justify-center gap-6 my-4">
        {imageUrl ? (
          <div className="w-full aspect-[3/4] relative rounded-3xl overflow-hidden shadow-2xl border border-white/10 bg-[#1e1e1e] flex items-center justify-center animate-in fade-in zoom-in duration-500">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img 
              src={imageUrl} 
              alt="BunkWise Personality Card" 
              className="w-full h-full object-contain"
            />
          </div>
        ) : (
          <div className="text-center py-12">
            <span className="material-symbols-outlined text-6xl text-on-surface-variant/40 mb-3 block">warning</span>
            <p className="text-on-surface-variant font-body-md">Stats card not found or expired.</p>
          </div>
        )}

        <div className="text-center space-y-2 px-4">
          <h2 className="text-xl font-bold font-headline-sm">What's your attendance personality?</h2>
          <p className="text-sm text-on-surface-variant">
            Track your classes, plan your bunks on autopilot, and never fall below the 75% attendance threshold.
          </p>
        </div>
      </main>

      {/* Footer / CTA */}
      <footer className="w-full max-w-md flex flex-col gap-3 pb-8">
        <Link 
          href="/" 
          className="w-full primary-gradient text-on-primary py-4 rounded-2xl font-bold text-center active:scale-95 transition-all shadow-xl block"
        >
          Check Your Attendance Risk
        </Link>
        <p className="text-[10px] text-center text-on-surface-variant/45">
          Join thousands of students bunking scientifically.
        </p>
      </footer>
    </div>
  );
}
