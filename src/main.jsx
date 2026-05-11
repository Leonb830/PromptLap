import React, { useEffect, useMemo, useRef, useState } from "react";
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

const promptRubric = [
  {
    id: "role",
    label: "Role clarity",
    max: 10,
    suggestion: "Name the role and the domain it specializes in.",
    evaluate: ({ text }) => {
      const hasRole = hasPattern(text, [/\byou are\b/i, /\bact as\b/i, /\byour role\b/i, /\bspecialist\b/i]);
      const hasDomain = hasPattern(text, [
        /\bcoach\b/i,
        /\btutor\b/i,
        /\breviewer\b/i,
        /\bsummarizer\b/i,
        /\bpartner\b/i,
        /\bexpert\b/i,
        /\bsenior\b/i
      ]);
      const score = hasRole && hasDomain ? 10 : hasRole ? 7 : hasDomain ? 5 : 0;
      return {
        score,
        detail:
          score >= 10
            ? "Role and specialty are explicit."
            : score
              ? "Role is partly clear; add a sharper specialty."
              : "The assistant's role is not yet clear."
      };
    }
  },
  {
    id: "outcome",
    label: "Outcome",
    max: 12,
    suggestion: "Describe the concrete result the agent should produce.",
    evaluate: ({ text }) => {
      const outcomeSignals = countPatternMatches(text, [
        /\bhelp\b/i,
        /\bcreate\b/i,
        /\bteach\b/i,
        /\bwrite\b/i,
        /\banswer\b/i,
        /\bimprove\b/i,
        /\bextract\b/i,
        /\breview\b/i,
        /\bproduce\b/i,
        /\bdeliver\b/i
      ]);
      const successSignals = hasPattern(text, [/\bsuccess\b/i, /\bgoal\b/i, /\boutcome\b/i, /\bresult\b/i]);
      const score = clampScore(outcomeSignals * 4 + (successSignals ? 4 : 0), 12);
      return {
        score,
        detail:
          score >= 10
            ? "Desired result is concrete."
            : score
              ? "Outcome is present; make success more measurable."
              : "Add the result this agent should produce."
      };
    }
  },
  {
    id: "audience",
    label: "Audience fit",
    max: 10,
    suggestion: "Mention who the agent serves and how to adapt to them.",
    evaluate: ({ text }) => {
      const hasAudience = hasPattern(text, [
        /\buser\b/i,
        /\blearner\b/i,
        /\bbeginner\b/i,
        /\bexpert\b/i,
        /\bdeveloper\b/i,
        /\breader\b/i,
        /\bstudent\b/i,
        /\bteam\b/i,
        /\bclient\b/i
      ]);
      const hasAdaptation = hasPattern(text, [/\badapt\b/i, /\blevel\b/i, /\btone\b/i, /\bneeds\b/i, /\bcontext\b/i]);
      const score = hasAudience && hasAdaptation ? 10 : hasAudience ? 7 : hasAdaptation ? 4 : 0;
      return {
        score,
        detail:
          score >= 10
            ? "Audience and adaptation are covered."
            : score
              ? "Audience is hinted at; add how the agent should adapt."
              : "Name the audience this prompt is for."
      };
    }
  },
  {
    id: "behavior",
    label: "Behavior rules",
    max: 12,
    suggestion: "Add specific rules for how the agent should respond.",
    evaluate: ({ text }) => {
      const behaviorSignals = countPatternMatches(text, [
        /\bconcise\b/i,
        /\bstep[- ]?by[- ]?step\b/i,
        /\bask\b/i,
        /\bwait\b/i,
        /\bsummarize\b/i,
        /\bprioritize\b/i,
        /\bexplain\b/i,
        /\bkeep\b/i,
        /\bfirst\b/i,
        /\bthen\b/i
      ]);
      const ruleSignals = countPatternMatches(text, [/\balways\b/i, /\bnever\b/i, /\bdo not\b/i, /\bwhen\b/i]);
      const score = clampScore(behaviorSignals * 2 + ruleSignals * 3, 12);
      return {
        score,
        detail:
          score >= 10
            ? "Response behavior is well directed."
            : score
              ? "Some behavior guidance is present; add clearer rules."
              : "Tell the agent how to behave in replies."
      };
    }
  },
  {
    id: "constraints",
    label: "Boundaries",
    max: 12,
    suggestion: "Set limits, exclusions, or refusal behavior.",
    evaluate: ({ text }) => {
      const constraintSignals = countPatternMatches(text, [
        /\bdo not\b/i,
        /\bdon't\b/i,
        /\bavoid\b/i,
        /\bunless\b/i,
        /\bonly\b/i,
        /\bmust\b/i,
        /\bshould not\b/i,
        /\bwithout\b/i
      ]);
      const safetySignals = hasPattern(text, [/\brefuse\b/i, /\bdecline\b/i, /\bunsafe\b/i, /\bprivate\b/i, /\bsensitive\b/i]);
      const score = clampScore(constraintSignals * 3 + (safetySignals ? 3 : 0), 12);
      return {
        score,
        detail:
          score >= 10
            ? "Limits and boundaries are clear."
            : score
              ? "Some limits exist; add edge cases or refusal rules."
              : "Add boundaries for what the agent should avoid."
      };
    }
  },
  {
    id: "format",
    label: "Output format",
    max: 10,
    suggestion: "Specify the structure, length, or format of the answer.",
    evaluate: ({ text, structureCount }) => {
      const formatSignals = countPatternMatches(text, [
        /\bformat\b/i,
        /\bstructure\b/i,
        /\bbullets?\b/i,
        /\btable\b/i,
        /\bjson\b/i,
        /\bmarkdown\b/i,
        /\bsections?\b/i,
        /\blist\b/i,
        /\btemplate\b/i
      ]);
      const lengthSignals = hasPattern(text, [/\bconcise\b/i, /\bshort\b/i, /\bbrief\b/i, /\b\d+\s+(sentences|paragraphs|bullets)\b/i]);
      const score = clampScore(formatSignals * 3 + structureCount * 2 + (lengthSignals ? 2 : 0), 10);
      return {
        score,
        detail:
          score >= 8
            ? "Output shape is defined."
            : score
              ? "Format is partly defined; add a clearer answer shape."
              : "Add formatting or length expectations."
      };
    }
  },
  {
    id: "examples",
    label: "Examples",
    max: 10,
    suggestion: "Include a sample input, output, or pattern to imitate.",
    evaluate: ({ text }) => {
      const hasExample = hasPattern(text, [/\bexample\b/i, /\bfor example\b/i, /\be\.g\.\b/i, /\bsample\b/i]);
      const hasInputOutput = hasPattern(text, [/\binput\b/i, /\boutput\b/i, /\bbefore\b/i, /\bafter\b/i]);
      const score = hasExample && hasInputOutput ? 10 : hasExample ? 7 : hasInputOutput ? 5 : 0;
      return {
        score,
        detail:
          score >= 10
            ? "Examples make the expected pattern concrete."
            : score
              ? "Example cues are present; add input/output detail."
              : "No example pattern is included."
      };
    }
  },
  {
    id: "context",
    label: "Context use",
    max: 8,
    suggestion: "Tell the agent what context to ask for or rely on.",
    evaluate: ({ text }) => {
      const contextSignals = countPatternMatches(text, [
        /\bcontext\b/i,
        /\bassumptions?\b/i,
        /\bmissing\b/i,
        /\bclarifying questions?\b/i,
        /\bbased on\b/i,
        /\bgiven\b/i,
        /\bprovided\b/i
      ]);
      const score = clampScore(contextSignals * 3, 8);
      return {
        score,
        detail:
          score >= 7
            ? "Context handling is explicit."
            : score
              ? "Some context handling exists; make it more actionable."
              : "Tell the agent how to handle missing context."
      };
    }
  },
  {
    id: "uncertainty",
    label: "Uncertainty",
    max: 8,
    suggestion: "Explain what to do when information is missing or uncertain.",
    evaluate: ({ text }) => {
      const uncertaintySignals = countPatternMatches(text, [
        /\buncertain\b/i,
        /\bunknown\b/i,
        /\bunsure\b/i,
        /\bassumption\b/i,
        /\bask\b/i,
        /\bclarify\b/i,
        /\bdo not invent\b/i,
        /\bdon't invent\b/i
      ]);
      const score = clampScore(uncertaintySignals * 3, 8);
      return {
        score,
        detail:
          score >= 7
            ? "Uncertainty behavior is covered."
            : score
              ? "Uncertainty is hinted at; add a stronger rule."
              : "Add guidance for uncertainty and missing facts."
      };
    }
  },
  {
    id: "evaluation",
    label: "Quality bar",
    max: 8,
    suggestion: "Define how the agent should judge a good answer.",
    evaluate: ({ text }) => {
      const qualitySignals = countPatternMatches(text, [
        /\bquality\b/i,
        /\bcriteria\b/i,
        /\bcheck\b/i,
        /\bverify\b/i,
        /\baccurate\b/i,
        /\bspecific\b/i,
        /\bclear\b/i,
        /\bpractical\b/i,
        /\bevidence\b/i
      ]);
      const score = clampScore(qualitySignals * 2, 8);
      return {
        score,
        detail:
          score >= 7
            ? "Quality expectations are clear."
            : score
              ? "Some quality language exists; add evaluation criteria."
              : "Add criteria for what makes a good response."
      };
    }
  }
];

