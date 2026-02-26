import { NextResponse } from "next/server";
import { getVectorStore } from "@/lib/pinecone";
import { supabase } from "@/lib/supabase";
import { ChatOpenAI } from "@langchain/openai";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { RunnableSequence, RunnablePassthrough } from "@langchain/core/runnables";
import { StringOutputParser } from "@langchain/core/output_parsers";

// JSON 포맷 출력을 유도하는 프롬프트
const SYSTEM_TEMPLATE = `당신은 쇼핑 리뷰 분석 전문가입니다. 제공된 리뷰 데이터를 바탕으로 사용자의 질문에 JSON 형식으로 정확히 답변하세요.
반드시 아래 JSON 구조(schema)만 출력해야 하며, 추가적인 마크다운 구문이나 인사말은 생략하세요.

[JSON 구조]
{{
  "productName": "사용자의 질문을 바탕으로 그럴듯하게 지어낸 가상의 세련된 상품명 (예: 이어폰 검색시 'Premium Wireless Earbuds Pro', 헤드셋 검색시 'Gaming Headset Elite', 마우스 검색시 'Logitech MX Master 3S' 등 자유롭게)",
  "averageRating": 리뷰들을 분석해 계산한 평균 평점 (예: 4.5의 소수점 포함 숫자),
  "summary": "전체 리뷰 및 질문에 대한 꼼꼼한 종합 요약 (300자 내외)",
  "pros": ["주요 장점 1", "주요 장점 2", "주요 장점 3"],
  "cons": ["주요 단점 1", "주요 단점 2"],
  "userReviewsComparison": [
    {{ "author": "작성자 이름", "comment": "핵심 참고 리뷰 내용 요약" }},
    {{ "author": "작성자 이름", "comment": "핵심 참고 리뷰 내용 요약" }}
  ]
}}

<context>
{context}
</context>`;

export async function POST(req: Request) {
    try {
        const { query, chatId } = await req.json();

        if (!query) {
            return NextResponse.json({ error: "Query is required" }, { status: 400 });
        }

        // 1. (Optional) Save User Message to DB
        if (chatId) {
            await supabase.from("messages").insert([{
                chat_id: chatId,
                role: "user",
                content: query,
                type: "text"
            }]);
        }

        // 2. Setup Vector Store Retriever (k: 3으로 줄여 프롬프트 사이즈 감소 -> 응답 속도 향상)
        const vectorStore = await getVectorStore();
        const retriever = vectorStore.asRetriever({ k: 3 }); // 빠르고 핵심적인 리뷰 3개만 확보

        // 3. LangChain LCEL Setup
        // LLM이 없다면 적절히 에러를 던지거나 Fallback
        if (!process.env.OPENAI_API_KEY) {
            throw new Error("OPENAI_API_KEY is missing. RAG LLM requires an OpenAI API key.");
        }

        const chat = new ChatOpenAI({
            modelName: "gpt-5-nano", // 사용자가 요청한 모델명
            modelKwargs: { response_format: { type: "json_object" } },
        });

        const prompt = ChatPromptTemplate.fromMessages([
            ["system", SYSTEM_TEMPLATE],
            ["human", "{input}"],
        ]);

        const formatDocs = (docs: any[]) => docs.map(d => d.pageContent).join("\n\n---\n\n");

        const chain = RunnableSequence.from([
            {
                context: retriever.pipe(formatDocs),
                input: new RunnablePassthrough(),
            },
            prompt,
            chat,
            new StringOutputParser(),
        ]);

        // 4. Invoke the RAG chain
        const resultRaw = await chain.invoke(query);
        let parsedData;
        try {
            parsedData = JSON.parse(resultRaw);
        } catch (e) {
            console.error("Failed to parse JSON from LLM: ", resultRaw);
            throw new Error("LLM Output parsing failed.");
        }

        // (추가) 컨텍스트에서 총 리뷰 수 계산용으로 문서 길이 등 활용
        const retrievedDocs = await retriever.invoke(query);

        const analysisData = {
            productName: parsedData.productName || "검색된 상품",
            totalReviews: retrievedDocs.length || 0, // 실제로는 DB count를 써야 하지만, 가져온 문서 수로 대체
            averageRating: parsedData.averageRating || 4.5,
            summary: parsedData.summary || "분석 결과를 요약합니다.",
            pros: parsedData.pros || [],
            cons: parsedData.cons || [],
            userReviewsComparison: parsedData.userReviewsComparison || [],
        };

        const aiContent = "요청하신 상품의 리뷰 분석이 완료되었습니다. 자세한 결과는 아래를 확인해주세요.";

        // 5. Save Assistant Message To DB
        let savedMessageId = null;
        if (chatId) {
            const { data } = await supabase.from("messages").insert([{
                chat_id: chatId,
                role: "assistant",
                content: aiContent,
                type: "analysis",
                analysis_data: analysisData
            }]).select("id").single();

            savedMessageId = data?.id;

            // Update chat timestamp
            await supabase
                .from("chats")
                .update({ updated_at: new Date().toISOString() })
                .eq("id", chatId);
        }

        return NextResponse.json({
            success: true,
            results: retrievedDocs.map(d => d.pageContent), // 디버깅용
            aiResponse: {
                content: aiContent,
                analysisData
            },
            messageId: savedMessageId
        });

    } catch (error: any) {
        console.error("Search API error:", error);

        // Mock fallback if API key is missing
        if (error.message.includes("OPENAI_API_KEY")) {
            return NextResponse.json({
                success: false,
                error: "OpenAI API 키가 설정되지 않았습니다. .env 파일에 OPENAI_API_KEY를 추가해주세요."
            }, { status: 500 });
        }

        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
