'use server';

import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GEMINI_API_KEY || "");

export interface ParsedHoliday {
  date: string;
  name: string;
}

export async function parseHolidaysFile(base64Data: string, mimeType: string = "image/jpeg"): Promise<ParsedHoliday[]> {
  if (!process.env.GOOGLE_GEMINI_API_KEY) {
    throw new Error("Gemini API Key is missing");
  }

  // Use gemini-3.1-flash-lite as the supported model for this environment
  const model = genAI.getGenerativeModel({ model: "gemini-3.1-flash-lite" });

  const prompt = `
    Analyze this document (image or PDF) containing a list of holidays and extract all holidays into a strict JSON array matching this schema:
    [
      {
        "date": "YYYY-MM-DD",
        "name": "Holiday Name"
      }
    ]
    
    Rules:
    1. Extract all official and academic holidays.
    2. Convert all dates to standard YYYY-MM-DD format. If only day and month are listed, assume the year 2026.
    3. Provide a clear, readable name for each holiday (e.g. "Independence Day", "Winter Break", "Holi").
    4. Ignore weekend descriptions unless they are explicitly listed as special holiday days.
    5. Return ONLY the raw JSON array of objects. Do not wrap in markdown code blocks or comments.
  `;

  try {
    const cleanBase64 = base64Data.includes(",") ? base64Data.split(",")[1] : base64Data;

    const result = await model.generateContent([
      {
        inlineData: {
          data: cleanBase64,
          mimeType: mimeType,
        },
      },
      { text: prompt },
    ]);

    const response = await result.response;
    const text = response.text();
    
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) throw new Error("Could not parse AI response as JSON: " + text);
    
    const parsed = JSON.parse(jsonMatch[0]);
    
    if (!Array.isArray(parsed)) {
      throw new Error("Invalid response format: expected JSON array");
    }

    // Validate and clean up
    const validated: ParsedHoliday[] = parsed
      .filter((item: any) => item && typeof item === "object" && item.date && item.name)
      .map((item: any) => {
        // Basic date format cleanup if needed
        let dStr = String(item.date).trim();
        // Check if YYYY-MM-DD format
        if (/^\d{4}-\d{2}-\d{2}$/.test(dStr)) {
          return {
            date: dStr,
            name: String(item.name).trim()
          };
        }
        
        // Try parsing and formatting as YYYY-MM-DD
        try {
          const parsedDate = new Date(dStr);
          if (!isNaN(parsedDate.getTime())) {
            dStr = parsedDate.toISOString().split("T")[0];
          }
        } catch {
          // ignore
        }

        return {
          date: dStr,
          name: String(item.name).trim()
        };
      })
      .filter((item: any) => /^\d{4}-\d{2}-\d{2}$/.test(item.date));

    return validated;
  } catch (error: any) {
    console.error("Gemini Holiday Parsing Error:", error);
    throw new Error(error.message || "Failed to parse holidays file");
  }
}