function hasPattern(text, patterns) {
  return patterns.some((pattern) => pattern.test(text));
}

function countPatternMatches(text, patterns) {
  return patterns.reduce((total, pattern) => total + (pattern.test(text) ? 1 : 0), 0);
}

function clampScore(value, max) {
  return Math.max(0, Math.min(max, value));
}

function analyzePrompt(text) {
  const trimmed = text.trim();
  return {
    text,
    wordCount: trimmed ? trimmed.split(/\s+/).length : 0,
    structureCount: (text.match(/(^|\n)\s*(?:[-*]|\d+\.|[A-Z][A-Za-z ]{2,24}:)/g) || []).length
  };
}

function scorePrompt(text) {
  const analysis = analyzePrompt(text);
  const items = promptRubric.map((criterion) => {
    const result = criterion.evaluate(analysis);
    const score = clampScore(result.score, criterion.max);
    const ratio = criterion.max ? score / criterion.max : 0;

    return {
      ...criterion,
      score,
      detail: result.detail,
      status: ratio >= 0.75 ? "strong" : ratio >= 0.4 ? "partial" : "missing"
    };
  });
  const score = items.reduce((total, item) => total + item.score, 0);
  const maxScore = items.reduce((total, item) => total + item.max, 0);
  const percent = Math.round((score / maxScore) * 100);
  const missingItems = items.filter((item) => item.status !== "strong");
  const topSuggestion = missingItems.sort((a, b) => a.score / a.max - b.score / b.max)[0];

  return {
    items,
    score,
    maxScore,
    percent,
    value: score / maxScore,
    level: promptScoreLevel(percent),
    summary: promptScoreSummary(percent, analysis.wordCount, topSuggestion)
  };
}

