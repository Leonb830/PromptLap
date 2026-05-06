import express from "express";
import OpenAI from "openai";
import path from "node:path";
import { fileURLToPath } from "node:url";

const app = express();
const port = process.env.PORT || 3001;
const ollamaBaseUrl = process.env.OLLAMA_URL || "http://127.0.0.1:11434";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");

app.use(express.json({ limit: "1mb" }));
app.use((request, response, next) => {
  const origin = request.headers.origin;
  if (origin && /^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin)) {
    response.setHeader("Access-Control-Allow-Origin", origin);
  }
  response.setHeader("Access-Control-Allow-Headers", "Content-Type");
  response.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");

  if (request.method === "OPTIONS") {
    response.sendStatus(204);
    return;
  }

  next();
});

async function ollamaFetch(pathname, options = {}) {
  const response = await fetch(`${ollamaBaseUrl}${pathname}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(detail || `Ollama responded with ${response.status}`);
  }

  return response.json();
}

async function apiChat({ apiBaseUrl, apiKey, model, systemPrompt, messages }) {
  const client = new OpenAI({
    apiKey,
    baseURL: apiBaseUrl.replace(/\/$/, ""),
  });

  const response = await client.responses.create({
    model,
    instructions: systemPrompt,
    input: messages.map(({ role, content }) => ({
      role: role === "assistant" ? "assistant" : "user",
      content,
    })),
  });

  return { role: "assistant", content: response.output_text || "" };
}

async function apiModels({ apiBaseUrl, apiKey }) {
  const client = new OpenAI({
    apiKey,
    baseURL: apiBaseUrl.replace(/\/$/, ""),
  });

  const models = [];
  for await (const model of client.models.list()) {
    models.push(model);
  }

  return models
    .map((model) => ({ name: model.id }))
    .filter((model) => model.name)
    .sort((a, b) => a.name.localeCompare(b.name));
}

app.get("/api/health", async (_request, response) => {
  try {
    await ollamaFetch("/api/tags");
    response.json({ ok: true, ollamaBaseUrl });
  } catch (error) {
    response.status(503).json({
      ok: false,
      ollamaBaseUrl,
      message:
        "Ollama is not reachable. Start Ollama and pull a model before chatting.",
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
        modifiedAt: model.modified_at,
      })),
    });
  } catch (error) {
    response.status(503).json({ message: error.message });
  }
});

app.post("/api/api-models", async (request, response) => {
  const { apiBaseUrl, apiKey } = request.body || {};

  if (!apiBaseUrl || !apiKey) {
    response
      .status(400)
      .json({ message: "apiBaseUrl and apiKey are required to list API models." });
    return;
  }

  try {
    response.json({ models: await apiModels({ apiBaseUrl, apiKey }) });
  } catch (error) {
    response.status(502).json({ message: error.message });
  }
});

app.post("/api/chat", async (request, response) => {
  const {
    provider = "ollama",
    model,
    systemPrompt,
    messages,
    apiBaseUrl,
    apiKey,
  } = request.body || {};
  const effectiveProvider =
    provider === "api" || apiBaseUrl || apiKey ? "api" : "ollama";

  if (!model || !systemPrompt || !Array.isArray(messages)) {
    response
      .status(400)
      .json({ message: "model, systemPrompt, and messages are required." });
    return;
  }

  if (effectiveProvider === "api" && (!apiBaseUrl || !apiKey)) {
    response
      .status(400)
      .json({ message: "apiBaseUrl and apiKey are required for API chat." });
    return;
  }

  try {
    if (effectiveProvider === "api") {
      const data = await apiChat({
        apiBaseUrl,
        apiKey,
        model,
        systemPrompt,
        messages,
      });
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
          ...messages.map(({ role, content }) => ({ role, content })),
        ],
      }),
    });

    response.json({
      role: data.message?.role || "assistant",
      content: data.message?.content || "",
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
