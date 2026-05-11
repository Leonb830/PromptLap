import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import OpenAI from "openai";

const app = express();
const port = process.env.PORT || 3001;
const ollamaBaseUrl = process.env.OLLAMA_URL || "http://127.0.0.1:11434";
const defaultApiBaseUrl = "https://openrouter.ai/api/v1";
const serverApiBaseUrl = process.env.OPENROUTER_BASE_URL || process.env.API_BASE_URL || defaultApiBaseUrl;
const serverApiKey = process.env.OPENROUTER_API_KEY || process.env.API_KEY || "";
const serverApiModel = process.env.OPENROUTER_MODEL || process.env.API_MODEL || "openai/gpt-5.2-chat";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");

app.use(express.json({ limit: "1mb" }));
app.use((request, response, next) => {
  const origin = request.headers.origin;
  if (origin) {
    try {
      const { protocol, hostname } = new URL(origin);
      const isAllowedLocalOrigin =
        protocol === "http:" &&
        (/^(localhost|127\.0\.0\.1)$/.test(hostname) ||
          /^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(hostname) ||
          /^192\.168\.\d{1,3}\.\d{1,3}$/.test(hostname) ||
          /^172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3}$/.test(hostname));

      if (isAllowedLocalOrigin) {
        response.setHeader("Access-Control-Allow-Origin", origin);
      }
    } catch {
      // Ignore malformed origins.
    }
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

function normalizeErrorMessage(error) {
  const message = error instanceof Error ? error.message : String(error);

  try {
    const parsed = JSON.parse(message);
    return parsed.error || parsed.message || message;
  } catch {
    return message;
  }
}

function isNonEmptyString(value) {
  return typeof value === "string" && Boolean(value.trim());
}

function normalizeOpenRouterServerUrl(apiBaseUrl) {
  const trimmed = typeof apiBaseUrl === "string" ? apiBaseUrl.trim() : "";

  if (!trimmed) return defaultApiBaseUrl;

  try {
    const url = new URL(trimmed);
    url.hash = "";
    url.search = "";

    if (url.hostname === "api.openai.com") {
      return defaultApiBaseUrl;
    }

    url.pathname = url.pathname
      .replace(/\/chat\/completions\/?$/, "")
      .replace(/\/+$/, "");

    if (
      url.hostname.endsWith("openrouter.ai") &&
      !url.pathname.endsWith("/api/v1")
    ) {
      url.pathname = "/api/v1";
    }

    return url.toString().replace(/\/$/, "");
  } catch {
    return defaultApiBaseUrl;
  }
}

function resolveApiCredentials({ apiBaseUrl, apiKey }) {
  const clientApiKey = typeof apiKey === "string" ? apiKey.trim() : "";

  if (clientApiKey) {
    return {
      apiBaseUrl,
      apiKey: clientApiKey,
      source: "client",
    };
  }

  if (isNonEmptyString(serverApiKey)) {
    return {
      apiBaseUrl: serverApiBaseUrl,
      apiKey: serverApiKey.trim(),
      source: "server",
    };
  }

  return {
    apiBaseUrl,
    apiKey: "",
    source: "missing",
  };
}

function hasUsableApiCredentials({ apiBaseUrl, apiKey }) {
  const credentials = resolveApiCredentials({ apiBaseUrl, apiKey });
  return (
    isNonEmptyString(credentials.apiKey) &&
    (credentials.source === "server" || isNonEmptyString(apiBaseUrl))
  );
}

function openRouterClient({ apiBaseUrl, apiKey }) {
  return new OpenAI({
    apiKey,
    baseURL: normalizeOpenRouterServerUrl(apiBaseUrl),
    defaultHeaders: {
      "HTTP-Referer": "http://localhost:5173",
      "X-OpenRouter-Title": "Prompt Lab",
    },
  });
}

async function apiChat({ apiBaseUrl, apiKey, model, systemPrompt, messages }) {
  const openai = openRouterClient({ apiBaseUrl, apiKey });
  const completion = await openai.chat.completions.create({
    model,
    messages: [
      { role: "system", content: systemPrompt },
      ...messages.map(({ role, content }) => ({
        role: role === "assistant" ? "assistant" : "user",
        content,
      })),
    ],
  });

  return {
    role: "assistant",
    content: completion.choices?.[0]?.message?.content || "",
  };
}

function streamChatMessages({ systemPrompt, messages }) {
  return [
    { role: "system", content: systemPrompt },
    ...messages.map(({ role, content }) => ({
      role: role === "assistant" ? "assistant" : "user",
      content,
    })),
  ];
}

function startJsonLineStream(response) {
  response.writeHead(200, {
    "Content-Type": "application/x-ndjson; charset=utf-8",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  });
}

function writeStreamEvent(response, event) {
  if (response.destroyed || response.writableEnded) return;
  response.write(`${JSON.stringify(event)}\n`);
}

function createResponseAbortSignal(response) {
  const controller = new AbortController();
  response.on("close", () => controller.abort());
  return controller.signal;
}

async function apiChatStream({
  apiBaseUrl,
  apiKey,
  model,
  systemPrompt,
  messages,
  signal,
}, response) {
  const openai = openRouterClient({ apiBaseUrl, apiKey });
  const stream = await openai.chat.completions.create(
    {
      model,
      stream: true,
      messages: streamChatMessages({ systemPrompt, messages }),
    },
    { signal },
  );

  for await (const chunk of stream) {
    const content = chunk.choices?.[0]?.delta?.content;
    if (typeof content === "string" && content) {
      writeStreamEvent(response, { type: "token", content });
    }
  }
}

function readOllamaStreamLine(line) {
  const data = JSON.parse(line);

  if (data.error) {
    throw new Error(data.error);
  }

  return data.message?.content || "";
}

async function ollamaChatStream({ model, systemPrompt, messages, signal }, response) {
  const upstream = await fetch(`${ollamaBaseUrl}/api/chat`, {
    method: "POST",
    signal,
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      stream: true,
      messages: [
        { role: "system", content: systemPrompt },
        ...messages.map(({ role, content }) => ({ role, content })),
      ],
    }),
  });

  if (!upstream.ok) {
    const detail = await upstream.text();
    throw new Error(detail || `Ollama responded with ${upstream.status}`);
  }

  if (!upstream.body) {
    throw new Error("Ollama did not return a readable stream.");
  }

  const decoder = new TextDecoder();
  let buffer = "";

  for await (const chunk of upstream.body) {
    buffer += decoder.decode(chunk, { stream: true });

    let newlineIndex = buffer.indexOf("\n");
    while (newlineIndex >= 0) {
      const line = buffer.slice(0, newlineIndex).trim();
      buffer = buffer.slice(newlineIndex + 1);

      if (line) {
        const content = readOllamaStreamLine(line);
        if (content) writeStreamEvent(response, { type: "token", content });
      }

      newlineIndex = buffer.indexOf("\n");
    }
  }

  buffer += decoder.decode();
  const finalLine = buffer.trim();
  if (finalLine) {
    const content = readOllamaStreamLine(finalLine);
    if (content) writeStreamEvent(response, { type: "token", content });
  }
}

