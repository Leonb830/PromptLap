import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  Bot,
  CheckCircle2,
  Copy,
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

function loadAgents() {
  try {
    const saved = JSON.parse(localStorage.getItem("prompt-lab-agents"));
    return Array.isArray(saved) && saved.length ? saved : starterAgents;
  } catch {
    return starterAgents;
  }
}

function createDraft(agent) {
  return {
    name: agent?.name || "",
    goal: agent?.goal || "",
    systemPrompt: agent?.systemPrompt || ""
  };
}

function App() {
  const [agents, setAgents] = useState(loadAgents);
  const [activeId, setActiveId] = useState(() => loadAgents()[0]?.id || "coach");
  const [models, setModels] = useState([]);
  const [model, setModel] = useState("");
  const [health, setHealth] = useState({ ok: false, message: "Checking Ollama..." });
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState("");
  const [agentDraft, setAgentDraft] = useState(() => createDraft(loadAgents()[0]));
  const [isEditingAgent, setIsEditingAgent] = useState(false);
  const [isSending, setIsSending] = useState(false);

  const activeAgent = agents.find((agent) => agent.id === activeId) || agents[0];

  const promptScore = useMemo(() => {
    const passed = promptChecks.filter((check) => check.test(activeAgent?.systemPrompt || ""));
    return { passed, total: promptChecks.length, value: passed.length / promptChecks.length };
  }, [activeAgent]);

  useEffect(() => {
    localStorage.setItem("prompt-lab-agents", JSON.stringify(agents));
  }, [agents]);

  useEffect(() => {
    refreshOllama();
  }, []);

  useEffect(() => {
    setAgentDraft(createDraft(activeAgent));
  }, [activeAgent?.id]);

  async function refreshOllama() {
    setHealth({ ok: false, message: "Checking Ollama..." });
    try {
      const [healthResponse, modelsResponse] = await Promise.all([
        fetch("/api/health"),
        fetch("/api/models")
      ]);
      const healthData = await healthResponse.json();
      const modelsData = await modelsResponse.json();
      setHealth(healthData);
      setModels(modelsData.models || []);
      setModel((current) => current || modelsData.models?.[0]?.name || "");
    } catch {
      setHealth({
        ok: false,
        message: "Ollama is not reachable. Start Ollama and pull a model before chatting."
      });
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

  async function sendMessage(event) {
    event.preventDefault();
    const content = draft.trim();
    if (!content || !activeAgent || !model || isSending) return;

    const nextMessages = [...messages, { role: "user", content }];
    setMessages(nextMessages);
    setDraft("");
    setIsSending(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model,
          systemPrompt: activeAgent.systemPrompt,
          messages: nextMessages
        })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "The model did not respond.");
      setMessages((current) => [...current, data]);
    } catch (error) {
      setMessages((current) => [
        ...current,
        {
          role: "assistant",
          content: `I could not reach Ollama for this request. ${error.message}`
        }
      ]);
    } finally {
      setIsSending(false);
    }
  }

  return (
    <main className="app-shell">
      <aside className="agent-rail" aria-label="Agents">
        <div className="brand-block">
          <div className="brand-mark">
            <Sparkles size={20} />
          </div>
          <div>
            <p className="eyebrow">Prompt Lab</p>
            <h1>Agent practice desk</h1>
          </div>
        </div>

        <button className="primary-action" onClick={createAgent}>
          <Plus size={18} />
          New agent
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
            <p className="eyebrow">Local Ollama model</p>
            <div className="model-row">
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
            </div>
          </div>
          <div className={`status-pill ${health.ok ? "is-online" : ""}`}>
            <span />
            {health.ok ? "Ollama ready" : health.message}
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
                    const passed = check.test(activeAgent.systemPrompt);
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
                  <p>Thinking with {model}...</p>
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
              <button disabled={!draft.trim() || !model || isSending}>
                <Send size={18} />
                Send
              </button>
            </form>
          </section>
        </div>
      </section>
    </main>
  );
}

createRoot(document.getElementById("root")).render(<App />);