function promptScoreLevel(percent) {
  if (percent >= 85) return "Strong";
  if (percent >= 65) return "Solid";
  if (percent >= 40) return "Needs focus";
  return "Early draft";
}

function promptScoreSummary(percent, wordCount, topSuggestion) {
  if (wordCount === 0) return "Start by naming the role, result, and audience.";
  if (percent >= 85) return "This prompt has clear guidance across most scoring areas.";
  if (topSuggestion) return topSuggestion.suggestion;
  return "Add one more concrete instruction to sharpen this prompt.";
}

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
  model: "openai/gpt-5.2-chat",
  rememberApiKey: false
};

const apiSettingsStorageKey = "prompt-lab-api-settings";
const apiKeyStorageKey = "prompt-lab-api-key";

const apiBaseUrl =
  import.meta.env.VITE_API_URL || "";

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
    const saved = JSON.parse(localStorage.getItem(apiSettingsStorageKey)) || {};
    const rememberApiKey = saved.rememberApiKey === true;
    const legacyApiKey = typeof saved.apiKey === "string" ? saved.apiKey : "";
    const storedApiKey =
      (rememberApiKey
        ? localStorage.getItem(apiKeyStorageKey)
        : sessionStorage.getItem(apiKeyStorageKey)) || legacyApiKey;
    const settings = {
      ...defaultApiSettings,
      ...saved,
      apiKey: typeof storedApiKey === "string" ? storedApiKey : "",
      rememberApiKey
    };
    settings.baseUrl = typeof settings.baseUrl === "string" ? settings.baseUrl : defaultApiSettings.baseUrl;
    settings.apiKey = typeof settings.apiKey === "string" ? settings.apiKey : "";
    settings.model = typeof settings.model === "string" ? settings.model : defaultApiSettings.model;

    if (settings.baseUrl === "https://api.openai.com/v1") {
      settings.baseUrl = defaultApiSettings.baseUrl;
    }

    if (settings.model === "gpt-5.5") {
      settings.model = defaultApiSettings.model;
    }

    localStorage.setItem(apiSettingsStorageKey, JSON.stringify(persistableApiSettings(settings)));
    if (settings.apiKey) {
      if (settings.rememberApiKey) {
        localStorage.setItem(apiKeyStorageKey, settings.apiKey);
      } else {
        sessionStorage.setItem(apiKeyStorageKey, settings.apiKey);
        localStorage.removeItem(apiKeyStorageKey);
      }
    }

    return settings;
  } catch {
    return defaultApiSettings;
  }
}

