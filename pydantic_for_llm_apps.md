# Pydantic for LLM Applications — A Complete Crash Course

*Covers Pydantic v2 (current stable: 2.13.x), the version every modern AI/LLM Python stack — FastAPI, LangChain, LangGraph, OpenAI SDK, Anthropic SDK, Instructor, Pydantic AI — is built on.*

---

## Part 0 — Why Pydantic Exists

### The problem

Python is dynamically typed. At runtime, nothing stops you from doing this:

```python
def create_user(name, age):
    return {"name": name, "age": age}

create_user(123, "thirty")  # runs fine, silently wrong
```

Type hints alone (`def create_user(name: str, age: int)`) don't help — they're documentation for humans and static tools like mypy, but **Python does not enforce them at runtime**. When your data comes from the outside world — a JSON request body, an LLM's text output, a config file, an environment variable, a database row — you have no guarantee it matches your expectations at all.

This is *exactly* the situation every LLM application lives in:

- An LLM emits text that is *supposed* to be JSON matching a schema, but sometimes has missing fields, wrong types, or extra hallucinated keys.
- A RAG pipeline pulls documents from a vector store where metadata fields are optional/inconsistent.
- A FastAPI endpoint receives arbitrary JSON from the internet.
- An agent framework passes state between graph nodes, and a bug in one node can silently corrupt data for every downstream node.

You need something that sits at the *boundary* of your system and says: "data coming in gets validated and coerced into the exact shape I expect, or I get a clear, structured error immediately — not a `KeyError` three functions later."

### What Pydantic actually is

Pydantic is a **data validation and settings management library** that uses standard Python type hints to:

1. **Validate** — check that input data matches a schema, raising detailed errors if not.
2. **Coerce/parse** — convert compatible input into the correct type (e.g., `"123"` → `123` for an `int` field, per configurable strictness).
3. **Serialize** — turn Python objects back into dicts/JSON, with fine control over what's included.
4. **Generate JSON Schema** — automatically produce a schema describing your data model, which is the exact artifact OpenAI/Anthropic function-calling and structured-output APIs consume.

Under the hood, Pydantic v2's validation core (`pydantic-core`) is written in Rust, making it fast enough to sit on the hot path of every request in production APIs — a big reason it's the default choice for FastAPI, and increasingly for LLM-facing code.

### Why it matters specifically for LLM applications

| LLM app need | How Pydantic solves it |
|---|---|
| Force a model to return structured JSON | Define a `BaseModel`; auto-generate JSON Schema; pass to OpenAI/Anthropic structured output APIs |
| Validate/repair an LLM's output | `Model.model_validate_json(llm_output)` — fails loudly and specifically if the LLM hallucinated a field or type |
| Type-safe agent/graph state | LangGraph, Pydantic AI, and custom orchestration all use `BaseModel`s as the "shape" of state passed between steps |
| API layer around your LLM app | FastAPI uses Pydantic models for request/response validation and auto-generates OpenAPI docs from them |
| Configuration & secrets | `pydantic-settings` loads API keys, model names, temperature, etc. from env vars/`.env` with validation |
| Tool/function calling schemas | Pydantic models → JSON Schema is the exact format OpenAI, Anthropic, and Instructor expect for tool definitions |

By the end of this course you'll be able to use all of the above confidently.

---

## Part 1 — Foundations

### 1.1 Your First Model

```python
from pydantic import BaseModel

class User(BaseModel):
    name: str
    age: int
    is_active: bool = True   # field with a default
```

`BaseModel` is the core building block. Every field is declared with a standard Python type annotation. Fields without a default are **required**; fields with a default are **optional**.

**Creating and validating an instance:**

```python
user = User(name="Shanto", age=30)
print(user)               # name='Shanto' age=30 is_active=True
print(user.age)            # 30 (an actual int, not a string)

# Coercion: Pydantic will parse compatible types
user2 = User(name="Ana", age="30")   # "30" -> 30 (str -> int coercion)
print(user2.age, type(user2.age))     # 30 <class 'int'>
```

**Invalid data raises a structured error immediately:**

```python
from pydantic import ValidationError

try:
    User(name="Bad", age="not-a-number")
except ValidationError as e:
    print(e)
```

```
1 validation error for User
age
  Input should be a valid integer, unable to parse string as an integer
  [type=int_parsing, input_value='not-a-number', input_type=str]
```

This is the core value proposition: **fail fast, fail with detail, fail at the boundary** — not deep inside your business logic.

**Why this matters for LLM apps:** when an LLM returns JSON, you rarely trust it blindly. You parse it into a Pydantic model. If it's wrong, you get a precise, structured error you can log, retry on, or feed back to the LLM ("your last response had a validation error: `age` — ...").

### 1.2 Parsing From Different Sources

You'll almost never build a model field-by-field like `User(name=..., age=...)` in real apps. Instead, you parse from dicts or JSON strings — exactly what you get back from an LLM or an HTTP request.

```python
data = {"name": "Shanto", "age": 30}
user = User.model_validate(data)          # from a dict

json_str = '{"name": "Shanto", "age": 30}'
user = User.model_validate_json(json_str) # from a JSON string (this is the one you'll use constantly with LLM output)
```

> **Common mistake:** using the deprecated v1 APIs `User.parse_obj(data)` / `User.parse_raw(json_str)`. These still work in v2 (with a deprecation warning) but you should use `model_validate` / `model_validate_json` in all new code.