function extractJsonBlock(text) {
  const fencedMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fencedMatch ? fencedMatch[1] : text;
  const arrayStart = candidate.indexOf("[");
  const objectStart = candidate.indexOf("{");

  if (arrayStart >= 0 && (objectStart === -1 || arrayStart < objectStart)) {
    return candidate.slice(arrayStart, candidate.lastIndexOf("]") + 1);
  }

  if (objectStart >= 0) {
    return candidate.slice(objectStart, candidate.lastIndexOf("}") + 1);
  }

  return candidate;
}

function normalizeSuggestionItems(parsed) {
  const items = Array.isArray(parsed) ? parsed : parsed.suggestions;
  if (!Array.isArray(items)) {
    throw new Error("The model did not return a suggestions array.");
  }

  return items
    .map((item, index) => ({
      id: item.id || `suggestion-${index + 1}`,
      label: item.label || item.title || "Suggestion",
      hint: item.hint || item.reason || item.description || "",
      snippet: item.snippet || item.rewrite || item.insert || "",
    }))
    .filter((item) => item.hint && item.snippet);
}

function parseSuggestionResponse(text) {
  const jsonText = extractJsonBlock(text);
  const parsed = JSON.parse(jsonText);
  return normalizeSuggestionItems(parsed);
}

function buildSuggestionPrompt(systemPrompt) {
  return [
    "Review this system prompt and return practical improvements.",
    "Respond with JSON only.",
    'Use this exact shape: {"suggestions":[{"id":"short-kebab-id","label":"short title","hint":"why this helps","snippet":"text to append or replace with"}]}',
    "Return 0 to 5 suggestions.",
    "Focus on specificity, constraints, audience, structure, and vague wording.",
    "Do not include markdown fences.",
    "",
    "System prompt to review:",
    systemPrompt,
  ].join("\n");
}

async function apiPromptSuggestions({
  apiBaseUrl,
  apiKey,
  model,
  systemPrompt,
}) {
  const openai = openRouterClient({ apiBaseUrl, apiKey });
  const completion = await openai.chat.completions.create({
    model,
    messages: [
      {
        role: "system",
        content:
          "You are a prompt engineering reviewer. Return only valid JSON that matches the requested schema.",
      },
      {
        role: "user",
        content: buildSuggestionPrompt(systemPrompt),
      },
    ],
  });

  return parseSuggestionResponse(completion.choices?.[0]?.message?.content || "");
}

async function ollamaPromptSuggestions({ model, systemPrompt }) {
  const data = await ollamaFetch("/api/chat", {
    method: "POST",
    body: JSON.stringify({
      model,
      stream: false,
      messages: [
        {
          role: "system",
          content:
            "You are a prompt engineering reviewer. Return only valid JSON with a top-level suggestions array.",
        },
        {
          role: "user",
          content: buildSuggestionPrompt(systemPrompt),
        },
      ],
    }),
  });

  return parseSuggestionResponse(data.message?.content || "");
}

