"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface Source {
  title: string;
  source: string;
  section: string;
  text: string;
  relevance_score: number;
}

interface QueryResponse {
  answer: string;
  sources: Source[];
  timing_ms: number;
  total_tokens: number;
  estimated_cost: number;
}

export default function Home() {
  const [text, setText] = useState("");
  const [title, setTitle] = useState("");
  const [query, setQuery] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [isQuerying, setIsQuerying] = useState(false);
  const [uploadResult, setUploadResult] = useState<{ chunks: number; tokens: number } | null>(null);
  const [queryResponse, setQueryResponse] = useState<QueryResponse | null>(null);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState<"upload" | "query">("upload");
  const [expandedSource, setExpandedSource] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch(`${API_URL}/health`).catch(() => {}); // Wake up backend
  }, []);

  const handleTextUpload = async () => {
    if (!text.trim()) {
      setError("Please enter some text to upload");
      return;
    }
    
    setIsUploading(true);
    setError("");
    
    try {
      const response = await fetch(`${API_URL}/documents`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text,
          title: title || "Untitled Document",
          source: "user_input"
        })
      });
      
      if (!response.ok) throw new Error("Failed to upload document");
      
      const data = await response.json();
      setUploadResult({ chunks: data.chunks_created, tokens: data.total_tokens });
      setText("");
      setTitle("");
    } catch {
      setError("Failed to upload document. Make sure the backend is running.");
    } finally {
      setIsUploading(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setIsUploading(true);
    setError("");
    
    try {
      const formData = new FormData();
      formData.append("file", file);
      
      const response = await fetch(`${API_URL}/documents/file`, {
        method: "POST",
        body: formData
      });
      
      if (!response.ok) throw new Error("Failed to upload file");
      
      const data = await response.json();
      setUploadResult({ chunks: data.chunks_created, tokens: data.total_tokens });
    } catch {
      setError("Failed to upload file. Make sure the backend is running.");
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleQuery = async () => {
    if (!query.trim()) {
      setError("Please enter a question");
      return;
    }
    
    setIsQuerying(true);
    setError("");
    setQueryResponse(null);
    
    try {
      const response = await fetch(`${API_URL}/query`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query, top_k: 10 })
      });
      
      if (!response.ok) throw new Error("Failed to query");
      
      const data = await response.json();
      setQueryResponse(data);
    } catch {
      setError("Failed to get answer. Make sure the backend is running.");
    } finally {
      setIsQuerying(false);
    }
  };

  const renderAnswerWithCitations = (answer: string) => {
    const parts = answer.split(/(\[\d+\])/g);
    return parts.map((part, i) => {
      const match = part.match(/\[(\d+)\]/);
      if (match) {
        const num = parseInt(match[1]) - 1;
        return (
          <span
            key={i}
            className="citation-badge mx-0.5"
            onClick={() => setExpandedSource(expandedSource === num ? null : num)}
          >
            {match[1]}
          </span>
        );
      }
      return <span key={i}>{part}</span>;
    });
  };

  return (
    <div className="min-h-screen relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-[hsl(var(--primary)/0.1)] via-[hsl(var(--background))] to-[hsl(var(--background))]" />
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-[hsl(var(--primary)/0.05)] rounded-full blur-3xl" />
      <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-[hsl(var(--accent)/0.05)] rounded-full blur-3xl" />
      
      <div className="relative z-10 container mx-auto px-4 py-8 max-w-6xl">
        <motion.header 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-12"
        >
          <h1 className="text-5xl font-bold mb-3">
            <span className="gradient-text">Mini RAG</span>
          </h1>
          <p className="text-[hsl(var(--muted-foreground))] text-lg">
            Upload documents, ask questions, get answers with citations
          </p>
        </motion.header>

        <div className="flex justify-center mb-8">
          <div className="glass-panel rounded-full p-1 flex gap-1">
            <button
              onClick={() => setActiveTab("upload")}
              className={`px-6 py-2 rounded-full text-sm font-medium transition-all ${
                activeTab === "upload"
                  ? "bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]"
                  : "text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
              }`}
            >
              Upload
            </button>
            <button
              onClick={() => setActiveTab("query")}
              className={`px-6 py-2 rounded-full text-sm font-medium transition-all ${
                activeTab === "query"
                  ? "bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]"
                  : "text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
              }`}
            >
              Ask Questions
            </button>
          </div>
        </div>

        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="mb-6 p-4 rounded-lg bg-[hsl(var(--destructive)/0.1)] border border-[hsl(var(--destructive)/0.3)] text-[hsl(var(--destructive))] text-center"
            >
              {error}
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence mode="wait">
          {activeTab === "upload" ? (
            <motion.div
              key="upload"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="space-y-6"
            >
              <div className="glass-panel rounded-2xl p-6 glow-primary">
                <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                  <svg className="w-5 h-5 text-[hsl(var(--primary))]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                  </svg>
                  Upload Document
                </h2>
                
                <div className="space-y-4">
                  <input
                    type="text"
                    placeholder="Document title (optional)"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="w-full px-4 py-3 rounded-lg bg-[hsl(var(--secondary)/0.5)] border border-[hsl(var(--border))] focus:border-[hsl(var(--primary))] focus:outline-none focus:ring-1 focus:ring-[hsl(var(--primary))] transition-all"
                  />
                  
                  <textarea
                    placeholder="Paste your text here..."
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    rows={8}
                    className="w-full px-4 py-3 rounded-lg bg-[hsl(var(--secondary)/0.5)] border border-[hsl(var(--border))] focus:border-[hsl(var(--primary))] focus:outline-none focus:ring-1 focus:ring-[hsl(var(--primary))] transition-all resize-none scrollbar-thin"
                  />
                  
                  <div className="flex gap-4">
                    <button
                      onClick={handleTextUpload}
                      disabled={isUploading}
                      className="flex-1 px-6 py-3 rounded-lg bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] font-medium hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                    >
                      {isUploading ? (
                        <span className="flex items-center justify-center gap-2">
                          <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                          </svg>
                          Processing...
                        </span>
                      ) : (
                        "Upload Text"
                      )}
                    </button>
                    
                    <label className="flex-1 px-6 py-3 rounded-lg bg-[hsl(var(--secondary))] text-[hsl(var(--foreground))] font-medium hover:opacity-80 cursor-pointer transition-all text-center">
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept=".txt,.md,.pdf,application/pdf"
                        onChange={handleFileUpload}
                        className="hidden"
                      />
                      Upload File
                    </label>
                  </div>
                </div>
              </div>

              <AnimatePresence>
                {uploadResult && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 10 }}
                    className="glass-panel rounded-2xl p-6"
                  >
                    <h3 className="text-lg font-semibold text-[hsl(var(--primary))] mb-3">Upload Successful!</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="p-4 rounded-lg bg-[hsl(var(--secondary)/0.3)]">
                        <div className="text-2xl font-bold">{uploadResult.chunks}</div>
                        <div className="text-sm text-[hsl(var(--muted-foreground))]">Chunks Created</div>
                      </div>
                      <div className="p-4 rounded-lg bg-[hsl(var(--secondary)/0.3)]">
                        <div className="text-2xl font-bold">{uploadResult.tokens.toLocaleString()}</div>
                        <div className="text-sm text-[hsl(var(--muted-foreground))]">Total Tokens</div>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ) : (
            <motion.div
              key="query"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-6"
            >
              <div className="glass-panel rounded-2xl p-6 glow-accent">
                <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                  <svg className="w-5 h-5 text-[hsl(var(--accent))]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Ask a Question
                </h2>
                
                <div className="flex gap-4">
                  <input
                    type="text"
                    placeholder="What would you like to know?"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleQuery()}
                    className="flex-1 px-4 py-3 rounded-lg bg-[hsl(var(--secondary)/0.5)] border border-[hsl(var(--border))] focus:border-[hsl(var(--accent))] focus:outline-none focus:ring-1 focus:ring-[hsl(var(--accent))] transition-all"
                  />
                  <button
                    onClick={handleQuery}
                    disabled={isQuerying}
                    className="px-8 py-3 rounded-lg bg-[hsl(var(--accent))] text-[hsl(var(--accent-foreground))] font-medium hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                  >
                    {isQuerying ? (
                      <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                    ) : (
                      "Ask"
                    )}
                  </button>
                </div>
              </div>

              <AnimatePresence>
                {queryResponse && (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="space-y-6"
                  >
                    <div className="glass-panel rounded-2xl p-6">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-semibold">Answer</h3>
                        <div className="flex gap-4 text-sm text-[hsl(var(--muted-foreground))] font-mono">
                          <span>{queryResponse.timing_ms.toFixed(0)}ms</span>
                          <span>{queryResponse.total_tokens.toLocaleString()} tokens</span>
                          <span>${queryResponse.estimated_cost.toFixed(6)}</span>
                        </div>
                      </div>
                      <div className="text-lg leading-relaxed">
                        {renderAnswerWithCitations(queryResponse.answer)}
                      </div>
                    </div>

                    {queryResponse.sources.length > 0 && (
                      <div className="glass-panel rounded-2xl p-6">
                        <h3 className="text-lg font-semibold mb-4">Sources</h3>
                        <div className="space-y-3">
                          {queryResponse.sources.map((source, index) => (
                            <motion.div
                              key={index}
                              initial={{ opacity: 0, y: 10 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ delay: index * 0.1 }}
                              className={`source-card cursor-pointer ${expandedSource === index ? "border-[hsl(var(--primary)/0.5)]" : ""}`}
                              onClick={() => setExpandedSource(expandedSource === index ? null : index)}
                            >
                              <div className="flex items-start justify-between">
                                <div className="flex items-center gap-3">
                                  <span className="citation-badge">{index + 1}</span>
                                  <div>
                                    <div className="font-medium">{source.title}</div>
                                    {source.section && (
                                      <div className="text-sm text-[hsl(var(--muted-foreground))]">{source.section}</div>
                                    )}
                                  </div>
                                </div>
                                <div className="text-sm text-[hsl(var(--muted-foreground))] font-mono">
                                  {(source.relevance_score * 100).toFixed(1)}%
                                </div>
                              </div>
                              <AnimatePresence>
                                {expandedSource === index && (
                                  <motion.div
                                    initial={{ opacity: 0, height: 0 }}
                                    animate={{ opacity: 1, height: "auto" }}
                                    exit={{ opacity: 0, height: 0 }}
                                    className="mt-3 pt-3 border-t border-[hsl(var(--border))]"
                                  >
                                    <p className="text-sm text-[hsl(var(--muted-foreground))] leading-relaxed">
                                      {source.text}
                                    </p>
                                  </motion.div>
                                )}
                              </AnimatePresence>
                            </motion.div>
                          ))}
                        </div>
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
