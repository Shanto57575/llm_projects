# Customer Support Chatbot with Memory

A learning project built with LangChain to explore conversational AI, chat memory, message history management, response streaming, and conversation summarization.

The goal of this project was not to build a production-ready customer support platform, but to gain hands-on experience with core LangChain concepts that are commonly used in modern AI applications.

## Features

* Multi-turn customer support chatbot
* Streaming responses
* Session-based chat history
* Automatic conversation summarization
* Context-aware responses using memory
* Streamlit interface for quick experimentation

## Tech Stack

* Python
* LangChain
* Mistral AI
* Groq
* Streamlit

## Concepts Learned

### 1. Prompt Templates

Used `ChatPromptTemplate` to define system instructions and dynamically inject user messages and conversation history.

### 2. LCEL (LangChain Expression Language)

Built chains using the pipe (`|`) operator:

```python
prompt | llm | parser
```

Learned how data flows through prompts, models, and output parsers.

### 3. Message History

Implemented session-based conversation memory using:

* `RunnableWithMessageHistory`
* `MessagesPlaceholder`
* `InMemoryChatMessageHistory`

Learned how previous messages are automatically injected into prompts.

### 4. Streaming

Streamed model responses token-by-token instead of waiting for the complete answer.

Learned how real-world chat applications provide a responsive user experience.

### 5. Memory Management

Explored the challenges of long conversations and context-window limitations.

Implemented custom summarization logic that:

* Summarizes older messages
* Keeps recent messages intact
* Reduces token usage
* Preserves important conversation context

### 6. Custom Memory Implementation

Created a custom `SummarizingHistory` class by extending LangChain's message history system.

Learned how to customize memory retrieval behavior by overriding `aget_messages()`.

### 7. Context Window Optimization

Learned multiple approaches for handling long conversations:

* Full history memory
* Sliding window memory
* Summary memory
* Retrieval-based memory

Implemented summary memory in this project.

## Project Structure

```text
.
├── app.py
├── memory.py
├── .env
├── requirements.txt
└── README.md
```

## Screenshot

Add a screenshot of the Streamlit interface here.

```markdown
![Application Screenshot](./screenshots/api_ui.png)
```

## Key Takeaways

This project helped me understand:

* How conversational memory works
* How LangChain manages chat history
* Why summarization is needed for long conversations
* How streaming responses work
* How to customize memory behavior
* How LCEL chains are constructed and executed

This project serves as a foundation for future projects involving Retrieval-Augmented Generation (RAG), AI agents, and LangGraph workflows.
