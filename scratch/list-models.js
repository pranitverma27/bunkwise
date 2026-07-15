const { GoogleGenerativeAI } = require("@google/generative-ai");
const fs = require('fs');
const path = require('path');

async function listModels() {
  const envContent = fs.readFileSync(path.join(__dirname, '..', '.env.local'), 'utf8');
  const apiKeyMatch = envContent.match(/GOOGLE_GEMINI_API_KEY=(.*)/);
  const apiKey = apiKeyMatch ? apiKeyMatch[1].trim() : null;

  if (!apiKey) {
    console.error("GOOGLE_GEMINI_API_KEY not found in .env.local");
    return;
  }

  // Use the underlying REST API to list models if the SDK doesn't expose it cleanly
  const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;
  
  try {
    const response = await fetch(url);
    const data = await response.json();
    
    if (data.models) {
      console.log("Available Models:");
      data.models.forEach(m => {
        console.log(`- ${m.name} (${m.supportedGenerationMethods})`);
      });
    } else {
      console.log("No models returned. Response:", JSON.stringify(data, null, 2));
    }
  } catch (error) {
    console.error("Fetch failed:", error.message);
  }
}

listModels();
