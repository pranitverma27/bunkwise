const { GoogleGenerativeAI } = require("@google/generative-ai");
const fs = require('fs');
const path = require('path');

async function test() {
  const envContent = fs.readFileSync(path.join(__dirname, '..', '.env.local'), 'utf8');
  const apiKeyMatch = envContent.match(/GOOGLE_GEMINI_API_KEY=(.*)/);
  const apiKey = apiKeyMatch ? apiKeyMatch[1].trim() : null;

  if (!apiKey) {
    console.error("GOOGLE_GEMINI_API_KEY not found");
    return;
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-3.1-flash-lite" });
    const result = await model.generateContent("hello");
    console.log("Success:", result.response.text());
  } catch (err) {
    console.error("Error:", err.message);
  }
}

test();
