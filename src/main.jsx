import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  BrainCircuit,
  Bot,
  CheckCircle2,
  Copy,
  FileText,
  FlaskConical,
  Gauge,
  Lightbulb,
  MessageSquarePlus,
  Pencil,
  Plus,
  RefreshCw,
  Save,
  Send,
  Sparkles,
  Trash2,
  Wand2,
  X
} from "lucide-react";
import "./styles.css";

const starterAgents = [
  {
    id: "coach",
    name: "Prompt Coach",
    goal: "Improve prompts with direct, practical feedback.",
    systemPrompt:
      "You are a concise prompt coach. Help the user improve system prompts and follow-up prompts. Explain what works, what is vague, and give one sharper rewrite. Be practical and encouraging.",
    createdAt: Date.now()
  },
  {
    id: "socratic",
    name: "Socratic Tutor",
    goal: "Teach by asking one useful question at a time.",
    systemPrompt:
      "You are a patient Socratic tutor. Ask one focused question at a time. Do not give the full answer immediately. Adapt to the learner's level and summarize progress after every three replies.",
    createdAt: Date.now() + 1
  }
];

const promptChecks = [
  {
    label: "Role",
    test: (text) => /\byou are\b|\bact as\b|\brole\b/i.test(text),
    hint: "Name the agent's role."
  },
  {
    label: "Outcome",
    test: (text) => /\bhelp\b|\bcreate\b|\bteach\b|\bwrite\b|\banswer\b|\bimprove\b/i.test(text),
    hint: "Say what success looks like."
  },
  {
    label: "Behavior",
    test: (text) => /\bconcise\b|\bstep\b|\bask\b|\bdo not\b|\balways\b|\bwhen\b/i.test(text),
    hint: "Add behavior rules or boundaries."
  },
  {
    label: "Audience",
    test: (text) => /\buser\b|\blearner\b|\bbeginner\b|\bexpert\b|\bdeveloper\b|\breader\b/i.test(text),
    hint: "Mention who it serves."
  }
];

const followUpIdeas = [
  "Rewrite your last answer for a beginner.",
  "Ask me three clarifying questions before answering.",
  "Critique your answer against the system prompt.",
  "Give a better follow-up prompt I could have used."
];

const promptTemplates = [
  {
    id: "socratic-tutor",
    name: "Socratic Tutor",
    category: "Learning",
    goal: "Teach concepts by asking focused questions and adapting to the learner.",
    systemPrompt:
      "You are a patient Socratic tutor. Help the user learn by asking one focused question at a time before giving direct answers. Adapt to the learner's current understanding, correct misconceptions gently, and summarize progress after every three replies. Keep explanations clear, concrete, and encouraging."
  },
  {
    id: "writing-coach",
    name: "Writing Coach",
    category: "Writing",
    goal: "Improve drafts with concise, practical writing feedback.",
    systemPrompt:
      "You are a sharp but supportive writing coach. Help the user improve clarity, structure, tone, and precision. First identify the strongest part of the draft, then name the biggest improvement opportunity, then provide a revised version. Keep feedback specific and avoid rewriting more than needed."
  },
  {
    id: "code-reviewer",
    name: "Code Reviewer",
    category: "Development",
    goal: "Review code for bugs, risks, missing tests, and maintainability.",
    systemPrompt:
      "You are a senior code reviewer. Prioritize bugs, security risks, behavioral regressions, missing tests, and maintainability concerns. Give findings first, ordered by severity, with concrete file or function references when available. Keep style feedback secondary and suggest minimal, practical fixes."
  },
  {
    id: "research-summarizer",
    name: "Research Summarizer",
    category: "Research",
    goal: "Turn messy source material into concise summaries and open questions.",
    systemPrompt:
      "You are a careful research summarizer. Extract the key claims, supporting evidence, uncertainties, and useful follow-up questions from the user's material. Separate facts from interpretation, call out weak evidence, and end with a short summary that a busy reader can scan quickly."
  },
  {
    id: "interview-practice",
    name: "Interview Practice",
    category: "Career",
    goal: "Run realistic interview practice with feedback after each answer.",
    systemPrompt:
      "You are an interview practice partner. Ask one realistic interview question at a time, wait for the user's answer, then give concise feedback on clarity, specificity, and evidence. Suggest a stronger answer using the STAR format when helpful. Keep the tone calm and confidence-building."
  }
];

