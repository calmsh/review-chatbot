"use client";

import { useState, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";
import {
  Send,
  User,
  Bot,
  Plus,
  MessageSquare,
  Settings,
  Menu,
  Paperclip,
  ThumbsUp,
  ThumbsDown,
  Search,
  Star,
  ChevronRight,
  Sparkles,
  Database,
  Trash2,
  Users
} from "lucide-react";

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  type?: "text" | "analysis";
  analysisData?: {
    productName: string;
    totalReviews: number;
    averageRating: number | string;
    summary: string;
    pros: string[];
    cons: string[];
    userReviewsComparison: { author: string; comment: string }[];
  };
};

// We don't need a welcome message in the array anymore.
// We'll show a dedicated Main Screen when there is no currentChatId.

export default function ChatPage() {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [chats, setChats] = useState<{ id: string; title: string }[]>([]);
  const [currentChatId, setCurrentChatId] = useState<string | null>(null);

  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isTyping, setIsTyping] = useState(false);
  const [isIndexing, setIsIndexing] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Fetch chat history on mount
  useEffect(() => {
    fetchChats();
  }, []);

  // (Removed problematic useEffect that auto-fetched messages when a new chat was created, causing the local optimistic message to overwrite and disappear)

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  // Handle textarea auto-resize
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "inherit"; // Fix text disappearing bug
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 150)}px`;
    }
  }, [input]);

  const fetchChats = async () => {
    try {
      const res = await fetch("/api/chats");
      const data = await res.json();
      if (data.success) {
        setChats(data.chats);
      }
    } catch (err) {
      console.error("Failed to fetch chats:", err);
    }
  };

  const fetchMessages = async (chatId: string) => {
    try {
      const res = await fetch(`/api/chats/${chatId}/messages`);
      const data = await res.json();
      if (data.success && data.messages.length > 0) {
        // 백엔드 snake_case를 캐멀케이스로 맞춰줄 수도 있고 직접 쓸 수도 있음 (여기서는 타입 기반 매핑 방어 처리)
        const formattedMessages = data.messages.map((m: any) => ({
          id: m.id,
          role: m.role,
          content: m.content,
          type: m.type,
          analysisData: m.analysis_data || undefined
        }));
        setMessages([...formattedMessages.reverse()]); // API가 역순이면 뒤집기, 아니면 그대로
      } else {
        setMessages([]);
      }
    } catch (err) {
      console.error("Failed to fetch messages:", err);
      setMessages([]);
    }
  };

  const handleIndexData = async () => {
    setIsIndexing(true);
    try {
      const res = await fetch("/api/index-data", { method: "POST" });
      const data = await res.json();
      if (data.success) {
        alert("인덱싱 완료: " + data.message);
      } else {
        alert("인덱싱 실패: " + data.error);
      }
    } catch (err) {
      alert("인덱싱 중 오류 발생");
    } finally {
      setIsIndexing(false);
    }
  };

  const handleSend = async () => {
    if (!input.trim() || isTyping) return;

    const userText = input.trim();
    setInput("");

    // Add User Message
    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: userText,
      type: "text",
    };
    setMessages((prev) => [...prev, userMessage]);
    setIsTyping(true);

    try {
      let activeChatId = currentChatId;

      // 만약 첫 대화라면 채팅방 생성
      if (!activeChatId) {
        const createRes = await fetch("/api/chats", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: userText.substring(0, 30) }),
        });
        const createData = await createRes.json();
        if (createData.success) {
          activeChatId = createData.chat.id;
          setCurrentChatId(activeChatId);
          fetchChats(); // 사이드바 채팅 목록 갱신
        }
      }

      // RAG 검색 API 호출
      const searchRes = await fetch("/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: userText, chatId: activeChatId }),
      });
      const searchData = await searchRes.json();

      setIsTyping(false);

      if (searchData.success) {
        const aiMessage: Message = {
          id: searchData.messageId || (Date.now() + 1).toString(),
          role: "assistant",
          content: searchData.aiResponse.content,
          type: searchData.aiResponse.analysisData ? "analysis" : "text",
          analysisData: searchData.aiResponse.analysisData,
        };
        setMessages((prev) => [...prev, aiMessage]);
      } else {
        throw new Error(searchData.error || "응답 생성 실패");
      }

    } catch (error: any) {
      console.error(error);
      setIsTyping(false);
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now().toString(),
          role: "assistant",
          content: "죄송합니다. 오류가 발생했습니다: " + error.message,
          type: "text"
        }
      ]);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const resetChat = () => {
    setCurrentChatId(null);
    setMessages([]);
    setInput("");
  };

  const deleteChat = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation(); // prevent chat selection
    if (!confirm("이 대화를 삭제하시겠습니까? (삭제하면 복구할 수 없습니다)")) return;

    try {
      const res = await fetch(`/api/chats/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (data.success) {
        if (currentChatId === id) resetChat();
        fetchChats(); // Refresh sidebar list
      } else {
        alert("삭제 실패: " + data.error);
      }
    } catch (err) {
      alert("삭제 중 오류가 발생했습니다.");
    }
  };

  return (
    <div className="flex h-screen bg-[#F9FAFB] text-zinc-900 overflow-hidden font-sans">
      {/* Sidebar */}
      <aside
        className={cn(
          "bg-white border-r border-zinc-200 flex flex-col transition-all duration-300 z-20",
          isSidebarOpen ? "w-[280px]" : "w-0 opacity-0 overflow-hidden"
        )}
      >
        <div className="p-4 flex items-center justify-between border-b border-zinc-100">
          <button
            onClick={resetChat}
            className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl border border-zinc-200 bg-white hover:bg-zinc-50 text-sm font-semibold w-full shadow-sm transition-all text-zinc-800"
          >
            <Plus className="w-4 h-4" />
            새로운 대화 시작
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-3 py-4 flex flex-col">
          <div className="text-xs font-bold text-zinc-400 px-2 mb-2 tracking-wider">최근 대화</div>
          <nav className="space-y-1.5 flex-1">
            {chats.map((chat) => (
              <div
                key={chat.id}
                className={cn(
                  "group w-full text-left px-3 py-2.5 rounded-lg text-sm flex items-center justify-between transition-colors",
                  currentChatId === chat.id
                    ? "bg-blue-50/60 font-semibold border border-blue-100"
                    : "hover:bg-zinc-100"
                )}
              >
                <button
                  onClick={() => {
                    setCurrentChatId(chat.id);
                    fetchMessages(chat.id);
                  }}
                  className="flex-1 truncate flex items-center gap-3"
                >
                  <MessageSquare className={cn("w-4 h-4 flex-shrink-0", currentChatId === chat.id ? "text-blue-600" : "text-zinc-400")} />
                  <span className={cn("truncate", currentChatId === chat.id ? "text-blue-700" : "text-zinc-600")}>{chat.title}</span>
                </button>
                <button
                  onClick={(e) => deleteChat(e, chat.id)}
                  className="opacity-0 group-hover:opacity-100 p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-all flex-shrink-0"
                  title="대화 삭제"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
            {chats.length === 0 && (
              <div className="px-3 py-2 text-xs text-zinc-400 text-center mt-4">
                대화 기록이 없습니다.
              </div>
            )}
          </nav>

          <div className="mt-6 border-t border-zinc-100 pt-4">
            <button
              onClick={handleIndexData}
              disabled={isIndexing}
              className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl bg-indigo-50 text-indigo-700 hover:bg-indigo-100 text-xs font-bold transition-all disabled:opacity-50"
            >
              <Database className="w-4 h-4" />
              {isIndexing ? "샘플 데이터 인덱싱 중..." : "샘플 데이터 인덱싱"}
            </button>
          </div>
        </div>

        <div className="p-4 border-t border-zinc-100 bg-zinc-50/50">
          <button className="flex items-center gap-3 w-full p-2.5 rounded-xl hover:bg-zinc-100 transition-colors">
            <div className="w-9 h-9 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold shadow-sm">
              <User className="w-5 h-5" />
            </div>
            <div className="flex-1 text-left">
              <div className="text-sm font-semibold text-zinc-900">사용자</div>
              <div className="text-xs text-zinc-500">익명 접속 (Public)</div>
            </div>
            <Settings className="w-4 h-4 text-zinc-400" />
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col relative min-w-0 bg-[#F9FAFB]">
        {/* Header */}
        <header className="h-16 flex items-center justify-between px-6 bg-white/70 backdrop-blur-md sticky top-0 z-10 border-b border-zinc-200 shadow-sm">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="p-2 -ml-2 rounded-lg hover:bg-zinc-100 text-zinc-500 transition-colors"
            >
              <Menu className="w-5 h-5" />
            </button>
            <h1 className="text-base font-bold text-zinc-800 flex items-center gap-2">
              <Search className="w-4 h-4 text-blue-600" />
              ReviewAI
            </h1>
          </div>
          <div className="flex items-center gap-2">
            {currentChatId && (
              <button
                onClick={resetChat}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-zinc-600 bg-white border border-zinc-200 rounded-lg hover:bg-zinc-50 hover:text-zinc-900 transition-colors shadow-sm mr-2"
              >
                메인 화면으로
              </button>
            )}
            <span className="bg-blue-100 text-blue-700 text-xs px-2.5 py-1 rounded-full font-semibold flex items-center gap-1">
              <Sparkles className="w-3 h-3" />
              RAG 분석 엔진
            </span>
          </div>
        </header>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-8 md:px-8 pb-32">
          <div className="max-w-4xl mx-auto space-y-8">
            {!currentChatId && messages.length === 0 && (
              <div className="w-full flex flex-col items-center justify-center py-10 animate-in fade-in zoom-in-95 duration-500">
                <div className="w-16 h-16 rounded-3xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg mb-6 shadow-blue-500/20 ring-4 ring-blue-50">
                  <Sparkles className="w-8 h-8 text-white" />
                </div>
                <h2 className="text-2xl font-bold text-zinc-900 mb-2">ReviewAI에 오신 것을 환영합니다!</h2>
                <p className="text-zinc-500 mb-8 max-w-lg text-center leading-relaxed">
                  수많은 쇼핑몰 리뷰들을 AI가 순식간에 읽고 분석해드립니다.
                </p>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 w-full max-w-3xl">
                  <div className="p-5 rounded-2xl bg-white border border-zinc-100 shadow-sm flex flex-col items-center text-center">
                    <div className="p-2.5 bg-blue-50 rounded-xl text-blue-600 mb-3">
                      <Star className="w-5 h-5" />
                    </div>
                    <h3 className="font-bold text-sm text-zinc-900 mb-1">핵심 요약</h3>
                    <p className="text-xs text-zinc-500">장황한 리뷰들을 짧고 명확한 한 줄 총평으로 요약해 줍니다.</p>
                  </div>
                  <div className="p-5 rounded-2xl bg-white border border-zinc-100 shadow-sm flex flex-col items-center text-center">
                    <div className="p-2.5 bg-emerald-50 rounded-xl text-emerald-600 mb-3">
                      <ThumbsUp className="w-5 h-5" />
                    </div>
                    <h3 className="font-bold text-sm text-zinc-900 mb-1">장단점 분석</h3>
                    <p className="text-xs text-zinc-500">실제 사용자들이 꼽은 진짜 장점과 치명적인 단점을 찾아냅니다.</p>
                  </div>
                  <div className="p-5 rounded-2xl bg-white border border-zinc-100 shadow-sm flex flex-col items-center text-center">
                    <div className="p-2.5 bg-purple-50 rounded-xl text-purple-600 mb-3">
                      <Users className="w-5 h-5" />
                    </div>
                    <h3 className="font-bold text-sm text-zinc-900 mb-1">리뷰 비교</h3>
                    <p className="text-xs text-zinc-500">도움이 될 만한 생생한 참고 리뷰들을 나란히 비교해 보여줍니다.</p>
                  </div>
                </div>
              </div>
            )}

            {messages.map((msg, idx) => (
              <div
                key={msg.id}
                className={cn(
                  "flex gap-4 w-full animate-in fade-in slide-in-from-bottom-2",
                  msg.role === "user" ? "justify-end" : "justify-start"
                )}
                style={{ animationDelay: `${idx * 50}ms`, animationDuration: "300ms" }}
              >
                {/* Assistant Avatar */}
                {msg.role === "assistant" && (
                  <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center flex-shrink-0 shadow-md mt-1">
                    <Bot className="w-5 h-5 text-white" />
                  </div>
                )}

                <div className={cn("flex flex-col gap-3 w-full", msg.role === "user" ? "items-end max-w-[85%]" : "items-start")}>
                  {/* Text Bubble */}
                  {msg.content && (
                    <div
                      className={cn(
                        "px-5 py-3.5 rounded-2xl text-[15px] leading-relaxed shadow-sm whitespace-pre-wrap font-medium",
                        msg.role === "user"
                          ? "bg-blue-600 text-white rounded-br-sm"
                          : "bg-white border border-zinc-200/80 text-zinc-800 rounded-bl-sm"
                      )}
                    >
                      {msg.content}
                    </div>
                  )}

                  {/* Enhanced Analysis Card */}
                  {msg.type === "analysis" && msg.analysisData && (
                    <div className="w-full bg-white rounded-2xl border border-zinc-200 shadow-lg overflow-hidden mt-1 lg:w-[32rem]">
                      {/* Card Header */}
                      <div className="px-6 py-5 border-b border-zinc-100 bg-gradient-to-r from-zinc-50 to-white">
                        <div className="flex flex-col gap-2">
                          <span className="text-xs font-bold text-blue-600 uppercase tracking-widest">분석 리포트</span>
                          <h3 className="text-lg font-bold text-zinc-900 leading-snug">{msg.analysisData.productName}</h3>
                          <div className="flex items-center gap-3 mt-1">
                            <div className="flex items-center text-yellow-500 bg-yellow-50 px-2 py-0.5 rounded-full ring-1 ring-yellow-200/50">
                              <Star className="w-3.5 h-3.5 fill-current mr-1" />
                              <span className="text-sm font-bold">{msg.analysisData.averageRating}</span>
                            </div>
                            <span className="text-sm font-medium text-zinc-500">
                              총 {msg.analysisData.totalReviews.toLocaleString()}개의 관련 리뷰 분석 기준
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="p-6 space-y-6">
                        {/* Summary Section */}
                        {msg.analysisData.summary && (
                          <div className="p-4 bg-blue-50/50 rounded-xl border border-blue-100 text-sm text-zinc-700 font-medium leading-relaxed">
                            {msg.analysisData.summary}
                          </div>
                        )}

                        {/* User Reviews Comparison Section */}
                        {msg.analysisData.userReviewsComparison && msg.analysisData.userReviewsComparison.length > 0 && (
                          <div className="pt-2">
                            <h4 className="flex items-center gap-2 text-sm font-bold text-zinc-900 mb-3">
                              <Users className="w-4 h-4 text-purple-500" /> 참고 리뷰
                            </h4>
                            <div className="space-y-3">
                              {msg.analysisData.userReviewsComparison.map((review, i) => (
                                <div key={i} className="p-3.5 rounded-xl bg-zinc-50 border border-zinc-100/80 hover:bg-zinc-100 transition-colors">
                                  <div className="flex items-center gap-2 mb-1">
                                    <div className="w-5 h-5 rounded-full bg-purple-100 flex items-center justify-center text-purple-600">
                                      <User className="w-3 h-3" />
                                    </div>
                                    <span className="text-xs font-bold text-zinc-700">{review.author || "익명"}</span>
                                  </div>
                                  <p className="text-sm text-zinc-600 leading-relaxed font-medium pl-7">
                                    "{review.comment}"
                                  </p>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Pros/Cons Section */}
                        {(msg.analysisData.pros?.length > 0 || msg.analysisData.cons?.length > 0) && (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 pt-2">
                            {msg.analysisData.pros?.length > 0 && (
                              <div className="space-y-3">
                                <h4 className="text-sm font-bold text-zinc-900 flex items-center gap-2 px-1">
                                  <div className="p-1 rounded-md bg-emerald-100 text-emerald-600">
                                    <ThumbsUp className="w-3.5 h-3.5" />
                                  </div>
                                  주요 장점
                                </h4>
                                <ul className="text-sm text-zinc-700 space-y-2.5">
                                  {msg.analysisData.pros.map((pro, i) => (
                                    <li key={i} className="flex items-start gap-2">
                                      <ChevronRight className="w-4 h-4 text-emerald-500 flex-shrink-0 mt-0.5" />
                                      <span className="font-medium">{pro}</span>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}
                            {msg.analysisData.cons?.length > 0 && (
                              <div className="space-y-3">
                                <h4 className="text-sm font-bold text-zinc-900 flex items-center gap-2 px-1">
                                  <div className="p-1 rounded-md bg-red-100 text-red-500">
                                    <ThumbsDown className="w-3.5 h-3.5" />
                                  </div>
                                  주요 단점
                                </h4>
                                <ul className="text-sm text-zinc-700 space-y-2.5">
                                  {msg.analysisData.cons.map((con, i) => (
                                    <li key={i} className="flex items-start gap-2">
                                      <ChevronRight className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                                      <span className="font-medium">{con}</span>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* User Avatar */}
                {msg.role === "user" && (
                  <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-zinc-200 to-zinc-300 flex items-center justify-center flex-shrink-0 shadow-md mt-1">
                    <User className="w-5 h-5 text-zinc-600" />
                  </div>
                )}
              </div>
            ))}

            {/* Loading Indicator */}
            {isTyping && (
              <div className="flex justify-start w-full animate-in fade-in">
                <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center flex-shrink-0 shadow-md mr-4 mt-1">
                  <Bot className="w-5 h-5 text-white" />
                </div>
                <div className="bg-white border border-zinc-200/80 rounded-2xl rounded-bl-sm px-5 py-4 flex items-center gap-1.5 shadow-sm h-12">
                  <span className="w-2 h-2 bg-zinc-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }}></span>
                  <span className="w-2 h-2 bg-zinc-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }}></span>
                  <span className="w-2 h-2 bg-zinc-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }}></span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} className="h-4" />
          </div>
        </div>

        {/* Input Area */}
        <div className="absolute bottom-0 left-0 right-0 p-4 md:p-6 bg-gradient-to-t from-[#F9FAFB] via-[#F9FAFB] to-transparent pointer-events-none">
          <div className="max-w-4xl mx-auto relative pointer-events-auto">
            {/* Suggested Prompts on Main Screen */}
            {!currentChatId && (
              <div className="flex flex-wrap gap-2 mb-4 justify-center animate-in fade-in slide-in-from-bottom-2">
                {[
                  "가성비 좋은 노이즈 캔슬링 이어폰 추천해줘",
                  "게이밍 헤드셋 중 마이크 품질 제일 좋은 건 뭐야?",
                  "인체공학 무소음 마우스 솔직한 리뷰 어때?",
                  "기계식 키보드 축 종류별로 타건감 비교해줘"
                ].map((query, i) => (
                  <button
                    key={i}
                    onClick={() => setInput(query)}
                    className="px-4 py-2 bg-white/70 backdrop-blur-sm border border-zinc-200/80 text-zinc-600 rounded-full text-sm font-medium hover:bg-white hover:text-blue-600 hover:shadow-sm hover:border-blue-200 transition-all"
                  >
                    {query}
                  </button>
                ))}
              </div>
            )}

            <div className="bg-white rounded-2xl border border-zinc-200 shadow-[0_2px_12px_rgba(0,0,0,0.04)] focus-within:shadow-[0_4px_20px_rgba(0,0,0,0.08)] focus-within:border-blue-300 transition-all">
              <div className="flex items-end px-3 py-3 gap-2">
                <button className="p-2.5 text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 rounded-xl transition-colors mb-0.5">
                  <Paperclip className="w-5 h-5" />
                </button>
                <textarea
                  ref={textareaRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="리뷰를 분석할 상품의 URL이나 텍스트를 입력하세요..."
                  className="flex-1 max-h-40 min-h-[44px] bg-transparent text-zinc-800 placeholder:text-zinc-400 focus:outline-none resize-none py-2.5 leading-relaxed font-medium"
                  rows={1}
                />
                <button
                  onClick={handleSend}
                  disabled={!input.trim() || isTyping}
                  className="p-2.5 mb-0.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:bg-zinc-200 disabled:text-zinc-400 transition-all shadow-sm flex-shrink-0"
                >
                  <Send className="w-5 h-5" />
                </button>
              </div>
            </div>
            <div className="text-center mt-3">
              <p className="text-[11px] font-medium text-zinc-400 flex items-center justify-center gap-1">
                AI는 완벽하지 않을 수 있습니다. 중요한 정보를 확인할 때는 원본 리뷰를 함께 참고해주세요.
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
