import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { fireEvent } from "@testing-library/dom";

// Mock ESM dependencies before importing the client component
jest.mock("react-markdown", () => ({
  __esModule: true,
  default: ({ children }: any) => <div data-testid="mock-markdown">{children}</div>,
}));
jest.mock("remark-gfm", () => ({}));
jest.mock("rehype-sanitize", () => {
  const mockSanitize = () => {};
  (mockSanitize as any).defaultSchema = {};
  return {
    __esModule: true,
    default: mockSanitize,
    defaultSchema: {},
  };
});

import { AIChatInterface, extractFilePaths } from "../AIChatInterface";
import { geminiService } from "@/services/gemini";

// Mock useParams
jest.mock("next/navigation", () => ({
  useParams: () => ({ id: "123" }),
}));

// Mock AuthContext
jest.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    isAuthenticated: true,
    isLoading: false,
  }),
}));

// Mock toast
jest.mock("@/hooks/use-toast", () => ({
  useToast: () => ({
    toast: jest.fn(),
  }),
}));

// Mock syntax highlighter to avoid rendering overhead
jest.mock("react-syntax-highlighter", () => ({
  Prism: ({ children }: any) => <pre data-testid="syntax-highlighter">{children}</pre>,
}));

// Mock geminiService
jest.mock("@/services/gemini", () => ({
  geminiService: {
    chatStream: jest.fn(),
  },
}));

describe("AIChatInterface - Codebase Chat Reference Cards", () => {
  const mockFetch = jest.fn();

  beforeAll(() => {
    global.fetch = mockFetch;
    window.HTMLElement.prototype.scrollIntoView = jest.fn();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("extractFilePaths utility", () => {
    it("should extract file paths in brackets, backticks, and raw paths with slashes", () => {
      const text = `
Here is the file you requested: [src/components/Button.tsx].
Also check \`lib/utils/cache.ts\` and raw path src/index.ts for details.
      `;
      const paths = extractFilePaths(text);
      expect(paths).toContain("src/components/Button.tsx");
      expect(paths).toContain("lib/utils/cache.ts");
      expect(paths).toContain("src/index.ts");
      expect(paths.length).toBe(3);
    });

    it("should ignore non-file strings", () => {
      const text = "This is a simple text without any paths.";
      const paths = extractFilePaths(text);
      expect(paths.length).toBe(0);
    });
  });

  describe("AIChatInterface Component Rendering", () => {
    it("should render greeting and suggested questions initially", () => {
      render(<AIChatInterface repositoryContext={{ name: "test-repo", languages: ["TypeScript"] }} />);
      
      expect(screen.getByText(/Hello! I'm your AI assistant for the/)).toBeInTheDocument();
      expect(screen.getByText("Can you explain the main architecture of this repository?")).toBeInTheDocument();
    });
  });

  describe("Interactive Code Drawer", () => {
    it("should open code drawer and fetch content when a reference card is clicked", async () => {
      const repositoryContext = { name: "test-repo", languages: ["TypeScript"] };

      // Mock chatStream async generator
      const mockStream = async function* () {
        yield "Check out the file ";
        yield "[src/components/Button.tsx]";
        yield " for the implementation.";
      };
      (geminiService.chatStream as jest.Mock).mockReturnValue(mockStream());

      // Mock file content fetch
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          content: "export const MyButton = () => <button>Click</button>;\n// line 2\n// line 3",
          path: "src/components/Button.tsx",
        }),
      });

      render(<AIChatInterface repositoryContext={repositoryContext} />);

      // Type a question
      const input = screen.getByPlaceholderText("Ask me anything about your repository...");
      fireEvent.change(input, { target: { value: "Where is the button?" } });

      // Click send
      const sendButton = screen.getByRole("button", { name: /send/i });
      fireEvent.click(sendButton);

      // Wait for the message and reference card to render
      await waitFor(() => {
        expect(screen.getByText("Button.tsx")).toBeInTheDocument();
      });

      // Reference card should show path
      expect(screen.getByText("src/components/Button.tsx")).toBeInTheDocument();

      // Click on the reference card
      const cardButton = screen.getByTitle("Inspect src/components/Button.tsx");
      fireEvent.click(cardButton);

      // Drawer should show loader then code
      await waitFor(() => {
        expect(screen.getByTestId("syntax-highlighter")).toBeInTheDocument();
      });

      // Verify metadata is displayed
      expect(screen.getByText("3 lines")).toBeInTheDocument();
      expect(screen.getByText("73 B")).toBeInTheDocument(); // length of content is 73 chars

      // Verify code content is displayed inside syntax highlighter
      expect(screen.getByText(/export const MyButton/)).toBeInTheDocument();

      // Close the drawer
      const closeButton = screen.getByTitle("Close");
      fireEvent.click(closeButton);

      // Wait for drawer to close
      await waitFor(() => {
        expect(screen.queryByTestId("syntax-highlighter")).not.toBeInTheDocument();
      });
    });
  });
});
