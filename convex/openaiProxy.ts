import { httpAction } from "./_generated/server";

export const openaiProxy = httpAction(async (ctx, req) => {
    if (!process.env.OPENAI_API_KEY) {
        throw new Error("OPENAI_API_KEY is not set");
    }
    const headers = new Headers(req.headers);
    const authHeader = headers.get("Authorization");
    if (!authHeader) {
        return new Response("Unauthorized", { status: 401 });
    }
    if (!authHeader.startsWith("Bearer ")) {
        return new Response("Invalid authorization header", { status: 401 });
    }

    let body: any;
    try {
        body = await req.json();
    } catch (error) {
        return new Response("Invalid request body", { status: 400 });
    }
    if (body.model != 'gpt-4o-mini') {
        return new Response("Only gpt-4o-mini is supported", { status: 400 });
    }

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
        },
        body: JSON.stringify(body),
    });
    return response;
});