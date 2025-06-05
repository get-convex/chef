import type { ActionFunctionArgs } from '@vercel/remix';
import OpenAI from 'openai';

const SYSTEM_PROMPT = `You are an expert at summarizing conversation history. Your task is to create a concise, comprehensive summary of the conversation that captures:

1. The main goals and objectives discussed
2. Key decisions made
3. Important technical details or requirements
4. Current state of any projects or implementations
5. Next steps or action items

Guidelines:
- Keep the summary under 200 words
- Focus on actionable information and context
- Maintain technical accuracy
- Use clear, concise language
- Preserve important details that would be needed for future context

The summary will be used to provide context for future conversations, so include information that would help someone understand where the conversation left off.`;

export async function action({ request }: ActionFunctionArgs) {
  try {
    if (request.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), {
        status: 405,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const { messages } = await request.json();

    if (!messages || !Array.isArray(messages)) {
      return new Response(JSON.stringify({ error: 'Invalid messages' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    // Convert messages to a readable format for summarization
    const conversationText = messages
      .map((msg: any) => {
        const role = msg.role === 'user' ? 'User' : 'Assistant';
        const content =
          typeof msg.content === 'string'
            ? msg.content
            : msg.content?.map((part: any) => part.text || part.content || '').join(' ') || '';
        return `${role}: ${content}`;
      })
      .join('\n\n');

    const completion = await openai.chat.completions.create({
      model: 'gpt-4.1-mini',
      messages: [
        {
          role: 'system',
          content: SYSTEM_PROMPT,
        },
        {
          role: 'user',
          content: `Please summarize this conversation:\n\n${conversationText}`,
        },
      ],
      temperature: 0.3,
      max_tokens: 300,
    });

    const summary = completion.choices[0]?.message?.content || 'Unable to generate summary';

    return new Response(JSON.stringify({ summary }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error summarizing chat:', error);
    return new Response(JSON.stringify({ error: 'Error summarizing chat' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
