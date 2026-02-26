import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function DELETE(req: Request, { params }: { params: { chatId: string } }) {
    try {
        const { chatId } = params;

        if (!chatId) {
            return NextResponse.json({ success: false, error: "Chat ID is required" }, { status: 400 });
        }

        const { error } = await supabase
            .from("chats")
            .delete()
            .eq("id", chatId);

        if (error) throw error;

        return NextResponse.json({ success: true, message: "Chat deleted perfectly." });
    } catch (error: any) {
        console.error("Delete chat error:", error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
