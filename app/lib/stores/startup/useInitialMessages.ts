import { useState, useEffect } from "react";
import { useConvex } from "convex/react";
import { waitForConvexSessionId } from '../sessionId';
import { api } from "@convex/_generated/api";
import type { SerializedMessage } from "@convex/messages";
import type { Message } from "@ai-sdk/react";
import { setKnownUrlId } from "../chatId";
import { setKnownInitialId } from "../chatId";
import { description } from "../description";
import { webcontainer } from "~/lib/webcontainer";
import { makePartId, type PartId } from "../artifacts";
import { loadSnapshot } from "~/lib/snapshot";

export function useInitialMessages(chatId: string) {
    const convex = useConvex();

    // Messages that should be displayed + fed into the chat -- this is a prefix
    // of the messages stored in the database (because there's a feature to rewind to a user message)
    const [initialMessages, setInitialMessages] = useState<SerializedMessage[]>([]);
    // The deserialized version of `initialMessages`
    const [initialDeserializedMessages, setInitialDeserializedMessages] = useState<Message[]>([]);

    const [isLoading, setIsLoading] = useState(true);
    const [ready, setReady] = useState(false);

    useEffect(() => {
        const loadInitialMessages = async () => {
            const sessionId = await waitForConvexSessionId('loadInitialMessages');
            try {
                const rawMessages = await convex.mutation(api.messages.getInitialMessages, {
                    id: chatId,
                    sessionId,
                    rewindToMessageId: null,
                });
                if (rawMessages === null || rawMessages.messages.length === 0) {
                    return;
                }

                setKnownInitialId(rawMessages.initialId);
                if (rawMessages.urlId) {
                    setKnownUrlId(rawMessages.urlId);
                }

                setInitialMessages(rawMessages.messages);

                const deserializedMessages = rawMessages.messages.map(deserializeMessageForConvex);
                setInitialDeserializedMessages(deserializedMessages);

                description.set(rawMessages.description);

                const container = await webcontainer;
                const { workbenchStore } = await import('~/lib/stores/workbench');

                const partIds: PartId[] = [];
                for (const message of rawMessages.messages) {
                    if (message.parts) {
                        for (let i = 0; i < message.parts.length; i++) {
                            partIds.push(makePartId(message.id, i));
                        }
                    }
                }
                workbenchStore.setReloadedParts(partIds);
                await loadSnapshot(container, workbenchStore, rawMessages.id);
                setReady(true);
            } catch (error) {
                console.error('Error fetching initial messages:', error);
            } finally {
                setIsLoading(false);
            }
        };
        void loadInitialMessages();
    }, [convex, chatId, setReady, setIsLoading]);

    return {
        ready: ready && !isLoading,
        isLoading,
        initialMessages,
        initialDeserializedMessages,
    };
}



function deserializeMessageForConvex(message: SerializedMessage): Message {
    return {
        ...message,
        createdAt: message.createdAt ? new Date(message.createdAt) : undefined,
    };
}

