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
  const { model, systemPrompt, messages } = request.body || {};

  if (!model || !systemPrompt || !Array.isArray(messages)) {
    response.status(400).json({ message: "model, systemPrompt, and messages are required." });
    return;
  }

  try {
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
