import os
import asyncpg
import uuid
from typing import Optional

DATABASE_URL = os.getenv("DATABASE_URL")

async def get_connection():
    return await asyncpg.connect(DATABASE_URL)

async def init_database():
    conn = await get_connection()
    try:
        await conn.execute("CREATE EXTENSION IF NOT EXISTS vector;")
        
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS documents (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                created_at TIMESTAMP DEFAULT NOW()
            );
        """)
        
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS chunks (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                document_id UUID REFERENCES documents(id) ON DELETE CASCADE,
                text TEXT NOT NULL,
                title TEXT,
                source TEXT,
                section TEXT,
                position INTEGER,
                embedding vector(1024),
                created_at TIMESTAMP DEFAULT NOW()
            );
        """)
        
        await conn.execute("""
            CREATE INDEX IF NOT EXISTS chunks_embedding_idx 
            ON chunks USING ivfflat (embedding vector_cosine_ops)
            WITH (lists = 100);
        """)
    finally:
        await conn.close()

async def store_document(chunks: list[dict]) -> str:
    conn = await get_connection()
    try:
        doc_id = str(uuid.uuid4())
        await conn.execute(
            "INSERT INTO documents (id) VALUES ($1)",
            uuid.UUID(doc_id)
        )
        
        for chunk in chunks:
            await conn.execute(
                """
                INSERT INTO chunks (document_id, text, title, source, section, position, embedding)
                VALUES ($1, $2, $3, $4, $5, $6, $7)
                """,
                uuid.UUID(doc_id),
                chunk["text"],
                chunk.get("title"),
                chunk.get("source"),
                chunk.get("section"),
                chunk.get("position"),
                str(chunk["embedding"])
            )
        
        return doc_id
    finally:
        await conn.close()

async def search_similar_chunks(query_embedding: list[float], top_k: int = 10, similarity_threshold: float = 0.1) -> list[dict]:
    conn = await get_connection()
    try:
        embedding_str = "[" + ",".join(str(x) for x in query_embedding) + "]"
        
        rows = await conn.fetch(
            """
            SELECT 
                id,
                text,
                title,
                source,
                section,
                position,
                1 - (embedding <=> $1::vector) as similarity
            FROM chunks
            WHERE 1 - (embedding <=> $1::vector) > $3
            ORDER BY embedding <=> $1::vector
            LIMIT $2
            """,
            embedding_str,
            top_k,
            similarity_threshold
        )
        
        return [
            {
                "id": str(row["id"]),
                "text": row["text"],
                "title": row["title"],
                "source": row["source"],
                "section": row["section"],
                "position": row["position"],
                "similarity": float(row["similarity"])
            }
            for row in rows
        ]
    finally:
        await conn.close()
