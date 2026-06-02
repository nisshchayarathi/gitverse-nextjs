import { NextRequest } from "next/server";
import { EventEmitter } from "events";

import { addClient, removeClient } from "@/lib/services/annotationSync";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const repositoryId = searchParams.get("repositoryId");

  if (!repositoryId) {
    return new Response("Missing repositoryId", { status: 400 });
  }

  const clientId = crypto.randomUUID();
  let responseController: ReadableStreamDefaultController;

  const stream = new ReadableStream({
    start(controller) {
      responseController = controller;
      addClient(repositoryId, { id: clientId, controller });
    },
    cancel() {
      removeClient(repositoryId, clientId);
    }
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive"
    }
  });
}
