import os
import tiktoken
import cohere

# Configure Cohere
COHERE_API_KEY = os.getenv("COHERE_API_KEY")
co = cohere.Client(COHERE_API_KEY)

CHUNK_SIZE = 1000
CHUNK_OVERLAP = 100
EMBEDDING_MODEL = "embed-english-v3.0"

def count_tokens(text: str, model: str = "gpt-4") -> int:
    try:
        encoding = tiktoken.encoding_for_model(model)
    except KeyError:
        encoding = tiktoken.get_encoding("cl100k_base")
    return len(encoding.encode(text))

def chunk_text(text: str, title: str = "Untitled", source: str = "unknown") -> list[dict]:
    chunks = []
    paragraphs = text.split("\n\n")
    
    current_chunk = ""
    current_section = ""
    chunk_position = 0
    
    for para in paragraphs:
        para = para.strip()
        if not para:
            continue
            
        if para.startswith("#") or (len(para) < 100 and para.endswith(":")):
            current_section = para.replace("#", "").strip()
        
        if count_tokens(current_chunk + "\n\n" + para) > CHUNK_SIZE:
            if current_chunk:
                chunks.append({
                    "text": current_chunk.strip(),
                    "title": title,
                    "source": source,
                    "section": current_section,
                    "position": chunk_position
                })
                chunk_position += 1
                
                words = current_chunk.split()
                overlap_words = words[-int(len(words) * 0.15):] if len(words) > 10 else []
                current_chunk = " ".join(overlap_words) + "\n\n" + para
            else:
                current_chunk = para
        else:
            current_chunk = current_chunk + "\n\n" + para if current_chunk else para
    
    if current_chunk.strip():
        chunks.append({
            "text": current_chunk.strip(),
            "title": title,
            "source": source,
            "section": current_section,
            "position": chunk_position
        })
    
    return chunks

async def get_embeddings(texts: list[str], input_type: str = "search_document") -> list[list[float]]:
    # Cohere's embed supports batching and requires input_type for v3 models
    response = co.embed(
        texts=texts,
        model=EMBEDDING_MODEL,
        input_type=input_type,
        embedding_types=["float"]
    )
    return [list(e) for e in response.embeddings.float]
