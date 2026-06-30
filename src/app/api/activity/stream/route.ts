import { NextRequest } from "next/server";
import { getSessionUserId } from "@/lib/session";
import { activityEvents } from "@/lib/activity-events";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const userId = await getSessionUserId();
  if (!userId) {
    return new Response("Unauthorized", { status: 401 });
  }

  const encoder = new TextEncoder();
  const channel = `activity:${userId}`;

  let send: (data: unknown) => void;

  const stream = new ReadableStream({
    start(controller) {
      send = (data: unknown) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      };

      // Initial comment to open the stream immediately
      controller.enqueue(encoder.encode(`: connected\n\n`));

      activityEvents.on(channel, send);

      // Heartbeat every 25s to keep proxies/load balancers from closing the connection
      const heartbeat = setInterval(() => {
        controller.enqueue(encoder.encode(`: ping\n\n`));
      }, 25000);

      req.signal.addEventListener("abort", () => {
        clearInterval(heartbeat);
        activityEvents.off(channel, send);
        controller.close();
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}