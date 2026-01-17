# Mini RAG System

A Retrieval-Augmented Generation (RAG) application that allows users to upload documents and ask questions with AI-powered answers including citations.

## Live 

- **Frontend**: [https://mini-rag-liard.vercel.app/](https://mini-rag-liard.vercel.app/)
- **Backend API**: [https://mini-rag-492s.onrender.com](https://mini-rag-492s.onrender.com)

## Architecture

```
+----------------+     +------------------+     +------------------+
|                |     |                  |     |                  |
|  Next.js       | --> |  FastAPI         | --> |  Supabase        |
|  Frontend      |     |  Backend         |     |  PostgreSQL      |
|                |     |                  |     |  + pgvector      |
+----------------+     +------------------+     +------------------+
                              |
                              v
              +-------------------------------+
              |        AI Services            |
              |  +---------+  +-----------+   |
              |  | Cohere  |  | NVIDIA    |   |
              |  | Embed   |  | LLM       |   |
              |  | Rerank  |  |           |   |
              |  +---------+  +-----------+   |
              +-------------------------------+
```

## Query Flow

```
User Query
    |
    v
[1] Embed Query (Cohere embed-english-v3.0)
    |
    v
[2] Vector Search (pgvector cosine similarity)
    |
    v
[3] Rerank Results (Cohere rerank-english-v3.0)
    |
    v
[4] Generate Answer (NVIDIA openai/gpt-oss-20b)
    |
    v
Answer with Citations [1], [2], ...
```

## Providers

| Component   | Provider | Model                    |
|-------------|----------|--------------------------|
| Embeddings  | Cohere   | embed-english-v3.0       |
| Reranking   | Cohere   | rerank-english-v3.0      |
| LLM         | NVIDIA   | openai/gpt-oss-20b       |
| Vector DB   | Supabase | PostgreSQL + pgvector    |

## Chunking Parameters

| Parameter      | Value | Description                              |
|----------------|-------|------------------------------------------|
| Chunk Size     | 1000  | Maximum tokens per chunk                 |
| Chunk Overlap  | ~15%  | Overlap between consecutive chunks       |
| Embedding Dim  | 1024  | Cohere embed-english-v3.0 dimensions     |

## Quick Start (Local Development)

### 1. Clone and Install

```bash
# Backend
cd backend
python -m venv venv
venv\Scripts\activate  # Windows
pip install -r requirements.txt

# Frontend
cd frontend
npm install
```

### 2. Configure Environment

Copy `.env.example` to `.env` and fill in your API keys:

```bash
cp .env.example .env
```

Required API keys:
- **Supabase**: Create a project at [supabase.com](https://supabase.com)
- **Cohere**: Get API key at [cohere.com](https://cohere.com)
- **NVIDIA**: Get API key at [build.nvidia.com](https://build.nvidia.com)

### 3. Initialize Database

The pgvector extension and tables are auto-created on first run.

### 4. Run

```bash
# Terminal 1 - Backend
cd backend
python main.py

# Terminal 2 - Frontend
cd frontend
npm run dev
```

Visit `http://localhost:3000`

---

## Deployment

### Backend (Render)

1. **Create a new Web Service** on [Render](https://render.com)
2. **Connect your GitHub repository**
3. **Configure the service:**
   - **Root Directory**: `backend`
   - **Runtime**: Python 3
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `uvicorn main:app --host 0.0.0.0 --port $PORT`

4. **Add Environment Variables** in Render dashboard:
   ```
   SUPABASE_URL=your_supabase_url
   SUPABASE_ANON_KEY=your_supabase_anon_key
   SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
   DATABASE_URL=your_database_url
   COHERE_API_KEY=your_cohere_api_key
   NVIDIA_API_KEY=your_nvidia_api_key
   ```

5. **Deploy** - Render will automatically build and deploy

### Frontend (Vercel)

1. **Import your repository** on [Vercel](https://vercel.com)
2. **Configure the project:**
   - **Root Directory**: `frontend`
   - **Framework Preset**: Next.js

3. **Add Environment Variables** in Vercel dashboard:
   ```
   NEXT_PUBLIC_API_URL=https://your-render-backend-url.onrender.com
   ```

4. **Deploy** - Vercel will automatically build and deploy

### Post-Deployment Checklist

- [ ] Backend is live on Render (check `/health` endpoint)
- [ ] Frontend is live on Vercel
- [ ] CORS is configured (backend allows frontend origin)
- [ ] Environment variables are set correctly on both platforms
- [ ] Test document upload and query functionality

## API Endpoints

| Method | Endpoint         | Description              |
|--------|------------------|--------------------------|
| GET    | /health          | Health check             |
| POST   | /documents       | Upload text document     |
| POST   | /documents/file  | Upload file (txt, pdf)   |
| POST   | /query           | Query with RAG           |

## Remarks

### Provider Limitations
- **Cohere Free Tier**: Rate limited to 100 API calls/minute
- **NVIDIA NIM**: Free tier has limited concurrent requests
- **Supabase Free Tier**: 500MB database storage

### Tradeoffs
- Using `rerank-english-v3.0` instead of `rerank-v3.5` for broader compatibility
- Similarity threshold set to 0.1 (low) to ensure results are returned even with imperfect matches
- Chunk size of 1000 tokens balances context preservation with embedding quality

## Evaluation (Gold Set)

5 Q/A pairs tested against AI/ML/CSE technical documentation corpus:

| # | Topic Document | Sample Question | Source Confidence | Result |
|---|----------------|-----------------|-------------------|--------|
| 1 | Transformer Architecture and Attention Mechanisms | What is multi-head attention? | 99.8% | Correct |
| 2 | Convolutional Neural Networks and Computer Vision | How do CNNs process images? | 99.8% | Correct |
| 3 | Reinforcement Learning and Deep Q-Networks | What is the Bellman equation? | 97.8% | Correct |
| 4 | Graph Neural Networks and Relational Learning | How do GNNs aggregate neighbor information? | 100.0% | Correct |
| 5 | Natural Language Processing Fundamentals | What is tokenization in NLP? | 94.0% | Correct |

### Performance Note (Precision & Recall)

- **Precision (Success Rate): 100%**. Every answer generated was directly grounded in the retrieved documents, with a 100% success rate in providing accurate, cited responses for the test set.
- **Recall: High**. The system successfully retrieved the most relevant chunks (often with >95% confidence from the reranker) for each domain-specific query.
- **Efficiency**: Average latency is ~5.8s, with costs maintained at a fraction of a cent per query.

*Note: The high precision is attributed to the Cohere reranking stage, which filters out noise from the initial vector search, ensuring only high-quality context reaches the LLM.*