async function apiModels({ apiBaseUrl, apiKey }) {
  const openai = openRouterClient({ apiBaseUrl, apiKey });
  const models = await openai.models.list();

  return Array.from(models.data || [])
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

app.get("/api/api-settings", (_request, response) => {
  response.json({
    baseUrl: normalizeOpenRouterServerUrl(serverApiBaseUrl),
    model: serverApiModel,
    hasServerApiKey: isNonEmptyString(serverApiKey),
  });
});

app.post("/api/api-models", async (request, response) => {
  const { apiBaseUrl, apiKey } = request.body || {};
  const credentials = resolveApiCredentials({ apiBaseUrl, apiKey });

  if (!hasUsableApiCredentials({ apiBaseUrl, apiKey })) {
    response.status(400).json({
      message:
        "Add an API key in the app or configure OPENROUTER_API_KEY on the server.",
    });
    return;
  }

  try {
    response.json({ models: await apiModels(credentials) });
  } catch (error) {
    response.status(502).json({ message: normalizeErrorMessage(error) });
  }
});

app.post("/api/chat", async (request, response) => {
  const { provider, model, systemPrompt, messages, apiBaseUrl, apiKey, stream } =
    request.body || {};
  const credentials = resolveApiCredentials({ apiBaseUrl, apiKey });
  const effectiveProvider =
    provider === "api" || (!provider && (apiBaseUrl || apiKey))
      ? "api"
      : "ollama";

  if (
    !isNonEmptyString(model) ||
    !isNonEmptyString(systemPrompt) ||
    !Array.isArray(messages)
  ) {
    response
      .status(400)
      .json({ message: "model, systemPrompt, and messages are required." });
    return;
  }

  if (
    effectiveProvider === "api" &&
    !hasUsableApiCredentials({ apiBaseUrl, apiKey })
  ) {
    response
      .status(400)
      .json({
        message:
          "Add an API key in the app or configure OPENROUTER_API_KEY on the server.",
      });
    return;
  }

  try {
    if (stream) {
      const signal = createResponseAbortSignal(response);
      startJsonLineStream(response);

      try {
        if (effectiveProvider === "api") {
          await apiChatStream({
            apiBaseUrl: credentials.apiBaseUrl,
            apiKey: credentials.apiKey,
            model,
            systemPrompt,
            messages,
            signal,
          }, response);
        } else {
          await ollamaChatStream({ model, systemPrompt, messages, signal }, response);
        }

        writeStreamEvent(response, { type: "done" });
      } catch (error) {
        writeStreamEvent(response, {
          type: "error",
          message: normalizeErrorMessage(error),
        });
      } finally {
        if (!response.destroyed && !response.writableEnded) {
          response.end();
        }
      }

      return;
    }

    if (effectiveProvider === "api") {
      const data = await apiChat({
        apiBaseUrl: credentials.apiBaseUrl,
        apiKey: credentials.apiKey,
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
    response.status(502).json({ message: normalizeErrorMessage(error) });
  }
});

app.post("/api/prompt-suggestions", async (request, response) => {
  const { provider, model, systemPrompt, apiBaseUrl, apiKey } =
    request.body || {};
  const credentials = resolveApiCredentials({ apiBaseUrl, apiKey });
  const effectiveProvider =
    provider === "api" || (!provider && (apiBaseUrl || apiKey))
      ? "api"
      : "ollama";

  if (!isNonEmptyString(model) || !isNonEmptyString(systemPrompt)) {
    response.status(400).json({
      message: "model and systemPrompt are required to improve the prompt.",
    });
    return;
  }

  if (effectiveProvider === "api" && !hasUsableApiCredentials({ apiBaseUrl, apiKey })) {
    response.status(400).json({
      message:
        "Add an API key in the app or configure OPENROUTER_API_KEY on the server.",
    });
    return;
  }

  try {
    const suggestions =
      effectiveProvider === "api"
        ? await apiPromptSuggestions({
            apiBaseUrl: credentials.apiBaseUrl,
            apiKey: credentials.apiKey,
            model,
            systemPrompt,
          })
        : await ollamaPromptSuggestions({ model, systemPrompt });

    response.json({ suggestions });
  } catch (error) {
    response.status(502).json({ message: normalizeErrorMessage(error) });
  }
});

if (process.env.NODE_ENV === "production") {
  app.use(express.static(path.join(rootDir, "dist")));
  app.get("/{*splat}", (_request, response) => {
    response.sendFile(path.join(rootDir, "dist", "index.html"));
  });
}

const server = app.listen(port, () => {
  console.log(`Prompt Lab API listening on http://localhost:${port}`);
});

server.on("error", (error) => {
  console.error("Prompt Lab API failed to start:", error);
  process.exit(1);
});