**Real-world pattern — validating raw LLM text output:**

```python
import json
from pydantic import BaseModel, ValidationError

class ExtractedInvoice(BaseModel):
    vendor: str
    total_amount: float
    invoice_number: str

llm_output = call_llm(prompt)  # returns a string, hopefully JSON

try:
    invoice = ExtractedInvoice.model_validate_json(llm_output)
except ValidationError as e:
    # Log the specific errors, maybe retry with the error appended to the prompt
    print(e.errors())
```

`e.errors()` returns a list of structured dicts (not just a string), which is exactly what you want to programmatically feed back into a "self-correction" retry loop for an LLM agent.

### 1.3 Serialization: Going Back Out

```python
user.model_dump()          # -> dict: {'name': 'Shanto', 'age': 30, 'is_active': True}
user.model_dump_json()     # -> JSON string
user.model_dump_json(indent=2)
```

**Selective serialization** (very common when returning API responses that shouldn't leak internal fields, like a hashed password or an internal document ID from a vector store):

```python
user.model_dump(include={"name"})
user.model_dump(exclude={"is_active"})
user.model_dump(exclude_none=True)   # drop fields that are None — great for optional LLM-extracted fields
```

> **Best practice:** in LLM apps that extract structured data where many fields may be legitimately absent, `exclude_none=True` keeps your API responses / logs clean instead of full of `null`s.

---

## Part 2 — Field Customization

### 2.1 `Field()` — Constraints, Defaults, Metadata

Plain type hints tell Pydantic *what type* a value should be. `Field()` lets you add validation constraints, default values, aliases, and descriptions (the descriptions matter a lot for LLM structured output — more on that in Part 5).

```python
from pydantic import BaseModel, Field

class Product(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    price: float = Field(gt=0, description="Price in USD, must be positive")
    quantity: int = Field(default=0, ge=0)
    sku: str = Field(pattern=r"^[A-Z]{3}-\d{4}$")
```

- `...` (Ellipsis) means "required, no default" — equivalent to just not passing `default`.
- Numeric constraints: `gt`, `ge`, `lt`, `le`, `multiple_of`.
- String constraints: `min_length`, `max_length`, `pattern` (regex).
- `description` is not just documentation — it flows straight into the generated JSON Schema, which is what an LLM sees when you use it for structured outputs or tool calling. **A good `description` measurably improves LLM extraction accuracy.**

> **Common mistake:** writing `name: str = Field(min_length=1)` and forgetting this makes it required already (no need for `...` explicitly in v2 — `Field(min_length=1)` alone is required since there's no `default`). Only add `...` for clarity/readability if you like; it's optional now.

### 2.2 Default Factories (Avoiding Mutable Default Bugs)

```python
from pydantic import BaseModel, Field
from datetime import datetime

class ChatMessage(BaseModel):
    role: str
    content: str
    tags: list[str] = Field(default_factory=list)     # NOT tags: list[str] = []
    created_at: datetime = Field(default_factory=datetime.utcnow)
```

Never write `tags: list[str] = []` directly as a default in Python generally — mutable defaults are shared across instances. Pydantic actually protects you from the classic Python bug here (it deep-copies simple defaults), but `default_factory` is still the idiomatic, explicit way to express "compute a fresh default per instance," and it's required for anything that isn't a simple immutable value.

### 2.3 Optional Fields and `None`

```python
from typing import Optional

class Comment(BaseModel):
    text: str
    parent_id: Optional[int] = None   # can be int or None, defaults to None
    # Modern equivalent (Python 3.10+):
    edited_at: datetime | None = None
```

> **Common mistake:** `Optional[int]` does **not** mean "not required." It means "can be `None`." If you write `parent_id: Optional[int]` with no default, it's still *required* — the caller must explicitly pass `None` or a value. To make a field truly optional-and-defaulting-to-None, you need both: `Optional[int] = None`.

This distinction matters enormously for LLM extraction schemas: if a field might legitimately be absent from a document, you want `Optional[X] = None`, not just `Optional[X]`.

### 2.4 Field Aliases (mapping external names to Python names)

LLM APIs, JSON APIs, and JS-based frontends often use `camelCase` or vendor-specific key names that don't match Python's `snake_case` convention.

```python
from pydantic import BaseModel, ConfigDict, Field

class OpenAIToolCall(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    tool_call_id: str = Field(alias="id")
    function_name: str = Field(alias="name")

data = {"id": "call_123", "name": "search_docs"}
call = OpenAIToolCall.model_validate(data)   # works via alias
print(call.tool_call_id)                      # 'call_123'

# populate_by_name=True also lets you construct using the Python name:
call2 = OpenAIToolCall(tool_call_id="call_456", function_name="search_web")
```

This is exactly the pattern you use constantly when wrapping raw OpenAI/Anthropic API JSON responses in typed models.

---

## Part 3 — Nested & Composite Data (The Bread and Butter of LLM Schemas)

Real LLM extraction/agent schemas are rarely flat. You need lists, nested objects, unions, and enums.

### 3.1 Nested Models

```python
from pydantic import BaseModel

class Address(BaseModel):
    street: str
    city: str
    country: str

class Customer(BaseModel):
    name: str
    address: Address              # nested model — validated recursively
    shipping_addresses: list[Address] = []

data = {
    "name": "Shanto",
    "address": {"street": "123 Main St", "city": "Chattogram", "country": "BD"},
    "shipping_addresses": [
        {"street": "456 Other St", "city": "Dhaka", "country": "BD"}
    ],
}
customer = Customer.model_validate(data)
print(customer.address.city)   # 'Chattogram' — real Address object, not a dict
```

Nesting is validated recursively and errors report the *full path* to the problem:

```
1 validation error for Customer
address.city
  Field required [type=missing, ...]
```

This nested-path error reporting is invaluable when validating a large, deeply nested JSON structure an LLM produced — you know exactly which sub-object is broken.

### 3.2 Enums for Constrained Categories

A very common LLM pattern: classify text into one of a fixed set of categories.

```python
from enum import Enum
from pydantic import BaseModel

class Sentiment(str, Enum):
    POSITIVE = "positive"
    NEGATIVE = "negative"
    NEUTRAL = "neutral"

class SentimentResult(BaseModel):
    sentiment: Sentiment
    confidence: float = Field(ge=0, le=1)
```

Inheriting from `str` alongside `Enum` (a "string enum") means the value serializes as a plain string in JSON — important, because raw `Enum` serializes awkwardly and LLM structured-output JSON Schemas expect a simple `"enum": [...]` constraint on a string.

If the LLM emits `"sentiment": "positive"`, Pydantic validates it against the allowed enum values and rejects anything else — a great guardrail against classification hallucination (e.g., the model inventing `"somewhat positive"`).

### 3.3 Unions and Discriminated Unions (Critical for Agent/Tool Routing)

A plain `Union` tries each type in order:

```python
from typing import Union

class TextContent(BaseModel):
    type: str
    text: str

class ImageContent(BaseModel):
    type: str
    url: str

class Message(BaseModel):
    content: Union[TextContent, ImageContent]
```

This works, but it's ambiguous and slow for more than 2-3 branches: Pydantic has to try each candidate model in turn. For LLM agent tool-routing / multi-content-type message schemas, use a **discriminated union**, tagging each variant with a `Literal` field Pydantic can use to pick the exact branch in one step:

```python
from typing import Literal, Union
from pydantic import BaseModel, Field
from typing import Annotated

class TextContent(BaseModel):
    type: Literal["text"] = "text"
    text: str

class ImageContent(BaseModel):
    type: Literal["image"] = "image"
    url: str

class ToolCallContent(BaseModel):
    type: Literal["tool_call"] = "tool_call"
    tool_name: str
    arguments: dict

Content = Annotated[
    Union[TextContent, ImageContent, ToolCallContent],
    Field(discriminator="type"),
]

class Message(BaseModel):
    role: str
    content: list[Content]
```

**Why this matters for agents:** this is precisely the shape of "one of several possible action types" that LangGraph nodes, OpenAI's content blocks, and Anthropic's content blocks all use. Discriminated unions give you:
- Correct, unambiguous parsing (no accidental matching of the wrong branch).
- Much better/faster validation error messages (Pydantic knows immediately which branch was intended based on `type`, so it reports errors against *that* branch only).
- A clean JSON Schema with a proper `oneOf` + discriminator — which maps well to how LLM structured-output specs describe tagged unions.

> **Common mistake:** using a bare `Union[A, B, C]` for agent action types and being confused by validation errors that seem to reference the wrong model, or by unpredictable branch selection when two models have overlapping optional fields. Discriminated unions fix this entirely — use them whenever variants have a natural "kind"/"type" tag, which is nearly always true in agent/tool schemas.

### 3.4 `Literal` for Fixed String/Value Sets

```python
from typing import Literal

class ModelConfig(BaseModel):
    provider: Literal["openai", "anthropic", "google"]
    model_name: str
```

`Literal` is a lighter-weight alternative to `Enum` when you just need a closed set of exact values without needing enum members elsewhere in your code (e.g., matching an LLM API's `role` field: `Literal["user", "assistant", "system", "tool"]`).

---

## Part 4 — Validators: Custom Validation Logic

Field constraints (`gt`, `pattern`, etc.) cover simple cases. Real LLM data cleaning needs custom logic: stripping whitespace, normalizing casing, cross-field checks, and repairing common LLM output quirks.

### 4.1 `field_validator` — Validate/Transform a Single Field

```python
from pydantic import BaseModel, field_validator

class Article(BaseModel):
    title: str
    tags: list[str]

    @field_validator("title")
    @classmethod
    def title_must_not_be_empty(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("title cannot be empty or whitespace")
        return v

    @field_validator("tags")
    @classmethod
    def normalize_tags(cls, v: list[str]) -> list[str]:
        return [tag.strip().lower() for tag in v]
```

Key points:
- Validators are `@classmethod`s (the first arg is `cls`, not `self` — you don't have access to other field values yet at this stage by default).
- Raise `ValueError` (or `AssertionError`) to signal invalid data — Pydantic wraps it into a proper `ValidationError` automatically.
- **Return the value** — whatever you return becomes the field's final value. This is how you clean/normalize LLM output (e.g., strip markdown code fences the model added around JSON, lowercase a category, trim whitespace).

**Real-world LLM pattern — stripping markdown fences from an LLM's "JSON" response:**

```python
from pydantic import BaseModel, field_validator
import json

class LLMExtractionRaw(BaseModel):
    raw_json: str

    @field_validator("raw_json")
    @classmethod
    def strip_markdown_fences(cls, v: str) -> str:
        v = v.strip()
        if v.startswith("```"):
            v = v.split("\n", 1)[1] if "\n" in v else v
            v = v.rsplit("```", 1)[0]
        return v.strip()
```

(In practice you'd more often do this cleanup *before* calling `model_validate_json`, but it illustrates the pattern of validators-as-cleaners.)

### 4.2 `mode="before"` vs `mode="after"`

```python
from pydantic import BaseModel, field_validator

class Score(BaseModel):
    value: int

    @field_validator("value", mode="before")
    @classmethod
    def coerce_percent_string(cls, v):
        # runs BEFORE Pydantic's own type coercion, so v can be anything
        if isinstance(v, str) and v.endswith("%"):
            return int(v.rstrip("%"))
        return v
```

- `mode="before"` (default for custom pre-processing): runs *before* Pydantic's built-in type validation, so `v` is the raw input — useful for handling messy/inconsistent LLM outputs (`"85%"`, `85`, `"85"` all becoming `85`).
- `mode="after"` (the default when unspecified is actually "after" for standard usage shown in 4.1 — Pydantic already coerced `v` to the annotated type): runs after type coercion — `v` is guaranteed to already be an `int`/`str`/etc., so you only need to add semantic checks/transforms.

> **Best practice:** use `mode="before"` when you need to handle multiple possible *raw* input shapes from an LLM (a classic case: the model returns a number as a string, a percentage, or with currency symbols). Use `mode="after"` for everything else — it's simpler because you trust the type.

### 4.3 `model_validator` — Cross-Field Validation

Sometimes validity depends on the relationship *between* fields — something a single-field validator can't see.

```python
from pydantic import BaseModel, model_validator

class DateRange(BaseModel):
    start_date: str
    end_date: str

    @model_validator(mode="after")
    def check_date_order(self) -> "DateRange":
        if self.end_date < self.start_date:
            raise ValueError("end_date must be after start_date")
        return self
```

- `mode="after"`: runs once all individual fields have already been validated; `self` is the (nearly complete) model instance — return `self`.
- `mode="before"`: runs on the raw input dict *before* any field validation — useful for restructuring/renaming keys the LLM used inconsistently (e.g., the model sometimes calls a field `"start"` and sometimes `"start_date"`).

```python
    @model_validator(mode="before")
    @classmethod
    def normalize_keys(cls, data):
        if isinstance(data, dict) and "start" in data and "start_date" not in data:
            data["start_date"] = data.pop("start")
        return data
```

**Real-world agent/RAG pattern:** validating that a retrieved-context answer actually cites at least one of the retrieved document IDs it was given:

```python
class RAGAnswer(BaseModel):
    answer: str
    cited_doc_ids: list[str]
    available_doc_ids: list[str]

    @model_validator(mode="after")
    def citations_must_exist(self) -> "RAGAnswer":
        unknown = set(self.cited_doc_ids) - set(self.available_doc_ids)
        if unknown:
            raise ValueError(f"Cited unknown document IDs: {unknown}")
        return self
```

This is a real, load-bearing guardrail pattern in production RAG systems: it catches citation hallucination structurally, not by hoping the prompt was followed.

---

## Part 5 — Structured Outputs for LLMs (The Core of This Course)

This is the single most important practical skill for LLM engineering with Pydantic: **turning a `BaseModel` into a schema an LLM provider understands, and getting a validated instance back.**

### 5.1 The Underlying Mechanism: JSON Schema

Every Pydantic model can produce its JSON Schema:

```python
from pydantic import BaseModel, Field

class WeatherQuery(BaseModel):
    """Extract a location and date range from a weather question."""
    location: str = Field(description="City name")
    start_date: str = Field(description="ISO 8601 date")
    days: int = Field(default=1, ge=1, le=14, description="Number of days to forecast")

print(WeatherQuery.model_json_schema())
```

This produces a JSON Schema object with `type`, `properties`, `required`, and — crucially — every `description` you wrote. **This is literally the artifact that OpenAI's `response_format`/tool schemas and Anthropic's tool `input_schema` consume.** Writing clear field `description`s is not just good practice — it is directly, measurably part of your prompt engineering.

### 5.2 OpenAI SDK — Structured Outputs

The modern OpenAI Python SDK has native Pydantic integration via `.parse()`:

```python
from openai import OpenAI
from pydantic import BaseModel

client = OpenAI()

class EventInfo(BaseModel):
    name: str
    date: str
    location: str
    attendee_count: int | None = None

completion = client.chat.completions.parse(
    model="gpt-4.1",
    messages=[
        {"role": "system", "content": "Extract event details."},
        {"role": "user", "content": "The AI Summit is happening March 3rd in Berlin, expecting 500 people."},
    ],
    response_format=EventInfo,
)

event = completion.choices[0].message.parsed   # already an EventInfo instance!
print(event.name, event.date, event.attendee_count)
```

There is no manual `json.loads` + `model_validate` step needed — the SDK does it for you and guarantees (via constrained decoding on OpenAI's side) that the output matches the schema. `message.parsed` is `None` if the model refused; check `message.refusal` in that case.

### 5.3 Anthropic SDK — Tool Use for Structured Extraction

The Anthropic SDK doesn't (as of now) have a `.parse()` shortcut baked in the same way, but the pattern of "define a Pydantic model → derive a tool schema → force its use → validate the result" is standard and simple to write yourself:

```python
import anthropic
from pydantic import BaseModel

client = anthropic.Anthropic()

class EventInfo(BaseModel):
    name: str
    date: str
    location: str

schema = EventInfo.model_json_schema()

response = client.messages.create(
    model="claude-sonnet-4-6",
    max_tokens=1024,
    tools=[{
        "name": "extract_event",
        "description": "Extract structured event information.",
        "input_schema": schema,
    }],
    tool_choice={"type": "tool", "name": "extract_event"},  # force this tool
    messages=[{"role": "user", "content": "AI Summit, March 3rd, Berlin."}],
)

tool_block = next(b for b in response.content if b.type == "tool_use")
event = EventInfo.model_validate(tool_block.input)
```

Notice the pattern is identical in spirit across providers: **model → schema → constrained generation → `model_validate`**. Once you internalize this loop, you can plug in any LLM provider.

### 5.4 The `instructor` Library — This Pattern, Automated

`instructor` is a widely-used library that patches OpenAI/Anthropic/etc. clients to accept a `response_model=YourPydanticModel` argument directly, and automatically retries on validation failure by feeding the error back to the LLM:

```python
import instructor
from openai import OpenAI
from pydantic import BaseModel

client = instructor.from_openai(OpenAI())

class UserInfo(BaseModel):
    name: str
    age: int

user_info = client.chat.completions.create(
    model="gpt-4.1",
    response_model=UserInfo,
    messages=[{"role": "user", "content": "Extract: Shanto is 30 years old"}],
)
print(user_info.name, user_info.age)   # a validated UserInfo, guaranteed
```

`instructor`'s automatic-retry-on-`ValidationError` loop is a good pattern to understand and can be replicated manually: catch `ValidationError`, format `e.errors()` into the next prompt turn asking the model to fix its output, and re-call.

### 5.5 Handling Partial / Streaming Structured Output

LLM structured output is often streamed token-by-token, meaning you may have *incomplete* JSON mid-stream. Two common approaches:

1. **Validate only at the end**, once the full JSON is assembled — simplest, but no progressive UI updates.
2. **Use partial-parsing helpers** (e.g., `instructor`'s `Partial[Model]`, which makes all fields `Optional` internally so incomplete JSON still validates) to progressively render fields as they arrive.

```python
from instructor import Partial

partial_stream = client.chat.completions.create_partial(
    model="gpt-4.1",
    response_model=Partial[UserInfo],
    messages=[...],
)
for partial_user in partial_stream:
    print(partial_user)   # fields fill in progressively, others are None
```

> **Common mistake:** trying to `model_validate_json` on a text chunk mid-stream with a normal (non-partial) model — this will fail because the JSON is syntactically incomplete. Either buffer until complete, or use a partial/streaming-aware model variant.

---

## Part 6 — Pydantic in FastAPI (The Typical LLM App Backend)

FastAPI uses Pydantic models as the *entire* mechanism for request validation, response validation, and OpenAPI docs generation. If you're building an API around your LLM app, this is where Pydantic and your web framework meet.

```python
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

app = FastAPI()

class ChatRequest(BaseModel):
    message: str = Field(min_length=1, max_length=4000)
    conversation_id: str | None = None
    temperature: float = Field(default=0.7, ge=0.0, le=2.0)

class ChatResponse(BaseModel):
    reply: str
    conversation_id: str
    tokens_used: int

@app.post("/chat", response_model=ChatResponse)
async def chat(request: ChatRequest) -> ChatResponse:
    # request is ALREADY validated — invalid input never reaches this line;
    # FastAPI auto-returns a 422 with structured error details instead.
    reply_text = await run_llm(request.message, temperature=request.temperature)
    return ChatResponse(
        reply=reply_text,
        conversation_id=request.conversation_id or "new-convo-id",
        tokens_used=count_tokens(reply_text),
    )
```

- `ChatRequest` validates the incoming body automatically — malformed JSON, missing `message`, or `temperature=5.0` (out of range) never reach your function body; FastAPI returns a `422 Unprocessable Entity` with the Pydantic error detail baked in.
- `response_model=ChatResponse` validates *outgoing* data too, and also filters/shapes it — if your function accidentally returns extra internal fields, they're stripped.
- The interactive docs (`/docs`) are generated straight from these models' JSON Schemas — the same mechanism used for LLM structured outputs (Part 5). This is a nice conceptual unification: **the same modeling skill produces your API contract and your LLM output contract.**

**Streaming an LLM response through FastAPI** (validation still happens on the request; streamed tokens themselves usually bypass per-chunk Pydantic validation for performance, validated as a whole only if/when reassembled):

```python
from fastapi.responses import StreamingResponse

@app.post("/chat/stream")
async def chat_stream(request: ChatRequest):
    async def token_generator():
        async for token in stream_llm(request.message):
            yield token
    return StreamingResponse(token_generator(), media_type="text/plain")
```

---

## Part 7 — Pydantic in LangChain & LangGraph

### 7.1 LangChain — Structured Output Chains

LangChain's `with_structured_output` uses a Pydantic model exactly the way you'd expect — you get an instance back instead of raw text:

```python
from langchain_openai import ChatOpenAI
from pydantic import BaseModel, Field

class MovieReview(BaseModel):
    title: str
    rating: int = Field(ge=1, le=10)
    summary: str

llm = ChatOpenAI(model="gpt-4.1")
structured_llm = llm.with_structured_output(MovieReview)

result = structured_llm.invoke("Review: Inception is a mind-bending thriller. 9/10.")
print(result.rating)   # 9, and it's an actual int
```

### 7.2 LangChain Tools Defined With Pydantic

Tool *arguments* schemas in LangChain are commonly defined via Pydantic, so the LLM's function-calling schema is derived straight from your model (again, same underlying JSON Schema mechanism from Part 5):

```python
from langchain.tools import StructuredTool
from pydantic import BaseModel, Field

class SearchInput(BaseModel):
    query: str = Field(description="The search query")
    max_results: int = Field(default=5, ge=1, le=20)

def web_search(query: str, max_results: int = 5) -> list[str]:
    ...

search_tool = StructuredTool.from_function(
    func=web_search,
    name="web_search",
    description="Search the web for information",
    args_schema=SearchInput,
)
```

### 7.3 LangGraph — State Is (Usually) a Pydantic Model or `TypedDict`

LangGraph passes a **state object** between graph nodes. You can define it as a `TypedDict` (LangGraph's original default) or, increasingly, as a Pydantic `BaseModel` when you want runtime validation of state transitions, not just static typing:

```python
from pydantic import BaseModel
from langgraph.graph import StateGraph, END

class GraphState(BaseModel):
    question: str
    documents: list[str] = []
    answer: str | None = None
    retry_count: int = 0

def retrieve(state: GraphState) -> dict:
    docs = vector_store.search(state.question)
    return {"documents": docs}          # partial update merged into state

def generate(state: GraphState) -> dict:
    answer = llm_generate(state.question, state.documents)
    return {"answer": answer}

graph = StateGraph(GraphState)
graph.add_node("retrieve", retrieve)
graph.add_node("generate", generate)
graph.set_entry_point("retrieve")
graph.add_edge("retrieve", "generate")
graph.add_edge("generate", END)
app_graph = graph.compile()

result = app_graph.invoke(GraphState(question="What is RAG?"))
print(result["answer"])
```

**Why Pydantic state matters in a graph:** in a multi-node agent graph, a bug in node 2 producing a malformed `documents` list can silently propagate through nodes 3, 4, 5 and produce a confusing failure far from its cause. A `BaseModel`-typed state means every node's *return* gets validated against the schema when it's merged back in (depending on your LangGraph version/config), turning "wrong shape three nodes downstream" bugs into "immediate validation error at the exact node that produced bad data."

> **Common mistake:** mutating `state` fields in place inside a node function and returning nothing / returning `state` itself instead of a partial dict of *changes*. LangGraph nodes are expected to return the fields they change; mixing patterns causes subtle state-merge bugs. Keep node functions pure: read `state`, return only the changed fields as a dict.

### 7.4 Conversation History Types (a note on `BaseMessage`)

LangChain's message types (`HumanMessage`, `AIMessage`, `SystemMessage`, `ToolMessage`) are themselves Pydantic models under the hood. When you're condensing/summarizing conversational history (a common RAG/agent memory task), you're working with typed Pydantic objects, not raw dicts — which means:

```python
from langchain_core.messages import HumanMessage, AIMessage

messages = [HumanMessage(content="Hi"), AIMessage(content="Hello!")]
# .model_dump() works on each message exactly as with any BaseModel
history_as_dicts = [m.model_dump() for m in messages]
```

This is useful to know when debugging: if `isinstance(msg, BaseMessage)` fails somewhere in a condensing/history-management pipeline, you're likely passing a raw dict where a typed message object was expected (or vice versa) — a very common source of the "state management + message type" bugs that come up in LangGraph RAG pipelines.

---

## Part 8 — `pydantic-settings`: Configuration for LLM Apps

Every LLM app needs configuration: API keys, model names, temperature defaults, vector DB URLs. Hardcoding these, or reading `os.environ` manually with no validation, is fragile. `pydantic-settings` (a separate package, `pip install pydantic-settings`) gives you a validated, typed settings object sourced from environment variables / `.env` files.

```python
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    openai_api_key: str
    anthropic_api_key: str
    default_model: str = "gpt-4.1"
    default_temperature: float = 0.7
    max_retries: int = 3
    vector_db_url: str

settings = Settings()   # reads OPENAI_API_KEY, ANTHROPIC_API_KEY, etc. from env / .env
```

- Field names are matched to environment variables case-insensitively by default (`openai_api_key` ↔ `OPENAI_API_KEY`).
- Missing required settings (like a forgotten API key) raise a clear `ValidationError` **at startup**, not three requests into production when someone finally hits the code path that needs it.
- `extra="ignore"` (in `SettingsConfigDict`) prevents unrelated env vars on the machine from causing errors.

> **Best practice:** load a single global `Settings()` instance once at app startup (or via FastAPI's dependency-injection system) rather than scattering `os.getenv()` calls throughout your codebase. It centralizes what your app requires to run and makes misconfiguration a loud, immediate, top-of-stack failure.

---

## Part 9 — Advanced Topics

### 9.1 `TypeAdapter` — Validation Without a Full `BaseModel`

Sometimes you want to validate/serialize a type that isn't a full model — a list of strings, a dict, a `Union`, or a function's return type — without wrapping it in a class.

```python
from pydantic import TypeAdapter

ListOfInts = TypeAdapter(list[int])
result = ListOfInts.validate_python(["1", "2", "3"])   # [1, 2, 3]

# Very handy for validating an LLM's tool-call arguments dict against a raw type:
adapter = TypeAdapter(dict[str, str | int])
validated = adapter.validate_python({"query": "hello", "limit": "5"})
```

`TypeAdapter` is the modern, general-purpose replacement for a lot of what people used to reach for `parse_obj_as` (a v1 function) for. Reach for it whenever the "thing you want validated" isn't naturally a whole object with named fields.

### 9.2 Generic Models — Reusable Wrapper Schemas

A very common LLM/API pattern: a generic "response envelope" that wraps different payload types.

```python
from typing import Generic, TypeVar
from pydantic import BaseModel

T = TypeVar("T")

class APIResponse(BaseModel, Generic[T]):
    success: bool
    data: T | None = None
    error: str | None = None

class UserData(BaseModel):
    id: int
    name: str

response: APIResponse[UserData] = APIResponse(success=True, data=UserData(id=1, name="Shanto"))
```

Generics let you define validation/response envelopes once (pagination wrappers, tool-result wrappers, agent-step-result wrappers) and reuse them typed against many different payload models — extremely common in agent frameworks where every "step" returns a `StepResult[SomePayload]`-shaped object.

### 9.3 `computed_field` — Derived Properties in Serialized Output

```python
from pydantic import BaseModel, computed_field

class Document(BaseModel):
    content: str

    @computed_field
    @property
    def word_count(self) -> int:
        return len(self.content.split())

doc = Document(content="Pydantic makes LLM apps reliable")
print(doc.model_dump())   # {'content': '...', 'word_count': 5}
```

Regular `@property` methods are *not* included in `model_dump()`/`model_dump_json()` output by default — `computed_field` is what makes a derived value show up in serialized output (e.g., a token count, a chunk-count for a retrieved document, a computed relevance score) without you having to store it as a redundant real field.

### 9.4 `RootModel` — When Your Data Isn't an Object

For top-level data that's a list or a raw value rather than a dict of named fields:

```python
from pydantic import RootModel

class Tags(RootModel[list[str]]):
    pass

tags = Tags.model_validate(["ai", "llm", "rag"])
print(tags.root)   # ['ai', 'llm', 'rag']
```

Useful for validating an LLM response that's supposed to be a bare JSON array (e.g., "return a JSON list of extracted keywords") rather than an object.

### 9.5 `model_config` / `ConfigDict` — Model-Wide Behavior

```python
from pydantic import BaseModel, ConfigDict

class StrictExtraction(BaseModel):
    model_config = ConfigDict(
        extra="forbid",        # reject unknown fields instead of silently dropping them
        str_strip_whitespace=True,
        frozen=True,           # immutable after creation
        validate_assignment=True,  # re-validate on attribute assignment, not just construction
    )

    name: str
    category: str
```

- **`extra="forbid"`** is *extremely* valuable for LLM structured extraction: if the model hallucinates an extra field not in your schema, you want to know, not silently ignore it. (Default is `"ignore"` — extras are silently dropped. `"allow"` keeps them accessible too.)
- **`str_strip_whitespace=True`** auto-trims string fields — handy since LLMs often add stray leading/trailing whitespace or newlines.
- **`frozen=True`** makes instances immutable (raises on attribute assignment) — good for state objects you don't want accidentally mutated deep in an agent pipeline.
- **`validate_assignment=True`** re-runs validation when you do `obj.field = new_value` after construction, not just at creation time — otherwise post-construction mutation bypasses your validators entirely, a subtle and common bug source.

> **Best practice for LLM structured extraction specifically:** default to `extra="forbid"` on extraction schemas. It converts "the LLM added a field you didn't ask for" from a silent data-quality issue into a loud validation error you can catch and retry on.

### 9.6 Strict Mode — Turning Off Type Coercion

By default, Pydantic is "lax": `"30"` coerces to `30` for an `int` field. Sometimes (e.g., validating that an LLM followed a numeric-type instruction exactly, or validating trusted internal data where coercion could mask a bug) you want strict type checking with no coercion:

```python
from pydantic import BaseModel, Field

class StrictScore(BaseModel):
    value: int = Field(strict=True)

StrictScore(value=5)      # OK
StrictScore(value="5")    # raises ValidationError — no coercion allowed
```

You can also apply strict mode at the whole-model level (`model_config = ConfigDict(strict=True)`) or per-call (`Model.model_validate(data, strict=True)`).

### 9.7 Distinguishing "not provided" from "explicitly None"

A subtle but real need in LLM apps: knowing whether a field was *omitted* by the LLM vs. explicitly set to `null`, which can carry different meaning (e.g., "the model didn't mention a deadline" vs. "the model explicitly said there is no deadline").

```python
class Task(BaseModel):
    deadline: str | None = None

task = Task.model_validate({"deadline": None})
print("deadline" in task.model_fields_set)   # True — it WAS explicitly provided (even as None)

task2 = Task.model_validate({})
print("deadline" in task2.model_fields_set)  # False — it was never provided at all
```

`model_fields_set` gives you the set of field names that were actually supplied during validation/construction, regardless of their value — this is the tool for that "was it set vs. defaulted" distinction, which matters more than it seems once you're doing careful LLM output post-processing (e.g., PATCH-style partial updates from an agent).

---

## Part 10 — Errors, Debugging, and Production Practices

### 10.1 Working With `ValidationError` Programmatically

```python
from pydantic import BaseModel, ValidationError

class Extraction(BaseModel):
    name: str
    age: int

try:
    Extraction.model_validate({"name": "X", "age": "abc"})
except ValidationError as e:
    for err in e.errors():
        print(err["loc"], err["msg"], err["type"])
    # (('age',), 'Input should be a valid integer...', 'int_parsing')

    print(e.json())          # machine-readable, great for logging/telemetry
```

Every error entry has `loc` (path to the field, as a tuple — critical for nested/list data), `msg` (human-readable message), `type` (a stable machine-readable error code you can branch on), and `input` (the offending value). Build your LLM self-correction retry prompts from `e.errors()`, not from `str(e)` — it's structured and far more reliable to work with programmatically.

### 10.2 Common Mistakes Recap

1. **Using v1 APIs in new code** (`.parse_obj`, `.dict()`, `.json()`, `class Config:`) — use `.model_validate()`, `.model_dump()`, `.model_dump_json()`, `model_config = ConfigDict(...)` instead. The v1 methods still work (deprecated) but you shouldn't write new code with them, and mixed v1/v2 code is a common source of confusing bugs when copying tutorials.
2. **Confusing `Optional[X]` with "not required."** They're independent — you need `= None` (or another default) to actually make a field optional.
3. **Mutable default arguments** (`tags: list = []`) — use `Field(default_factory=list)`.
4. **Not using `extra="forbid"` on LLM-extraction schemas** — silently dropping hallucinated fields hides data quality problems.
5. **Ignoring `model_fields_set`** when you actually need to distinguish omitted vs. explicit-`None` — leads to subtle logic bugs in partial-update/agent-patch scenarios.
6. **Using loose `Union` instead of discriminated unions** for tagged agent/message content types — causes ambiguous parsing and confusing errors.
7. **Validating streamed partial JSON with a non-partial model** — always buffer to completion or use a partial-model pattern.
8. **Forgetting field `description`s matter to the LLM** — a structured-output schema with no descriptions is a weaker prompt than one with them; treat your Pydantic model as part of your prompt engineering surface, not just a post-hoc validator.
9. **Not centralizing config with `pydantic-settings`** — scattered `os.getenv()` calls with no validation mean missing API keys fail deep in a request instead of at startup.

### 10.3 Performance Notes

- Pydantic v2's core validation logic (`pydantic-core`) is Rust-based and is typically 5–50x faster than Pydantic v1 for comparable models — validation overhead on the request hot path of an LLM API wrapper is rarely your bottleneck (the LLM call itself dominates).
- Model classes are compiled once at class-definition time; there's no meaningful cost to defining lots of small, well-named models rather than reusing loose `dict[str, Any]` everywhere — prefer explicit models for anything crossing a boundary (API request, LLM output, tool arguments).
- For very hot inner loops validating primitive types repeatedly (not whole objects), `TypeAdapter` instances can be created once and reused — avoid recreating a `TypeAdapter` inside a loop.

---

## Part 11 — Quick-Reference Cheat Sheet

```python
# Core
class M(BaseModel): ...
M.model_validate(data)          # dict -> model
M.model_validate_json(json_str) # JSON string -> model
m.model_dump()                  # model -> dict
m.model_dump_json()             # model -> JSON string
m.model_dump(exclude_none=True, include={...}, exclude={...})

# Fields
x: int = Field(default=0, ge=0, le=100, description="...")
x: str = Field(alias="externalName")
x: list[str] = Field(default_factory=list)
x: int | None = None                         # optional AND defaulted

# Validators
@field_validator("field_name", mode="before"|"after")
@classmethod
def validate_x(cls, v): ...

@model_validator(mode="before"|"after")
def validate_all(self_or_data): ...

# Config
model_config = ConfigDict(
    extra="forbid"|"allow"|"ignore",
    str_strip_whitespace=True,
    frozen=True,
    validate_assignment=True,
    populate_by_name=True,
    strict=True,
)

# Advanced
TypeAdapter(SomeType).validate_python(data)
class Wrapper(BaseModel, Generic[T]): data: T
class Tags(RootModel[list[str]]): pass

@computed_field
@property
def derived(self) -> int: ...

model.model_fields_set    # which fields were explicitly provided

# Schema (for LLM tool/structured-output specs)
M.model_json_schema()

# Settings
class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env")
    api_key: str
```

---

## Suggested Learning Path Recap

1. **Part 1–2**: Build and validate flat models; understand coercion vs. strictness, `Field()`, defaults, aliases.
2. **Part 3**: Nest models, use enums/`Literal`, and — importantly — master discriminated unions before you touch any agent framework.
3. **Part 4**: Write field- and model-level validators; this is where you'll spend real time cleaning messy LLM output.
4. **Part 5**: This is the payoff section — connect models to OpenAI/Anthropic/instructor structured outputs. Re-read this part once you're actually wiring up a provider.
5. **Part 6–7**: See the same modeling skill reused across FastAPI (your API layer) and LangChain/LangGraph (your orchestration layer) — notice it's *the same models*, not different tools.
6. **Part 8**: Set up `pydantic-settings` early in any new project — it pays for itself the first time someone forgets to set an env var.
7. **Part 9–10**: Reach for these as needed — `TypeAdapter`, generics, `computed_field`, strict mode, and the common-mistakes list are your reference material once you're building for real.

You now have what you need to design, validate, and debug the data layer of a production LLM application without another introductory Pydantic tutorial.
