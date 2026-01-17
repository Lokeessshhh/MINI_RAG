import os
import cohere

co = cohere.Client(os.getenv("COHERE_API_KEY"))

async def rerank_chunks(query: str, chunks: list[dict], top_n: int = 5) -> list[dict]:
    if not chunks:
        return []
    
    if not os.getenv("COHERE_API_KEY"):
        return sorted(chunks, key=lambda x: x.get("similarity", 0), reverse=True)[:top_n]
    
    try:
        documents = [chunk["text"] for chunk in chunks]
        
        response = co.rerank(
            model="rerank-english-v3.0",
            query=query,
            documents=documents,
            top_n=top_n
        )
        
        reranked = []
        for result in response.results:
            chunk = chunks[result.index].copy()
            chunk["rerank_score"] = result.relevance_score
            reranked.append(chunk)
        
        return reranked
    except Exception as e:
        print(f"Reranking failed, falling back to similarity: {e}")
        return sorted(chunks, key=lambda x: x.get("similarity", 0), reverse=True)[:top_n]
