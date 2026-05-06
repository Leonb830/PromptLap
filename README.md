# Prompt Lab

A small local website for practicing AI prompting with Ollama. You can create minimal agents, edit their system prompts, and test follow-up prompts in a chat loop.

## Requirements

- Node.js 20+
- Ollama running locally
- At least one pulled Ollama model

## Run

```bash
npm install
npm run dev
```

Open the Vite URL, usually `http://localhost:5173`.

If Ollama is not on the default URL, point the backend at it:

```bash
OLLAMA_URL=http://127.0.0.1:11434 npm run dev
```

Pull a model if the model menu is empty:

```bash
ollama pull llama3.2
```

## What It Does

- Creates lightweight agents with only a name, goal, and system prompt.
- Saves agents in browser local storage.
- Lists local Ollama models through the backend.
- Sends the system prompt and chat history to Ollama for testing.
- Shows simple prompt checks for role, outcome, behavior, and audience.
