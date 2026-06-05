// Simple in-memory pubsub for annotation events
type Client = { id: string; controller: ReadableStreamDefaultController };
const clients: Map<string, Client[]> = new Map();

export function addClient(repositoryId: string, client: Client) {
  if (!clients.has(repositoryId)) {
    clients.set(repositoryId, []);
  }
  clients.get(repositoryId)!.push(client);
}

export function removeClient(repositoryId: string, clientId: string) {
  if (!clients.has(repositoryId)) return;
  const repoClients = clients.get(repositoryId)!;
  const index = repoClients.findIndex(c => c.id === clientId);
  if (index !== -1) {
    repoClients.splice(index, 1);
  }
}

export function broadcastAnnotationEvent(repositoryId: string, event: any) {
  const repoClients = clients.get(repositoryId);
  if (!repoClients) return;

  const message = `data: ${JSON.stringify(event)}\n\n`;
  repoClients.forEach(client => {
    try {
      client.controller.enqueue(new TextEncoder().encode(message));
    } catch (e) {
      console.warn("Failed to broadcast to client", client.id);
    }
  });
}
