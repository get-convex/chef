export const presenceComponentReadmePrompt = `
# Convex PresenceComponent

A Convex component for managing presence functionality, i.e., a live-updating
list of users in a "room" including their status for when they were last online.

It can be tricky to implement presence efficiently, without any polling and
without re-running queries every time a user sends a heartbeat message. This
component implements presence via Convex scheduled functions such that clients
only receive updates when a user joins or leaves the room.

The most common use case for this component is via the usePresence hook, which
takes care of sending heartbeart messages to the server and gracefully
disconnecting a user when the tab is closed.

See \`example\` for an example of how to incorporate this hook into your
application.

## Installation

\`\`\`bash
npm install @convex-dev/presence
\`\`\`

## Usage

First, add the component to your Convex app:

\`convex/convex.config.ts\`

\`\`\`ts
import { defineApp } from "convex/server";
import presence from "@convex-dev/presence/convex.config";

const app = defineApp();
app.use(presence);
export default app;
\`\`\`

\`convex/presence.ts\`

\`\`\`ts
import { mutation, query } from "./_generated/server";
import { components } from "./_generated/api";
import { v } from "convex/values";
import { Presence } from "@convex-dev/presence";
import { getAuthUserId } from "@convex-dev/auth/server";

export const presence = new Presence(components.presence);

export const getUserId = query({
  args: {},
  returns: v.union(v.string(), v.null()),
  handler: async (ctx) => {
    return await getAuthUserId(ctx);
  },
});

export const heartbeat = mutation({
  args: { roomId: v.string(), userId: v.string(), sessionId: v.string(), interval: v.number() },
  handler: async (ctx, { roomId, userId, sessionId, interval }) => {
    const authUserId = await getAuthUserId(ctx);
    if (!authUserId) {
      throw new Error("Not authenticated");
    }
    return await presence.heartbeat(ctx, roomId, authUserId, sessionId, interval);
  },
});

export const list = query({
  args: { roomToken: v.string() },
  handler: async (ctx, { roomToken }) => {
    const presenceList = await presence.list(ctx, roomToken);
    const listWithUserInfo = await Promise.all(
      presenceList.map(async (entry) => {
        const user = await ctx.db.get(entry.userId as Id<"users">);
        if (!user) {
          return entry;
        }
        return {
          ...entry,
          name: user?.name,
          image: user?.image,
        };
      })
    );
    return listWithUserInfo;
  },
});

export const disconnect = mutation({
  args: { sessionToken: v.string() },
  handler: async (ctx, { sessionToken }) => {
    return await presence.disconnect(ctx, sessionToken);
  },
});
\`\`\`

A \`Presence\` React component can be instantiated from your client code like this:

\`src/App.tsx\`

\`\`\`tsx
import { api } from "../convex/_generated/api";
import usePresence from "@convex-dev/presence/react";
import FacePile from "@convex-dev/presence/facepile";

export default function App(): React.ReactElement {
  const userId = useQuery(api.presence.getUserId);
  
  return (
    <main>
      {userId && <PresenceIndicator userId={userId} />}
    </main>
  );
}

function PresenceIndicator({ userId }: { userId: string }) {
  const presenceState = usePresence(api.presence, "my-chat-room", userId);
  return <FacePile presenceState={presenceState ?? []} />;
}
\`\`\`

This is the function signature for the \`usePresence\` hook:

\`\`\`ts
export default function usePresence(
  presence: PresenceAPI,
  roomId: string,
  userId: string,
  interval: number = 10000,
  convexUrl?: string
): PresenceState[] | undefined
\`\`\`

ALWAYS use the \`FacePile\` UI component included with this package unless the user
explicitly requests to use a custom presence UI. You can copy this code and use the
\`usePresence\` hook directly to implement your own styling.
`;
