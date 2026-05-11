# Prompt Lab

A small local website for practicing AI prompting with Ollama or OpenRouter. You can create minimal agents, edit their system prompts, and test follow-up prompts in a chat loop.

## Requirements

- Node.js 20+
- Ollama running locally with at least one pulled model, or an OpenRouter API key

Here is how to install node.js 'https://nodejs.org/en/download'

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

- API base URL, for example `https://openrouter.ai/api/v1`
- API key
- Model name, for example `openai/gpt-5.2-chat`

The backend uses the OpenAI Node SDK against OpenRouter's OpenAI-compatible API with `baseURL: "https://openrouter.ai/api/v1"`. Chat and prompt-improvement requests use `openai.chat.completions.create`, and the model refresh button uses `openai.models.list` so you do not need to hardcode a model. Once models are loaded, the model field becomes a dropdown and automatically selects an available model if the saved one is invalid.

API keys are kept in this browser session by default. Enable `Remember key on this device` only if you want the key stored locally. For safer local use, configure the key on the server instead:

```bash
OPENROUTER_API_KEY=your_key npm run dev
```

You can also set `OPENROUTER_BASE_URL` and `OPENROUTER_MODEL`. When `OPENROUTER_API_KEY` is present, the browser does not send or store an API key, and the backend uses the server-configured API base URL.

## What It Does

- Creates lightweight agents with only a name, goal, and system prompt.
- Saves agents in browser local storage.
- Lists local Ollama models through the backend.
- Streams the system prompt and chat history to Ollama or OpenRouter for testing.
- Scores prompts with a weighted rubric for role, outcome, audience, boundaries, format, examples, context, uncertainty, and quality criteria.
