const fs = require('fs');

async function test() {
  const geminiKey = process.env.GEMINI_API_KEY || fs.readFileSync('.env.local', 'utf8').match(/GEMINI_API_KEY=(.*)/)[1];
  const prompt = "Generate a JSON with keys a, b, c and values 1, 2, 3.";
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.4,
          maxOutputTokens: 8192,
          responseMimeType: "application/json"
        }
      })
    }
  );
  const data = await res.json();
  console.log(JSON.stringify(data, null, 2));
}
test();
