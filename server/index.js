import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";

const app = express();
const port = process.env.PORT || 3001;
const ollamaBaseUrl = process.env.OLLAMA_URL || "http://127.0.0.1:11434";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");

app.use(express.json({ limit: "1mb" }));

async function ollamaFetch(pathname, options = {}) {
  const response = await fetch(`${ollamaBaseUrl}${pathname}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options.headers
    }
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(detail || `Ollama responded with ${response.status}`);
  }

  return response.json();
}

async function apiChat({ apiBaseUrl, apiKey, model, systemPrompt, messages }) {
  const normalizedBaseUrl = apiBaseUrl.replace(/\/$/, "");
  const response = await fetch(`${normalizedBaseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: systemPrompt },
        ...messages.map(({ role, content }) => ({ role, content }))
      ]
    })
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(detail || `AI API responded with ${response.status}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content || "";
  return { role: "assistant", content };
}

app.get("/api/health", async (_request, response) => {
  try {
    await ollamaFetch("/api/tags");
    response.json({ ok: true, ollamaBaseUrl });
  } catch (error) {
    response.status(503).json({
      ok: false,
      ollamaBaseUrl,
      message: "Ollama is not reachable. Start Ollama and pull a model before chatting."
    });
  }
});

app.get("/api/models", async (_request, response) => {
  try {
    const data = await ollamaFetch("/api/tags");
    response.json({
      models: (data.models || []).map((model) => ({
        name: model.name,
        size: model.size,
        modifiedAt: model.modified_at
      }))
    });
  } catch (error) {
    response.status(503).json({ message: error.message });
  }
});

app.post("/api/chat", async (request, response) => {
  const { provider = "ollama", model, systemPrompt, messages, apiBaseUrl, apiKey } = request.body || {};

  if (!model || !systemPrompt || !Array.isArray(messages)) {
    response.status(400).json({ message: "model, systemPrompt, and messages are required." });
    return;
  }

  if (provider === "api" && (!apiBaseUrl || !apiKey)) {
    response.status(400).json({ message: "apiBaseUrl and apiKey are required for API chat." });
    return;
  }

  try {
    if (provider === "api") {
      const data = await apiChat({ apiBaseUrl, apiKey, model, systemPrompt, messages });
      response.json(data);
      return;
    }

    const data = await ollamaFetch("/api/chat", {
      method: "POST",
      body: JSON.stringify({
        model,
        stream: false,
        messages: [
          { role: "system", content: systemPrompt },
          ...messages.map(({ role, content }) => ({ role, content }))
        ]
      })
    });

    response.json({
      role: data.message?.role || "assistant",
      content: data.message?.content || ""
    });
  } catch (error) {
    response.status(502).json({ message: error.message });
  }
});

if (process.env.NODE_ENV === "production") {
  app.use(express.static(path.join(rootDir, "dist")));
  app.get("/{*splat}", (_request, response) => {
    response.sendFile(path.join(rootDir, "dist", "index.html"));
  });
}

app.listen(port, () => {
  console.log(`Prompt Lab API listening on http://localhost:${port}`);
});