function persistableApiSettings(settings) {
  return {
    baseUrl: typeof settings.baseUrl === "string" ? settings.baseUrl : defaultApiSettings.baseUrl,
    model: typeof settings.model === "string" ? settings.model : defaultApiSettings.model,
    rememberApiKey: settings.rememberApiKey === true
  };
}

function persistApiSettings(settings, hasServerApiKey) {
  try {
    localStorage.setItem(
      apiSettingsStorageKey,
      JSON.stringify({
        ...persistableApiSettings(settings),
        rememberApiKey: hasServerApiKey ? false : settings.rememberApiKey === true
      })
    );

    if (hasServerApiKey || !settings.apiKey) {
      localStorage.removeItem(apiKeyStorageKey);
      sessionStorage.removeItem(apiKeyStorageKey);
      return;
    }

    if (settings.rememberApiKey) {
      localStorage.setItem(apiKeyStorageKey, settings.apiKey);
      sessionStorage.removeItem(apiKeyStorageKey);
    } else {
      sessionStorage.setItem(apiKeyStorageKey, settings.apiKey);
      localStorage.removeItem(apiKeyStorageKey);
    }
  } catch {
    // Storage may be unavailable in private browsing or restricted environments.
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

async function readChatStream(response, onToken) {
  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error("This browser could not read the streamed model response.");
  }

  const decoder = new TextDecoder();
  let buffer = "";

  async function readLine(line) {
    const trimmed = line.trim();
    if (!trimmed) return;

    const event = JSON.parse(trimmed);
    if (event.type === "token") {
      onToken(event.content || "");
      return;
    }

    if (event.type === "error") {
      throw new Error(event.message || "The streamed model response failed.");
    }
  }

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    for (const line of lines) {
      await readLine(line);
    }
  }

  buffer += decoder.decode();
  await readLine(buffer);
}

