import os
from openai import OpenAI
from services.embeddings import count_tokens

client = OpenAI(
    base_url="https://integrate.api.nvidia.com/v1",
    api_key=os.getenv("NVIDIA_API_KEY")
)

MODEL_NAME = "openai/gpt-oss-20b"

SYSTEM_PROMPT = """You are a helpful assistant that answers questions based on the provided context.
Your answers must be grounded in the context provided.

IMPORTANT RULES:
1. Use inline citations like [1], [2], etc. to reference the sources you use
2. Each citation number corresponds to the source index in the provided context
3. If the context doesn't contain relevant information, say "I couldn't find relevant information in the documents."
4. Be concise but thorough
5. Always cite your sources using the bracket notation

Example format:
"The capital of France is Paris [1]. It is known for its iconic Eiffel Tower [2]."
"""

def build_context(chunks: list[dict]) -> str:
    context_parts = []
    for i, chunk in enumerate(chunks, 1):
        source_info = f"Source [{i}]: {chunk.get('title', 'Unknown')}"
        if chunk.get('section'):
            source_info += f" - {chunk['section']}"
        context_parts.append(f"{source_info}\n{chunk['text']}\n")
    return "\n---\n".join(context_parts)

async def generate_answer(query: str, chunks: list[dict]) -> tuple[str, int]:
    context = build_context(chunks)
    
    prompt = f"{SYSTEM_PROMPT}\n\nContext:\n{context}\n\nQuestion: {query}"
    
    prompt_tokens = count_tokens(prompt)
    
    completion = client.chat.completions.create(
        model=MODEL_NAME,
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": f"Context:\n{context}\n\nQuestion: {query}"}
        ],
        temperature=0.1,
        max_tokens=1000,
    )
    
    answer = completion.choices[0].message.content
    completion_tokens = count_tokens(answer)
    total_tokens = prompt_tokens + completion_tokens
    
    return answer, total_tokens
