import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Mini RAG - Document Q&A",
  description: "Upload documents and ask questions with AI-powered answers and citations",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased min-h-screen">
        {children}
      </body>
    </html>
  );
}
