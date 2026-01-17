from fastapi import FastAPI, HTTPException, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
import time
import os
from pathlib import Path
from dotenv import load_dotenv
import fitz

env_path = Path(__file__).parent.parent / ".env"
load_dotenv(env_path)
load_dotenv()

from services.embeddings import chunk_text, get_embeddings, count_tokens
from services.database import store_document, search_similar_chunks
from services.reranker import rerank_chunks
from services.llm import generate_answer

app = FastAPI(title="Mini RAG API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class DocumentInput(BaseModel):
    text: str
    title: Optional[str] = "Untitled Document"
    source: Optional[str] = "user_input"

class QueryInput(BaseModel):
    query: str
    top_k: Optional[int] = 10

class QueryResponse(BaseModel):
    answer: str
    sources: list
    timing_ms: float
    total_tokens: int
    estimated_cost: float

@app.get("/health")
async def health_check():
    return {"status": "healthy"}

@app.post("/documents")
async def ingest_document(doc: DocumentInput):
    start_time = time.time()
    
    chunks = chunk_text(doc.text, doc.title, doc.source)
    
    embeddings = await get_embeddings([c["text"] for c in chunks])
    
    for i, chunk in enumerate(chunks):
        chunk["embedding"] = embeddings[i]
    
    doc_id = await store_document(chunks)
    
    total_tokens = sum(count_tokens(c["text"]) for c in chunks)
    
    return {
        "document_id": doc_id,
        "chunks_created": len(chunks),
        "total_tokens": total_tokens,
        "timing_ms": (time.time() - start_time) * 1000
    }

@app.post("/documents/file")
async def ingest_file(file: UploadFile = File(...)):
    start_time = time.time()

    content = await file.read()
    if not content:
        raise HTTPException(status_code=400, detail="Uploaded file is empty")

    try:
        if (file.content_type and "pdf" in file.content_type.lower()) or file.filename.lower().endswith(".pdf"):
            try:
                pdf_doc = fitz.open(stream=content, filetype="pdf")
            except Exception as exc:
                raise HTTPException(status_code=400, detail=f"Failed to read PDF: {exc}")

            try:
                text_parts = [page.get_text("text") for page in pdf_doc]
            finally:
                pdf_doc.close()

            text = "\n".join(part.strip() for part in text_parts if part).strip()
            if not text:
                raise HTTPException(status_code=400, detail="PDF contains no extractable text")
        else:
            try:
                text = content.decode("utf-8")
            except UnicodeDecodeError:
                try:
                    text = content.decode("latin-1")
                except UnicodeDecodeError:
                    raise HTTPException(status_code=400, detail="Unable to decode file contents; please upload UTF-8 text or PDF files")
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Failed to process uploaded file: {exc}")

    chunks = chunk_text(text, file.filename, "file_upload")

    embeddings = await get_embeddings([c["text"] for c in chunks])
    
    for i, chunk in enumerate(chunks):
        chunk["embedding"] = embeddings[i]
    
    doc_id = await store_document(chunks)
    
    total_tokens = sum(count_tokens(c["text"]) for c in chunks)
    
    return {
        "document_id": doc_id,
        "filename": file.filename,
        "chunks_created": len(chunks),
        "total_tokens": total_tokens,
        "timing_ms": (time.time() - start_time) * 1000
    }

@app.post("/query", response_model=QueryResponse)
async def query_documents(query: QueryInput):
    start_time = time.time()
    total_tokens = 0
    
    query_embedding = await get_embeddings([query.query], input_type="search_query")
    total_tokens += count_tokens(query.query)
    
    similar_chunks = await search_similar_chunks(query_embedding[0], query.top_k)
    
    if not similar_chunks:
        return QueryResponse(
            answer="I couldn't find any relevant information in the documents to answer your question.",
            sources=[],
            timing_ms=(time.time() - start_time) * 1000,
            total_tokens=total_tokens,
            estimated_cost=total_tokens * 0.0000001
        )
    
    reranked_chunks = await rerank_chunks(query.query, similar_chunks)
    
    answer, answer_tokens = await generate_answer(query.query, reranked_chunks)
    total_tokens += answer_tokens
    
    sources = []
    for chunk in reranked_chunks[:5]:
        sources.append({
            "title": chunk.get("title", "Unknown"),
            "source": chunk.get("source", "Unknown"),
            "section": chunk.get("section", ""),
            "text": chunk.get("text", "")[:300] + "..." if len(chunk.get("text", "")) > 300 else chunk.get("text", ""),
            "relevance_score": chunk.get("rerank_score", chunk.get("similarity", 0))
        })
    
    estimated_cost = total_tokens * 0.0000001
    
    return QueryResponse(
        answer=answer,
        sources=sources,
        timing_ms=(time.time() - start_time) * 1000,
        total_tokens=total_tokens,
        estimated_cost=estimated_cost
    )

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
