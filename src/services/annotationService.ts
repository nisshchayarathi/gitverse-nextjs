import axios from "axios";
import { buildApiUrl } from "./apiConfig";

export interface Author {
  id: number;
  name: string;
  image: string | null;
}

export interface MapAnnotation {
  id: string;
  repositoryId: number;
  authorId: number;
  targetType: 'node' | 'edge';
  targetId: string;
  content: string;
  annotationType: 'comment' | 'warning' | 'technical-debt' | 'refactor' | 'documentation' | 'issue-link';
  positionX?: number | null;
  positionY?: number | null;
  createdAt: string;
  updatedAt: string;
  author?: Author;
}

export const annotationService = {
  async getAnnotations(repositoryId: number): Promise<MapAnnotation[]> {
    const token = localStorage.getItem("gitverse_token");
    const response = await axios.get(buildApiUrl(`/api/annotations?repositoryId=${repositoryId}`), {
      headers: { Authorization: `Bearer ${token}` }
    });
    return response.data.annotations || [];
  },

  async createAnnotation(data: Partial<MapAnnotation>): Promise<MapAnnotation> {
    const token = localStorage.getItem("gitverse_token");
    const response = await axios.post(buildApiUrl(`/api/annotations`), data, {
      headers: { Authorization: `Bearer ${token}` }
    });
    return response.data.annotation;
  },

  async updateAnnotation(id: string, data: Partial<MapAnnotation>): Promise<MapAnnotation> {
    const token = localStorage.getItem("gitverse_token");
    const response = await axios.patch(buildApiUrl(`/api/annotations/${id}`), data, {
      headers: { Authorization: `Bearer ${token}` }
    });
    return response.data.annotation;
  },

  async deleteAnnotation(id: string): Promise<boolean> {
    const token = localStorage.getItem("gitverse_token");
    const response = await axios.delete(buildApiUrl(`/api/annotations/${id}`), {
      headers: { Authorization: `Bearer ${token}` }
    });
    return response.data.success;
  },

  subscribeToAnnotations(repositoryId: number, onMessage: (event: any) => void): () => void {
    const token = localStorage.getItem("gitverse_token") || "";
    // In production you would securely handle SSE token authentication
    const url = buildApiUrl(`/api/annotations/sync?repositoryId=${repositoryId}&token=${token}`);
    const eventSource = new EventSource(url);

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        onMessage(data);
      } catch (e) {
        console.error("Error parsing annotation event", e);
      }
    };

    eventSource.onerror = (error) => {
      console.error("SSE Connection Error:", error);
    };

    return () => {
      eventSource.close();
    };
  }
};
