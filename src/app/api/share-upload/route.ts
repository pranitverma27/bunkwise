import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File;
    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const forwardData = new FormData();
    forwardData.append("file", file, file.name || "card.png");

    const res = await fetch("https://tmpfiles.org/api/v1/upload", {
      method: "POST",
      body: forwardData,
    });

    if (!res.ok) {
      throw new Error(`Tmpfiles upload failed with status ${res.status}`);
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (err: any) {
    console.error("API share upload error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