const defaultApiSettings = {
  baseUrl: "https://openrouter.ai/api/v1",
  apiKey: "",
  model: "openai/gpt-5.2-chat"
};

const apiBaseUrl =
  import.meta.env.VITE_API_URL || (import.meta.env.DEV ? "http://localhost:3001" : "");

function loadAgents() {
  try {
    const saved = JSON.parse(localStorage.getItem("prompt-lab-agents"));
    const validAgents = Array.isArray(saved)
      ? saved
          .filter((agent) => agent && typeof agent === "object")
          .map((agent, index) => ({
            id: typeof agent.id === "string" && agent.id ? agent.id : `saved-agent-${index + 1}`,
            name: typeof agent.name === "string" && agent.name.trim() ? agent.name : "Untitled agent",
            goal: typeof agent.goal === "string" && agent.goal.trim() ? agent.goal : "No learning goal set.",
            systemPrompt:
              typeof agent.systemPrompt === "string" && agent.systemPrompt.trim()
                ? agent.systemPrompt
                : "You are a helpful assistant. Ask for missing context and answer clearly.",
            createdAt: Number.isFinite(agent.createdAt) ? agent.createdAt : Date.now() + index
          }))
      : [];
    return validAgents.length ? validAgents : starterAgents;
  } catch {
    return starterAgents;
  }
}

function loadApiSettings() {
  try {
    const saved = JSON.parse(localStorage.getItem("prompt-lab-api-settings")) || {};
    const settings = { ...defaultApiSettings, ...saved };
    settings.baseUrl = typeof settings.baseUrl === "string" ? settings.baseUrl : defaultApiSettings.baseUrl;
    settings.apiKey = typeof settings.apiKey === "string" ? settings.apiKey : "";
    settings.model = typeof settings.model === "string" ? settings.model : defaultApiSettings.model;

    if (settings.baseUrl === "https://api.openai.com/v1") {
      settings.baseUrl = defaultApiSettings.baseUrl;
    }

    if (settings.model === "gpt-5.5") {
      settings.model = defaultApiSettings.model;
    }

    return settings;
  } catch {
    return defaultApiSettings;
  }
}

function createDraft(agent) {
  return {
    name: agent?.name || "",
    goal: agent?.goal || "",
    systemPrompt: agent?.systemPrompt || ""
  };
}

function agentFromTemplate(template) {
  return {
    id: crypto.randomUUID(),
    name: template.name,
    goal: template.goal,
    systemPrompt: template.systemPrompt,
    createdAt: Date.now()
  };
}

function SidebarIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
      <path d="M0 3a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2zm5-1v12h9a1 1 0 0 0 1-1V3a1 1 0 0 0-1-1zM4 2H2a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h2z" />
    </svg>
  );
}

async function readApiJson(response, fallbackMessage) {
  const text = await response.text();
  const contentType = response.headers.get("content-type") || "";

  if (contentType.includes("application/json")) {
    return text ? JSON.parse(text) : {};
  }

  if (text.trim().startsWith("<!DOCTYPE") || text.trim().startsWith("<html")) {
    throw new Error("The app received HTML instead of API JSON. Restart `npm run dev` so the Express API routes are active.");
  }

  if (!response.ok) {
    throw new Error(text || fallbackMessage);
  }

  throw new Error(fallbackMessage);
}

function apiUrl(path) {
  return `${apiBaseUrl}${path}`;
}

