import express from 'express';
import cors from 'cors';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import path from 'path';
import { createServer as createViteServer } from 'vite';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});

async function startServer() {
  const app = express();
  app.use(cors());
  app.use(express.json());

  // GEMINI AI PROXY ENDPOINTS

  // 1. Expedition Plan Architect
  app.post('/api/ai/generate-plan', async (req, res) => {
    try {
      const { prompt, schema } = req.body;
      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: schema,
        },
      });
      res.json({ text: response.text });
    } catch (err: any) {
      console.error('Gemini Plan Error:', err);
      res.status(500).json({ error: err.message });
    }
  });

  // 2. Multimodal Quest Engine
  app.post('/api/ai/generate-quests', async (req, res) => {
    try {
      const { prompt } = req.body;
      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
        },
      });
      res.json({ text: response.text });
    } catch (err: any) {
      console.error('Gemini Quest Error:', err);
      res.status(500).json({ error: err.message });
    }
  });

  // 3. Heritage Chronicler Explainer
  app.post('/api/ai/place-explainer', async (req, res) => {
    try {
      const { prompt } = req.body;
      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
        },
      });
      res.json({ text: response.text });
    } catch (err: any) {
      console.error('Gemini Explainer Error:', err);
      res.status(500).json({ error: err.message });
    }
  });

  // 3.1 Maya Heritage Chrono-Navigator
  app.post('/api/ai/maya-lore', async (req, res) => {
    try {
      const { prompt } = req.body;
      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: prompt,
      });
      res.json({ text: response.text });
    } catch (err: any) {
      console.error('Gemini Maya Lore Error:', err);
      res.status(500).json({ error: err.message });
    }
  });

  // 4. Semantic Search Engine
  app.post('/api/ai/search-places', async (req, res) => {
    try {
      const { prompt } = req.body;
      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
        },
      });
      res.json({ text: response.text });
    } catch (err: any) {
      console.error('Gemini Search Error:', err);
      res.status(500).json({ error: err.message });
    }
  });

  // 5. Mood & Time Radar Synthesizer
  app.post('/api/ai/mood-radar', async (req, res) => {
    try {
      const { prompt } = req.body;
      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: prompt,
      });
      res.json({ text: response.text });
    } catch (err: any) {
      console.error('Gemini Radar Error:', err);
      res.status(500).json({ error: err.message });
    }
  });

  // 5.1 Smart Explorer Recommendations
  app.post('/api/ai/smart-recommendation', async (req, res) => {
    try {
      const { timeOfDay, mood } = req.body;
      const prompt = `You are the lead explorer of Chennai.
Current time: ${timeOfDay}
Explorer vibe: ${mood}

Suggest ONE specific neighborhood or cluster in Chennai (from: Mylapore, George Town, Marina, Royapuram, Egmore, Fort St. George, Besant Nagar, Nungambakkam).
Provide a 1-sentence reason why it's the perfect match for this moment.
Return ONLY valid JSON: { "zone": "Name", "reason": "Reason" }`;

      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: prompt,
        config: { responseMimeType: 'application/json' },
      });
      res.json({ text: response.text });
    } catch (err: any) {
      console.error('Gemini Rec Error:', err);
      res.status(500).json({ error: err.message });
    }
  });

  // 6. Daily Discovery Challenge Generator
  app.post('/api/ai/daily-challenge', async (req, res) => {
    try {
      const { prompt } = req.body;
      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
        },
      });
      res.json({ text: response.text });
    } catch (err: any) {
      console.error('Gemini Daily Challenge Error:', err);
      res.status(500).json({ error: err.message });
    }
  });

  // 7. Vintage Reconstruction Engine (Image Generation)
  app.post('/api/ai/reconstruct-place', async (req, res) => {
    try {
      const { landmarkName, landmarkLore } = req.body;
      const prompt = `A high-quality vintage photograph reconstruction of ${landmarkName} in Chennai during the early 1900s. 
Context: ${landmarkLore}
Style: Sepia toned, grainy, authentic historical archive photo, 1920s aesthetic, sharp detail where possible.`;

      const response = await ai.models.generateContent({
        model: 'gemini-3.1-flash-lite-image',
        contents: {
          parts: [{ text: prompt }],
        },
        config: {
          imageConfig: {
            aspectRatio: '1:1',
          },
        },
      });

      let base64Image = '';
      const candidate = response.candidates?.[0];
      if (candidate?.content?.parts) {
        for (const part of candidate.content.parts) {
          if (part.inlineData) {
            base64Image = part.inlineData.data || '';
            break;
          }
        }
      }

      if (base64Image) {
        res.json({ imageUrl: `data:image/png;base64,${base64Image}` });
      } else {
        res.status(500).json({ error: 'Failed to generate image' });
      }
    } catch (err: any) {
      console.error('Gemini Image Error:', err);
      res.status(500).json({ error: err.message });
    }
  });

  // 8. Smart Proximity Notification Engine
  app.post('/api/ai/smart-notification', async (req, res) => {
    try {
      const { landmarkName, landmarkLore, distance } = req.body;
      const prompt = `You are a heritage guide in Chennai. 
The user is ${distance} meters away from ${landmarkName}.
Context: ${landmarkLore}

Create a 1-sentence, extremely engaging discovery alert. 
Rules: 
- Max 15 words.
- Highlight something mysterious or tasty.
- Don't use "Hey" or "Hi".`;

      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: prompt,
      });
      res.json({ text: response.text });
    } catch (err: any) {
      console.error('Gemini Notify Error:', err);
      res.status(500).json({ error: err.message });
    }
  });

  // 9. Landmark Weather & Vibe Index Engine (Mood-Aware with 12-Hour Trend Data)
  app.post('/api/ai/landmark-weather', async (req, res) => {
    try {
      const { landmarkName, zone, moodCategory } = req.body;
      const mood = moodCategory || 'balanced';
      const prompt = `You are the atmospheric & ambient sensor suite for KAOS Chennai.
Landmark: "${landmarkName}" in zone "${zone || 'Chennai'}"
Active Mood Theme: "${mood}" (e.g. cyber, heritage, coastal, coffee, balanced)

Generate current atmospheric conditions, an immersive "Vibe Index" score tailored to the mood, and a 12-hour trend array (6 data points, every 2 hours from -10h to now).
Return ONLY valid JSON in this exact structure:
{
  "temperature": "32°C",
  "humidity": "76%",
  "wind": "12 km/h SE",
  "vibeIndex": "95/100",
  "vibeTitle": "Divine Temple & Coastal Resonance",
  "atmosphereSummary": "Subtle sea breeze mingling with sacred incense and sandalwood aroma.",
  "trend": [
    { "time": "-10h", "temp": 28, "humidity": 84, "vibe": 78 },
    { "time": "-8h", "temp": 29, "humidity": 82, "vibe": 82 },
    { "time": "-6h", "temp": 31, "humidity": 78, "vibe": 88 },
    { "time": "-4h", "temp": 33, "humidity": 74, "vibe": 92 },
    { "time": "-2h", "temp": 32, "humidity": 75, "vibe": 94 },
    { "time": "Now", "temp": 32, "humidity": 76, "vibe": 95 }
  ]
}`;

      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: prompt,
        config: { responseMimeType: 'application/json' },
      });
      const parsed = JSON.parse(response.text || '{}');
      res.json(parsed);
    } catch (err: any) {
      console.error('Landmark Weather Error:', err);
      res.json({
        temperature: "31°C",
        humidity: "78%",
        wind: "14 km/h E",
        vibeIndex: "94/100",
        vibeTitle: req.body?.moodCategory === 'cyber' ? "Cyber Synapse Resonance 94%" : "Heritage Calm & Filter Coffee Aroma",
        atmosphereSummary: req.body?.moodCategory === 'cyber' 
          ? "Quantum neon oscillations interfacing with coastal radio frequencies." 
          : "Warm tropical breeze over 19th-century granite corridors.",
        trend: [
          { time: "-10h", temp: 28, humidity: 85, vibe: 75 },
          { time: "-8h", temp: 29, humidity: 82, vibe: 80 },
          { time: "-6h", temp: 30, humidity: 80, vibe: 86 },
          { time: "-4h", temp: 32, humidity: 76, vibe: 90 },
          { time: "-2h", temp: 31, humidity: 77, vibe: 92 },
          { time: "Now", temp: 31, humidity: 78, vibe: 94 }
        ]
      });
    }
  });

  // 10. Cloud SQL PostgreSQL Database Endpoints
  app.post('/api/db/weather-vibe', async (req, res) => {
    try {
      const { logWeatherVibe } = await import('./src/db/users.ts');
      const saved = await logWeatherVibe(req.body);
      res.json({ success: true, log: saved });
    } catch (error: any) {
      console.error('Failed to log weather vibe to PostgreSQL:', error);
      res.status(500).json({ error: 'Database logging failed' });
    }
  });

  app.get('/api/db/weather-vibe', async (req, res) => {
    try {
      const { getRecentWeatherVibeLogs } = await import('./src/db/users.ts');
      const limit = parseInt(req.query.limit as string) || 10;
      const logs = await getRecentWeatherVibeLogs(limit);
      res.json(logs);
    } catch (error: any) {
      console.error('Failed to fetch weather vibe logs from PostgreSQL:', error);
      res.status(500).json({ error: 'Failed to fetch database logs' });
    }
  });

  app.post('/api/db/sync-user', async (req, res) => {
    try {
      const { uid, email, displayName } = req.body;
      if (!uid || !email) {
        return res.status(400).json({ error: 'Missing uid or email' });
      }
      const { getOrCreateUser } = await import('./src/db/users.ts');
      const user = await getOrCreateUser(uid, email, displayName);
      res.json({ success: true, user });
    } catch (error: any) {
      console.error('Failed to sync user to PostgreSQL:', error);
      res.status(500).json({ error: 'Database user sync failed' });
    }
  });

  if (process.env.NODE_ENV === 'development') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.join(__dirname, 'dist', 'index.html'));
    });
  }

  const port = process.env.PORT || 3000;
  app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
  });
}

startServer();
