# Prompt Lab

A small local website for practicing AI prompting with Ollama or an OpenAI-compatible API. You can create minimal agents, edit their system prompts, and test follow-up prompts in a chat loop.

## Requirements

- Node.js 20+
- Ollama running locally with at least one pulled model, or an API key for an OpenAI-compatible chat API

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

## API Mode

Switch the connection type from `Ollama` to `API` in the top bar, then enter:

- API base URL, for example `https://api.openai.com/v1`
- API key
- Model name, for example `gpt-5.5`

The backend uses the official OpenAI Node SDK. Chat requests go through the Responses API with `client.responses.create`, and the model refresh button uses `client.models.list` to show model IDs available to your key. Once models are loaded, the model field becomes a dropdown and automatically selects an available model if the saved one is invalid. API settings are stored in this local browser's storage for convenience.

## What It Does

- Creates lightweight agents with only a name, goal, and system prompt.
- Saves agents in browser local storage.
- Lists local Ollama models through the backend.
- Sends the system prompt and chat history to Ollama or an OpenAI-compatible API for testing.
- Shows simple prompt checks for role, outcome, behavior, and audience.