function App() {
  const [agents, setAgents] = useState(loadAgents);
  const [activeId, setActiveId] = useState(() => loadAgents()[0]?.id || "coach");
  const [models, setModels] = useState([]);
  const [apiModels, setApiModels] = useState([]);
  const [model, setModel] = useState("");
  const [provider, setProvider] = useState("ollama");
  const [apiSettings, setApiSettings] = useState(loadApiSettings);
  const [health, setHealth] = useState({ ok: false, message: "Checking Ollama..." });
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState("");
  const [agentDraft, setAgentDraft] = useState(() => createDraft(loadAgents()[0]));
  const [isEditingAgent, setIsEditingAgent] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isLoadingApiModels, setIsLoadingApiModels] = useState(false);
  const [apiModelStatus, setApiModelStatus] = useState({ type: "idle", message: "" });
  const [aiSuggestions, setAiSuggestions] = useState([]);
  const [isImprovingPrompt, setIsImprovingPrompt] = useState(false);
  const [suggestionStatus, setSuggestionStatus] = useState({ type: "idle", message: "" });

  const activeAgent = agents.find((agent) => agent.id === activeId) || agents[0];
  const isApiReady =
    Boolean(apiSettings.baseUrl.trim()) && Boolean(apiSettings.apiKey.trim()) && Boolean(apiSettings.model.trim());
  const promptText = isEditingAgent ? agentDraft.systemPrompt : activeAgent?.systemPrompt || "";

  const promptScore = useMemo(() => {
    const passed = promptChecks.filter((check) => check.test(promptText));
    return { passed, total: promptChecks.length, value: passed.length / promptChecks.length };
  }, [promptText]);

  useEffect(() => {
    localStorage.setItem("prompt-lab-agents", JSON.stringify(agents));
  }, [agents]);

  useEffect(() => {
    localStorage.setItem("prompt-lab-api-settings", JSON.stringify(apiSettings));
  }, [apiSettings]);

  useEffect(() => {
    refreshOllama();
  }, []);

  useEffect(() => {
    setAgentDraft(createDraft(activeAgent));
    setAiSuggestions([]);
    setSuggestionStatus({ type: "idle", message: "" });
  }, [activeAgent?.id]);

  async function refreshOllama() {
    setHealth({ ok: false, message: "Checking Ollama..." });
    try {
      const [healthResponse, modelsResponse] = await Promise.all([
        fetch(apiUrl("/api/health")),
        fetch(apiUrl("/api/models"))
      ]);
      const healthData = await readApiJson(healthResponse, "Could not check Ollama health.");
      const modelsData = await readApiJson(modelsResponse, "Could not load Ollama models.");
      const nextModels = modelsData.models || [];
      setHealth(healthData);
      setModels(nextModels);
      setModel((current) =>
        nextModels.some((item) => item.name === current) ? current : nextModels[0]?.name || ""
      );
    } catch {
      setModels([]);
      setModel("");
      setHealth({
        ok: false,
        message: "Ollama is not reachable. Start Ollama and pull a model before chatting."
      });
    }
  }

  function updateApiSettings(updates) {
    setApiSettings((current) => ({ ...current, ...updates }));
    if (Object.hasOwn(updates, "baseUrl") || Object.hasOwn(updates, "apiKey")) {
      setApiModels([]);
    }
    setApiModelStatus({ type: "idle", message: "" });
  }

  function applyPromptSuggestion(suggestionId, snippet) {
    setAgentDraft((current) => {
      const existing = current.systemPrompt.trim();
      const separator = existing ? "\n" : "";
      return { ...current, systemPrompt: `${existing}${separator}${snippet}` };
    });
    setAiSuggestions((current) => {
      const remaining = current.filter((suggestion) => suggestion.id !== suggestionId);
      setSuggestionStatus({
        type: remaining.length ? "success" : "empty",
        message: remaining.length
          ? `${remaining.length} suggestions remaining.`
          : "All current suggestions have been applied."
      });
      return remaining;
    });
    setIsEditingAgent(true);
  }

  async function refreshApiModels() {
    if (!apiSettings.baseUrl.trim() || !apiSettings.apiKey.trim()) return;

    setIsLoadingApiModels(true);
    setApiModelStatus({ type: "loading", message: "Loading models from OpenRouter..." });
    try {
      const response = await fetch(apiUrl("/api/api-models"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          apiBaseUrl: apiSettings.baseUrl.trim(),
          apiKey: apiSettings.apiKey.trim()
        })
      });
      const data = await readApiJson(response, "Could not load API models.");
      if (!response.ok) throw new Error(data.message || "Could not load API models.");
      const nextModels = data.models || [];
      setApiModels(nextModels);
      if (nextModels.length && !nextModels.some((item) => item.name === apiSettings.model.trim())) {
        updateApiSettings({ model: nextModels[0].name });
      }
      setApiModelStatus({
        type: nextModels.length ? "success" : "error",
        message: nextModels.length
          ? `${nextModels.length} models loaded. Choose one from the dropdown.`
          : "OpenRouter returned no models for this key."
      });
    } catch (error) {
      setApiModels([]);
      setApiModelStatus({ type: "error", message: error.message });
    } finally {
      setIsLoadingApiModels(false);
    }
  }

  function createAgent() {
    const nextAgent = {
      id: crypto.randomUUID(),
      name: `Agent ${agents.length + 1}`,
      goal: "Describe the agent's learning purpose.",
      systemPrompt:
        "You are a helpful specialist. State your assumptions, ask for missing context when needed, and give clear next steps.",
      createdAt: Date.now()
    };
    setAgents((current) => [nextAgent, ...current]);
    setActiveId(nextAgent.id);
    setAgentDraft(createDraft(nextAgent));
    setIsEditingAgent(true);
    setMessages([]);
  }

  function createAgentFromTemplate(template) {
    const nextAgent = agentFromTemplate(template);
    setAgents((current) => [nextAgent, ...current]);
    setActiveId(nextAgent.id);
    setAgentDraft(createDraft(nextAgent));
    setIsEditingAgent(true);
    setIsTemplateModalOpen(false);
    setMessages([]);
  }

  function applyTemplateToDraft(template) {
    setAgentDraft(createDraft(template));
    setIsEditingAgent(true);
    setIsTemplateModalOpen(false);
    setMessages([]);
  }

  function deleteAgent(id) {
    if (agents.length === 1) return;
    const agent = agents.find((item) => item.id === id);
    const confirmed = window.confirm(`Delete "${agent?.name || "this agent"}"? This cannot be undone.`);
    if (!confirmed) return;

    const remaining = agents.filter((agent) => agent.id !== id);
    setAgents(remaining);
    setActiveId(remaining[0].id);
    setIsEditingAgent(false);
    setMessages([]);
  }

  function selectAgent(id) {
    setActiveId(id);
    setIsEditingAgent(false);
    setMessages([]);
  }

  function startEditingAgent() {
    setAgentDraft(createDraft(activeAgent));
    setIsEditingAgent(true);
  }

  function cancelEditingAgent() {
    setAgentDraft(createDraft(activeAgent));
    setIsEditingAgent(false);
  }

  function saveAgent() {
    const updates = {
      name: agentDraft.name.trim() || "Untitled agent",
      goal: agentDraft.goal.trim() || "No learning goal set.",
      systemPrompt: agentDraft.systemPrompt.trim()
    };

    if (!updates.systemPrompt) {
      updates.systemPrompt = "You are a helpful assistant. Ask for missing context and answer clearly.";
    }

    setAgents((current) =>
      current.map((agent) => (agent.id === activeAgent.id ? { ...agent, ...updates } : agent))
    );
    setIsEditingAgent(false);
    setMessages([]);
  }

  function duplicatePrompt() {
    navigator.clipboard?.writeText(activeAgent.systemPrompt);
  }

  function resetChat() {
    setMessages([]);
    setDraft("");
  }

  async function improvePrompt() {
    const selectedModel = provider === "api" ? apiSettings.model.trim() : model;
    if (!promptText.trim() || !selectedModel || isImprovingPrompt) return;
    const apiPayload =
      provider === "api"
        ? {
            apiBaseUrl: apiSettings.baseUrl.trim(),
            apiKey: apiSettings.apiKey.trim()
          }
        : {};

    setIsImprovingPrompt(true);
    setSuggestionStatus({ type: "loading", message: "Thinking about this prompt..." });

    try {
      const response = await fetch(apiUrl("/api/prompt-suggestions"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider,
          model: selectedModel,
          systemPrompt: promptText,
          ...apiPayload
        })
      });
      const data = await readApiJson(response, "Could not improve this prompt.");
      if (!response.ok) throw new Error(data.message || "Could not improve this prompt.");

      const nextSuggestions = data.suggestions || [];
      setAiSuggestions(nextSuggestions);
      setSuggestionStatus({
        type: nextSuggestions.length ? "success" : "empty",
        message: nextSuggestions.length
          ? `${nextSuggestions.length} suggestions ready.`
          : "The AI thinks this prompt is already in solid shape."
      });
    } catch (error) {
      setAiSuggestions([]);
      setSuggestionStatus({ type: "error", message: error.message });
    } finally {
      setIsImprovingPrompt(false);
    }
  }

  async function sendMessage(event) {
    event.preventDefault();
    const content = draft.trim();
    const selectedModel = provider === "api" ? apiSettings.model.trim() : model;
    if (!content || !activeAgent || !selectedModel || isSending) return;
    const apiPayload =
      provider === "api"
        ? {
            apiBaseUrl: apiSettings.baseUrl.trim(),
            apiKey: apiSettings.apiKey.trim()
          }
        : {};

    const nextMessages = [...messages, { role: "user", content }];
    setMessages(nextMessages);
    setDraft("");
    setIsSending(true);

    try {
      const response = await fetch(apiUrl("/api/chat"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider,
          model: selectedModel,
          systemPrompt: promptText,
          messages: nextMessages,
          ...apiPayload
        })
      });
      const data = await readApiJson(response, "The model did not respond.");
      if (!response.ok) throw new Error(data.message || "The model did not respond.");
      setMessages((current) => [...current, data]);
    } catch (error) {
      const connectionName = provider === "api" ? "the configured AI API" : "Ollama";
      setMessages((current) => [
        ...current,
        {
          role: "assistant",
          content: `I could not reach ${connectionName} for this request. ${error.message}`
        }
      ]);
    } finally {
      setIsSending(false);
    }
  }

  return (
    <main className={`app-shell ${isSidebarCollapsed ? "is-sidebar-collapsed" : ""}`}>
      <aside className="agent-rail" aria-label="Agents">
        <div className="sidebar-head">
          <div className="brand-block">
            <div className="brand-mark">
              <Sparkles size={20} />
            </div>
            <div className="sidebar-copy">
              <p className="eyebrow">Prompt Lab</p>
              <h1>Agent practice desk</h1>
            </div>
          </div>
          <button
            className="sidebar-toggle"
            onClick={() => setIsSidebarCollapsed((current) => !current)}
            title={isSidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            aria-label={isSidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            aria-pressed={isSidebarCollapsed}
          >
            <SidebarIcon />
          </button>
        </div>

        <button className="primary-action" onClick={createAgent}>
          <Plus size={18} />
          <span>New agent</span>
        </button>

        <div className="agent-list">
          {agents.map((agent) => (
            <button
              className={`agent-card ${agent.id === activeAgent.id ? "is-active" : ""}`}
              key={agent.id}
              onClick={() => selectAgent(agent.id)}
            >
              <Bot size={18} />
              <span>
                <strong>{agent.name}</strong>
                <small>{agent.goal}</small>
              </span>
            </button>
          ))}
        </div>
      </aside>

      <section className="workspace">
        <header className="topbar">
          <div>
            <p className="eyebrow">{provider === "ollama" ? "Local Ollama model" : "API model"}</p>
            <div className="provider-toggle" aria-label="AI connection type">
              <button
                className={provider === "ollama" ? "is-active" : ""}
                onClick={() => setProvider("ollama")}
                type="button"
              >
                <Bot size={15} />
                Ollama
              </button>
              <button
                className={provider === "api" ? "is-active" : ""}
                onClick={() => setProvider("api")}
                type="button"
              >
                <BrainCircuit size={15} />
                API
              </button>
            </div>
            <div className="model-row">
              {provider === "ollama" ? (
                <>
                  <select value={model} onChange={(event) => setModel(event.target.value)}>
                    <option value="">No model found</option>
                    {models.map((item) => (
                      <option key={item.name} value={item.name}>
                        {item.name}
                      </option>
                    ))}
                  </select>
                  <button className="icon-button" onClick={refreshOllama} title="Refresh Ollama">
                    <RefreshCw size={17} />
                  </button>
                </>
              ) : (
                <>
                  {apiModels.length ? (
                    <select
                      value={apiSettings.model}
                      onChange={(event) => updateApiSettings({ model: event.target.value })}
                    >
                      {apiModels.map((item) => (
                        <option key={item.name} value={item.name}>
                          {item.name}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      value={apiSettings.model}
                      onChange={(event) => updateApiSettings({ model: event.target.value })}
                      placeholder="Load models or type one manually"
                    />
                  )}
                  <button
                    className="icon-button"
                    disabled={!apiSettings.baseUrl.trim() || !apiSettings.apiKey.trim() || isLoadingApiModels}
                    onClick={refreshApiModels}
                    title="Load available models from OpenRouter"
                  >
                    <RefreshCw size={17} />
                  </button>
                </>
              )}
            </div>
            {provider === "api" && (
              <>
                <div className="api-settings">
                  <input
                    value={apiSettings.baseUrl}
                    onChange={(event) => updateApiSettings({ baseUrl: event.target.value })}
                    placeholder="OpenRouter API base URL"
                  />
                  <input
                    type="password"
                    value={apiSettings.apiKey}
                    onChange={(event) => updateApiSettings({ apiKey: event.target.value })}
                    placeholder="API key"
                  />
                </div>
                <p className={`api-model-status ${apiModelStatus.type}`}>
                  {apiModelStatus.message || "Click refresh to load models available to this API key."}
                </p>
              </>
            )}
          </div>
          <div
            className={`status-pill ${
              provider === "api"
                ? apiModelStatus.type === "success" || (isApiReady && apiModelStatus.type !== "error")
                  ? "is-online"
                  : ""
                : health.ok
                  ? "is-online"
                  : ""
            }`}
          >
            <span />
            {provider === "api"
              ? isLoadingApiModels
                ? "Loading API models..."
                : apiModelStatus.type === "error"
                  ? "API model load failed"
                  : apiModels.length
                    ? `${apiModels.length} API models loaded`
                    : isApiReady
                      ? "API mode ready"
                      : "Add API URL, key, and model"
              : health.ok
                ? "Ollama ready"
                : health.message}
          </div>
        </header>

        <div className="main-grid">
          <section className="builder-panel">
            <div className="panel-heading">
              <div>
                <p className="eyebrow">Agent setup</p>
                <h2>{activeAgent.name}</h2>
              </div>
              <div className="tool-row">
                <button className="icon-button" onClick={duplicatePrompt} title="Copy system prompt">
                  <Copy size={17} />
                </button>
                {isEditingAgent ? (
                  <>
                    <button className="icon-button" onClick={cancelEditingAgent} title="Cancel edits">
                      <X size={17} />
                    </button>
                    <button className="icon-button save" onClick={saveAgent} title="Save agent">
                      <Save size={17} />
                    </button>
                  </>
                ) : (
                  <button className="icon-button" onClick={startEditingAgent} title="Edit agent">
                    <Pencil size={17} />
                  </button>
                )}
                <button
                  className="icon-button danger"
                  disabled={agents.length === 1}
                  onClick={() => deleteAgent(activeAgent.id)}
                  title={agents.length === 1 ? "Keep at least one agent" : "Delete agent"}
                >
                  <Trash2 size={17} />
                </button>
              </div>
            </div>

            <label>
              Agent name
              <input
                readOnly={!isEditingAgent}
                value={isEditingAgent ? agentDraft.name : activeAgent.name}
                onChange={(event) => setAgentDraft((current) => ({ ...current, name: event.target.value }))}
              />
            </label>

            <label>
              Learning goal
              <input
                readOnly={!isEditingAgent}
                value={isEditingAgent ? agentDraft.goal : activeAgent.goal}
                onChange={(event) => setAgentDraft((current) => ({ ...current, goal: event.target.value }))}
              />
            </label>

            <label className="prompt-field">
              System prompt
              <textarea
                readOnly={!isEditingAgent}
                value={isEditingAgent ? agentDraft.systemPrompt : activeAgent.systemPrompt}
                onChange={(event) =>
                  setAgentDraft((current) => ({ ...current, systemPrompt: event.target.value }))
                }
                spellCheck="true"
              />
            </label>

            <div className="suggestion-panel">
              <div className="suggestion-head">
                <div>
                  <p className="eyebrow">Inline suggestions</p>
                  <h3>Sharpen this prompt as you write</h3>
                </div>
                <button
                  className="improve-button"
                  disabled={
                    isImprovingPrompt ||
                    !promptText.trim() ||
                    (provider === "ollama" && !model) ||
                    (provider === "api" && !isApiReady)
                  }
                  onClick={improvePrompt}
                  type="button"
                >
                  {isImprovingPrompt && <span className="spinner" aria-hidden="true" data-icon="inline-start" />}
                  {isImprovingPrompt ? "Loading..." : "Improve"}
                </button>
              </div>
              <p className={`suggestion-status ${suggestionStatus.type}`}>
                {suggestionStatus.message || "Ask the active model to review this system prompt and suggest sharper wording."}
              </p>
              {aiSuggestions.length ? (
                <div className="suggestion-list">
                  {aiSuggestions.map((suggestion) => (
                    <article className="suggestion-card" key={suggestion.id}>
                      <div>
                        <strong>{suggestion.label}</strong>
                        <p>{suggestion.hint}</p>
                      </div>
                      <button
                        onClick={() => applyPromptSuggestion(suggestion.id, suggestion.snippet)}
                        type="button"
                      >
                        <Wand2 size={14} />
                        Apply
                      </button>
                    </article>
                  ))}
                </div>
              ) : suggestionStatus.type === "empty" ? (
                <p className="suggestion-empty">
                  This prompt already covers the main basics: role, audience, boundaries, and structure.
                </p>
              ) : null}
            </div>

            <button className="template-trigger" onClick={() => setIsTemplateModalOpen(true)} type="button">
              <FileText size={16} />
              Prompt templates
            </button>

            <div className="score-panel">
              <div className="score-ring" style={{ "--score": `${promptScore.value * 100}%` }}>
                <Gauge size={24} />
                <strong>
                  {promptScore.passed.length}/{promptScore.total}
                </strong>
              </div>
              <div>
                <h3>Prompt shape</h3>
                <div className="check-grid">
                  {promptChecks.map((check) => {
                    const passed = check.test(promptText);
                    return (
                      <span className={passed ? "check is-passed" : "check"} key={check.label}>
                        {passed ? <CheckCircle2 size={15} /> : <Lightbulb size={15} />}
                        {passed ? check.label : check.hint}
                      </span>
                    );
                  })}
                </div>
              </div>
            </div>
          </section>

          <section className="test-panel">
            <div className="panel-heading">
              <div>
                <p className="eyebrow">Conversation test</p>
                <h2>Try follow-up prompts</h2>
              </div>
              <button className="secondary-action" onClick={resetChat}>
                <FlaskConical size={17} />
                Reset
              </button>
            </div>

            <div className="chat-window">
              {messages.length === 0 ? (
                <div className="empty-chat">
                  <MessageSquarePlus size={34} />
                  <h3>Start with a realistic task</h3>
                  <p>
                    Then refine with follow-ups to see whether the system prompt keeps the agent on track.
                  </p>
                </div>
              ) : (
                messages.map((message, index) => (
                  <article className={`message ${message.role}`} key={`${message.role}-${index}`}>
                    <span>{message.role === "user" ? "You" : activeAgent.name}</span>
                    <p>{message.content}</p>
                  </article>
                ))
              )}
              {isSending && (
                <article className="message assistant is-loading">
                  <span>{activeAgent.name}</span>
                  <p>Thinking with {provider === "api" ? apiSettings.model : model}...</p>
                </article>
              )}
            </div>

            <div className="idea-strip">
              {followUpIdeas.map((idea) => (
                <button key={idea} onClick={() => setDraft(idea)}>
                  <Wand2 size={14} />
                  {idea}
                </button>
              ))}
            </div>

            <form className="composer" onSubmit={sendMessage}>
              <textarea
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                placeholder="Write an initial task or a follow-up prompt..."
              />
              <button
                disabled={
                  !draft.trim() ||
                  isSending ||
                  (provider === "ollama" && !model) ||
                  (provider === "api" && !isApiReady)
                }
              >
                <Send size={18} />
                Send
              </button>
            </form>
          </section>
        </div>
      </section>

      {isTemplateModalOpen && (
        <div className="template-modal-backdrop" onClick={() => setIsTemplateModalOpen(false)} role="presentation">
          <section
            className="template-modal"
            aria-labelledby="template-modal-title"
            aria-modal="true"
            role="dialog"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="template-modal-head">
              <div>
                <p className="eyebrow">Prompt templates</p>
                <h2 id="template-modal-title">Start from a proven pattern</h2>
              </div>
              <button className="icon-button" onClick={() => setIsTemplateModalOpen(false)} title="Close templates">
                <X size={17} />
              </button>
            </div>

            <div className="template-grid">
              {promptTemplates.map((template) => (
                <article className="template-card" key={template.id}>
                  <div>
                    <span>{template.category}</span>
                    <strong>{template.name}</strong>
                    <p>{template.goal}</p>
                  </div>
                  <div className="template-actions">
                    <button onClick={() => createAgentFromTemplate(template)} type="button">
                      <Plus size={14} />
                      New
                    </button>
                    <button onClick={() => applyTemplateToDraft(template)} type="button">
                      <FileText size={14} />
                      Apply
                    </button>
                  </div>
                </article>
              ))}
            </div>
          </section>
        </div>
      )}
    </main>
  );
}

createRoot(document.getElementById("root")).render(<App />);
