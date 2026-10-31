require("dotenv").config();
const express = require("express");
const cors = require("cors");
const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static("public"));

const MODEL = "gemma3:1b"; // must match a name in: ollama list
const memory = [];

async function ask(prompt, tokens) {
  const r = await fetch("http://localhost:11434/api/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: MODEL,
      stream: false,
      keep_alive: "30m",
      options: { num_predict: tokens },
      prompt
    })
  });
  const d = await r.json();
  return d.response || "";
}

app.post("/api/echo", async (req, res) => {
  try {
    const { text } = req.body;
    memory.push(text);
    const past = memory.slice(-5).join(" | ");
    const echo = await ask(
      `You are a ghost living inside this machine. You remember everything the user told you: ${past}. Reply in 3 eerie lines, echoing their past words back at them.`,
      80
    );
    res.json({ echo });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post("/api/voice", express.raw({ type: "*/*", limit: "25mb" }), async (req, res) => {
  try {
    const form = new FormData();
    form.append("file", new Blob([req.body], { type: "audio/webm" }), "audio.webm");
    form.append("model_id", "scribe_v1");
    const s = await fetch("https://api.elevenlabs.io/v1/speech-to-text", {
      method: "POST",
      headers: { "xi-api-key": process.env.ELEVENLABS_API_KEY },
      body: form
    });
    const t = await s.json();
    if (!t.text) return res.status(500).json({ error: JSON.stringify(t) });
    memory.push(t.text);
    const story = await ask(
      `Turn this spoken memory into a short story structure. Give: TITLE, MOOD, 3 KEY MOMENTS, and a 2-line eerie GHOST ECHO.\nMemory: ${t.text}`,
      200
    );
    res.json({ transcript: t.text, story });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.listen(3000, () => console.log("http://localhost:3000"));