function App() {
  const [agents, setAgents] = useState(loadAgents);
  const [activeId, setActiveId] = useState(() => loadAgents()[0]?.id || "coach");
  const [models, setModels] = useState([]);
  const [apiModels, setApiModels] = useState([]);
  const [model, setModel] = useState("");
  const [provider, setProvider] = useState("ollama");
  const [apiSettings, setApiSettings] = useState(loadApiSettings);
  const [serverApiConfig, setServerApiConfig] = useState({
    hasServerApiKey: false,
    baseUrl: defaultApiSettings.baseUrl,
    model: defaultApiSettings.model
  });
  const [health, setHealth] = useState({ ok: false, message: "Checking Ollama..." });
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState("");
  const [agentDraft, setAgentDraft] = useState(() => createDraft(loadAgents()[0]));
  const [isEditingAgent, setIsEditingAgent] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);
  const [isScoreModalOpen, setIsScoreModalOpen] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isLoadingApiModels, setIsLoadingApiModels] = useState(false);
  const [apiModelStatus, setApiModelStatus] = useState({ type: "idle", message: "" });
  const [aiSuggestions, setAiSuggestions] = useState([]);
  const [isImprovingPrompt, setIsImprovingPrompt] = useState(false);
  const [suggestionStatus, setSuggestionStatus] = useState({ type: "idle", message: "" });
  const streamControllerRef = useRef(null);

  const activeAgent = agents.find((agent) => agent.id === activeId) || agents[0];
  const hasServerApiKey = serverApiConfig.hasServerApiKey;
  const hasClientApiKey = Boolean(apiSettings.apiKey.trim());
  const canUseApiCredentials =
    hasServerApiKey || (Boolean(apiSettings.baseUrl.trim()) && hasClientApiKey);
  const isApiReady =
    Boolean(apiSettings.model.trim()) && canUseApiCredentials;
  const promptText = isEditingAgent ? agentDraft.systemPrompt : activeAgent?.systemPrompt || "";

  const promptScore = useMemo(() => {
    return scorePrompt(promptText);
  }, [promptText]);

  useEffect(() => {
    localStorage.setItem("prompt-lab-agents", JSON.stringify(agents));
  }, [agents]);

  useEffect(() => {
    persistApiSettings(apiSettings, hasServerApiKey);
  }, [apiSettings, hasServerApiKey]);

  useEffect(() => {
    refreshOllama();
    refreshApiConfig();
  }, []);

  useEffect(() => {
    setAgentDraft(createDraft(activeAgent));
    setAiSuggestions([]);
    setSuggestionStatus({ type: "idle", message: "" });
  }, [activeAgent?.id]);

  async function refreshApiConfig() {
    try {
      const response = await fetch(apiUrl("/api/api-settings"));
      const data = await readApiJson(response, "Could not load API settings.");
      const nextConfig = {
        hasServerApiKey: Boolean(data.hasServerApiKey),
        baseUrl: typeof data.baseUrl === "string" && data.baseUrl ? data.baseUrl : defaultApiSettings.baseUrl,
        model: typeof data.model === "string" && data.model ? data.model : defaultApiSettings.model
      };

      setServerApiConfig(nextConfig);
      setApiSettings((current) => ({
        ...current,
        baseUrl: nextConfig.hasServerApiKey ? nextConfig.baseUrl : current.baseUrl,
        model:
          nextConfig.hasServerApiKey && current.model === defaultApiSettings.model
            ? nextConfig.model
            : current.model,
        apiKey: nextConfig.hasServerApiKey ? "" : current.apiKey,
        rememberApiKey: nextConfig.hasServerApiKey ? false : current.rememberApiKey
      }));

      if (nextConfig.hasServerApiKey) {
        setApiModelStatus({
          type: "success",
          message: "Server-managed API key is ready."
        });
      }
    } catch {
      setServerApiConfig((current) => ({ ...current, hasServerApiKey: false }));
    }
  }

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

  function apiCredentialPayload() {
    if (hasServerApiKey) return {};

    return {
      apiBaseUrl: apiSettings.baseUrl.trim(),
      apiKey: apiSettings.apiKey.trim()
    };
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

  function clearMessages() {
    streamControllerRef.current?.abort();
    setMessages([]);
  }

  async function refreshApiModels() {
    if (!canUseApiCredentials) return;

    setIsLoadingApiModels(true);
    setApiModelStatus({
      type: "loading",
      message: hasServerApiKey ? "Loading models with the server key..." : "Loading models from OpenRouter..."
    });
    try {
      const response = await fetch(apiUrl("/api/api-models"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(apiCredentialPayload())
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
    clearMessages();
  }

  function createAgentFromTemplate(template) {
    const nextAgent = agentFromTemplate(template);
    setAgents((current) => [nextAgent, ...current]);
    setActiveId(nextAgent.id);
    setAgentDraft(createDraft(nextAgent));
    setIsEditingAgent(true);
    setIsTemplateModalOpen(false);
    clearMessages();
  }

  function applyTemplateToDraft(template) {
    setAgentDraft(createDraft(template));
    setIsEditingAgent(true);
    setIsTemplateModalOpen(false);
    clearMessages();
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
    clearMessages();
  }

  function selectAgent(id) {
    setActiveId(id);
    setIsEditingAgent(false);
    clearMessages();
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
    clearMessages();
  }

  function duplicatePrompt() {
    navigator.clipboard?.writeText(activeAgent.systemPrompt);
  }

  function resetChat() {
    clearMessages();
    setDraft("");
  }

  function stopStreaming() {
    streamControllerRef.current?.abort();
  }

  async function improvePrompt() {
    const selectedModel = provider === "api" ? apiSettings.model.trim() : model;
    if (!promptText.trim() || !selectedModel || isImprovingPrompt) return;
    const apiPayload =
      provider === "api"
        ? apiCredentialPayload()
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
        ? apiCredentialPayload()
        : {};

    const nextMessages = [...messages, { id: crypto.randomUUID(), role: "user", content }];
    const assistantMessageId = crypto.randomUUID();
    let streamedContent = "";

    setMessages([
      ...nextMessages,
      { id: assistantMessageId, role: "assistant", content: "", isStreaming: true }
    ]);
    setDraft("");
    setIsSending(true);

    const controller = new AbortController();
    streamControllerRef.current = controller;

    function updateStreamingMessage(updates) {
      setMessages((current) =>
        current.map((message) =>
          message.id === assistantMessageId ? { ...message, ...updates } : message
        )
      );
    }

    try {
      const response = await fetch(apiUrl("/api/chat"), {
        method: "POST",
        signal: controller.signal,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider,
          model: selectedModel,
          systemPrompt: promptText,
          messages: nextMessages,
          stream: true,
          ...apiPayload
        })
      });

      if (!response.ok) {
        const data = await readApiJson(response, "The model did not respond.");
        throw new Error(data.message || "The model did not respond.");
      }

      await readChatStream(response, (token) => {
        streamedContent += token;
        updateStreamingMessage({ content: streamedContent });
      });

      updateStreamingMessage({
        content: streamedContent || "The model finished without returning text.",
        isStreaming: false
      });
    } catch (error) {
      const connectionName = provider === "api" ? "the configured AI API" : "Ollama";
      const wasStopped = controller.signal.aborted;
      const contentAfterError = wasStopped
        ? streamedContent || "Stopped before the model returned text."
        : streamedContent
          ? `${streamedContent}\n\n[Stream interrupted: ${error.message}]`
          : `I could not reach ${connectionName} for this request. ${error.message}`;

      updateStreamingMessage({
        content: contentAfterError,
        isStreaming: false
      });
    } finally {
      if (streamControllerRef.current === controller) {
        streamControllerRef.current = null;
      }
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
                    disabled={!canUseApiCredentials || isLoadingApiModels}
                    onClick={refreshApiModels}
                    title={
                      hasServerApiKey
                        ? "Load available models with the server key"
                        : "Load available models from OpenRouter"
                    }
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
                    readOnly={hasServerApiKey}
                    value={apiSettings.baseUrl}
                    onChange={(event) => updateApiSettings({ baseUrl: event.target.value })}
                    placeholder="OpenRouter API base URL"
                  />
                  {hasServerApiKey ? (
                    <div className="api-key-managed">
                      <CheckCircle2 size={16} />
                      <span>Server-managed API key</span>
                    </div>
                  ) : (
                    <>
                      <input
                        type="password"
                        value={apiSettings.apiKey}
                        onChange={(event) => updateApiSettings({ apiKey: event.target.value })}
                        placeholder="API key"
                      />
                      <label className="api-key-toggle">
                        <input
                          checked={apiSettings.rememberApiKey}
                          onChange={(event) => updateApiSettings({ rememberApiKey: event.target.checked })}
                          type="checkbox"
                        />
                        <span>Remember key on this device</span>
                      </label>
                    </>
                  )}
                </div>
                <p className={`api-model-status ${apiModelStatus.type}`}>
                  {apiModelStatus.message ||
                    (hasServerApiKey
                      ? "Click refresh to load models with the server-managed key."
                      : "API keys stay in this browser session unless you choose to remember them.")}
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
                      ? hasServerApiKey
                        ? "Server API key ready"
                        : "API mode ready"
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
                  {promptScore.percent}
                </strong>
                <small>/100</small>
              </div>
              <div className="score-body">
                <div className="score-heading">
                  <div>
                    <h3>Prompt score</h3>
                    <p>{promptScore.level}</p>
                  </div>
                  <strong>{Math.round(promptScore.score)}/{promptScore.maxScore}</strong>
                </div>
                <p className="score-summary">{promptScore.summary}</p>
                <button className="rubric-trigger" onClick={() => setIsScoreModalOpen(true)} type="button">
                  <Gauge size={16} />
                  View rubric
                </button>
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
                  <article
                    className={`message ${message.role} ${message.isStreaming ? "is-streaming" : ""} ${
                      message.isStreaming && !message.content ? "is-loading" : ""
                    }`}
                    key={message.id || `${message.role}-${index}`}
                    aria-live={message.isStreaming ? "polite" : undefined}
                  >
                    <span>{message.role === "user" ? "You" : activeAgent.name}</span>
                    <p>
                      {message.isStreaming && !message.content
                        ? `Thinking with ${provider === "api" ? apiSettings.model : model}...`
                        : message.content}
                    </p>
                  </article>
                ))
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
              {isSending ? (
                <button type="button" onClick={stopStreaming}>
                  <X size={18} />
                  Stop
                </button>
              ) : (
                <button
                  disabled={
                    !draft.trim() ||
                    (provider === "ollama" && !model) ||
                    (provider === "api" && !isApiReady)
                  }
                >
                  <Send size={18} />
                  Send
                </button>
              )}
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

      {isScoreModalOpen && (
        <div className="template-modal-backdrop" onClick={() => setIsScoreModalOpen(false)} role="presentation">
          <section
            className="template-modal score-modal"
            aria-labelledby="score-modal-title"
            aria-modal="true"
            role="dialog"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="template-modal-head">
              <div>
                <p className="eyebrow">Prompt scoring</p>
                <h2 id="score-modal-title">Rubric details</h2>
              </div>
              <button className="icon-button" onClick={() => setIsScoreModalOpen(false)} title="Close rubric">
                <X size={17} />
              </button>
            </div>

            <div className="score-modal-summary">
              <div className="score-ring" style={{ "--score": `${promptScore.value * 100}%` }}>
                <Gauge size={24} />
                <strong>{promptScore.percent}</strong>
                <small>/100</small>
              </div>
              <div>
                <h3>{promptScore.level}</h3>
                <p>{promptScore.summary}</p>
              </div>
              <strong>{Math.round(promptScore.score)}/{promptScore.maxScore}</strong>
            </div>

            <div className="score-list">
              {promptScore.items.map((item) => {
                const scorePercent = `${(item.score / item.max) * 100}%`;
                return (
                  <article className={`score-check is-${item.status}`} key={item.id}>
                    <div className="score-check-title">
                      {item.status === "strong" ? <CheckCircle2 size={15} /> : <Lightbulb size={15} />}
                      <strong>{item.label}</strong>
                      <span>{Math.round(item.score)}/{item.max}</span>
                    </div>
                    <p>{item.detail}</p>
                    <div className="score-check-bar" aria-hidden="true">
                      <span style={{ "--score": scorePercent }} />
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        </div>
      )}
    </main>
  );
}

createRoot(document.getElementById("root")).render(<App />);
