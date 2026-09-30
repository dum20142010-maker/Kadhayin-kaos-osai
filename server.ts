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

  // 9. Landmark Weather & Vibe Index Engine
  app.post('/api/ai/landmark-weather', async (req, res) => {
    try {
      const { landmarkName, zone } = req.body;
      const prompt = `You are the atmospheric & ambient sensor suite for KAOS Chennai.
Landmark: "${landmarkName}" in zone "${zone || 'Chennai'}"

Generate current atmospheric conditions and an immersive "Vibe Index" score.
Return ONLY valid JSON:
{
  "temperature": "32°C",
  "humidity": "76%",
  "wind": "12 km/h SE",
  "vibeIndex": "95/100",
  "vibeTitle": "Divine Temple & Coastal Resonance",
  "atmosphereSummary": "Subtle sea breeze mingling with sacred incense and sandalwood aroma."
}`;

      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: prompt,
        config: { responseMimeType: 'application/json' },
      });
      res.json(JSON.parse(response.text || '{}'));
    } catch (err: any) {
      console.error('Landmark Weather Error:', err);
      res.json({
        temperature: "31°C",
        humidity: "78%",
        wind: "14 km/h E",
        vibeIndex: "94/100",
        vibeTitle: "Heritage Calm & Filter Coffee Aroma",
        atmosphereSummary: "Warm tropical breeze over 19th-century granite corridors."
      });
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
