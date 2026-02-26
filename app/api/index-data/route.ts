import { NextResponse } from "next/server";
import { CSVLoader } from "@langchain/community/document_loaders/fs/csv";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { PineconeStore } from "@langchain/pinecone";
import { getVectorStore, getEmbeddings, pinecone, indexName } from "@/lib/pinecone";
import { supabase } from "@/lib/supabase";
import path from "path";

export async function POST() {
    try {
        // 1. CSV Load
        const csvPath = path.resolve(process.cwd(), "samples/review.csv");
        const loader = new CSVLoader(csvPath);
        const docs = await loader.load();

        // 2. Text Splitting (CSV rows are usually small, but let's apply a standard chunking)
        const splitter = new RecursiveCharacterTextSplitter({
            chunkSize: 500,
            chunkOverlap: 50,
        });
        const splitDocs = await splitter.splitDocuments(docs);

        // 3. Pinecone Upsert in Batches (Limit is 96 for llama-text-embed-v2)
        const BATCH_SIZE = 50;
        const vectorStore = await getVectorStore();

        for (let i = 0; i < splitDocs.length; i += BATCH_SIZE) {
            const batch = splitDocs.slice(i, i + BATCH_SIZE);
            await vectorStore.addDocuments(batch);
            console.log(`Indexed batch ${Math.floor(i / BATCH_SIZE) + 1} to Pinecone.`);
        }

        console.log(`Successfully indexed ${splitDocs.length} chunks to Pinecone.`);

        // 4. Supabase 연동 (데이터 동기화)
        const supabaseData = docs.map((doc: any) => {
            const content = doc.pageContent;
            const lines = content.split('\n');
            const data: any = {};
            lines.forEach((line: string) => {
                const parts = line.split(': ');
                if (parts.length > 1) {
                    data[parts[0].trim()] = parts.slice(1).join(': ').trim();
                }
            });

            return {
                id: data.id || undefined,
                title: data.title || "알 수 없는 상품",
                content: data.content || content,
                rating: data.rating ? parseInt(data.rating) : null,
                author: data.author || "익명",
                date: data.date ? new Date(data.date).toISOString() : new Date().toISOString(),
                helpful_votes: data.helpful_votes ? parseInt(data.helpful_votes) : 0,
                verified_purchase: data.verified_purchase === "true"
            };
        });

        const { error: supaError } = await supabase
            .from("reviews")
            .upsert(supabaseData, { onConflict: 'id' });

        if (supaError) {
            console.error("Supabase sync error:", supaError);
            throw supaError;
        }

        console.log(`Successfully synced CSV data to Supabase.`);

        return NextResponse.json({
            success: true,
            message: `${splitDocs.length}개의 데이터 조각이 Pinecone에 저장되고 Supabase에 동기화되었습니다.`
        });
    } catch (error: any) {
        console.error("Indexing error:", error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
