import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { fireEvent } from "@testing-library/dom";
import { CodeDependencyGraph } from "../CodeDependencyGraph";

// Mock html-to-image
jest.mock("html-to-image", () => ({
  toPng: jest.fn().mockResolvedValue("data:image/png;base64,mock"),
  toSvg: jest.fn().mockResolvedValue("data:image/svg+xml,mock")
}));

// Mock sonner toast
jest.mock("sonner", () => ({
  toast: {
    loading: jest.fn().mockReturnValue("toast-id"),
    success: jest.fn(),
    error: jest.fn()
  }
}));

// Mock annotationService
jest.mock("@/services/annotationService", () => ({
  annotationService: {
    getAnnotations: jest.fn().mockResolvedValue([]),
    subscribeToAnnotations: jest.fn().mockReturnValue(() => jest.fn())
  }
}));

// Mock useGraphFilters
jest.mock("@/hooks/useGraphFilters", () => ({
  useGraphFilters: () => ({
    filters: {
      hiddenDirectories: [],
      hiddenFileTypes: [],
      visibleDomains: []
    },
    toggleDirectory: jest.fn(),
    toggleFileType: jest.fn(),
    toggleDomain: jest.fn(),
    resetFilters: jest.fn()
  })
}));

// Mock useGraphDrilldown
jest.mock("@/hooks/useGraphDrilldown", () => ({
  useGraphDrilldown: () => ({
    expandedNodes: new Set(["folder-src", "folder-src/utils", "folder-src/components"]),
    toggleExpand: jest.fn(),
    collapseAll: jest.fn(),
    focusNode: null,
    setFocus: jest.fn(),
    clearFocus: jest.fn(),
    goBack: jest.fn(),
    canGoBack: false
  })
}));

jest.mock("d3", () => {
  const mockSelect = {
    selectAll: jest.fn().mockReturnThis(),
    remove: jest.fn().mockReturnThis(),
    append: jest.fn().mockReturnThis(),
    attr: jest.fn().mockReturnThis(),
    style: jest.fn().mockReturnThis(),
    text: jest.fn().mockReturnThis(),
    call: jest.fn().mockReturnThis(),
    transition: jest.fn().mockReturnThis(),
    duration: jest.fn().mockReturnThis(),
    delay: jest.fn().mockReturnThis(),
    on: jest.fn().mockReturnThis(),
    filter: jest.fn().mockReturnThis(),
    data: jest.fn().mockReturnThis(),
    join: jest.fn().mockReturnThis(),
  };

  const mockSimulation = {
    force: jest.fn().mockReturnThis(),
    on: jest.fn().mockReturnThis(),
    stop: jest.fn().mockReturnThis(),
    alphaTarget: jest.fn().mockReturnThis(),
    restart: jest.fn().mockReturnThis(),
  };

  const zoomFn = jest.fn().mockImplementation((selection) => selection);
  (zoomFn as any).scaleExtent = jest.fn().mockReturnValue(zoomFn);
  (zoomFn as any).on = jest.fn().mockReturnValue(zoomFn);
  (zoomFn as any).transform = jest.fn();

  return {
    min: (arr: any[], accessor: (d: any) => number) => {
      if (!arr || arr.length === 0) return undefined;
      return Math.min(...arr.map(accessor).filter(v => typeof v === 'number' && !isNaN(v)));
    },
    max: (arr: any[], accessor: (d: any) => number) => {
      if (!arr || arr.length === 0) return undefined;
      return Math.max(...arr.map(accessor).filter(v => typeof v === 'number' && !isNaN(v)));
    },
    select: jest.fn().mockReturnValue(mockSelect),
    zoom: jest.fn().mockReturnValue(zoomFn),
    zoomIdentity: {
      translate: jest.fn().mockReturnThis(),
      scale: jest.fn().mockReturnThis(),
    },
    forceSimulation: jest.fn().mockReturnValue(mockSimulation),
    forceLink: jest.fn().mockReturnValue({
      id: jest.fn().mockReturnThis(),
      distance: jest.fn().mockReturnThis(),
      strength: jest.fn().mockReturnThis(),
    }),
    forceManyBody: jest.fn().mockReturnValue({
      strength: jest.fn().mockReturnThis(),
    }),
    forceCenter: jest.fn().mockReturnValue({}),
    forceCollide: jest.fn().mockReturnValue({
      radius: jest.fn().mockReturnThis(),
    }),
    drag: jest.fn().mockReturnValue({
      on: jest.fn().mockReturnThis(),
    }),
  };
});

describe("CodeDependencyGraph Search & Filter Panel", () => {
  const mockRepository = {
    id: "repo-123",
    name: "test-repo",
    files: [
      {
        path: "src/index.ts",
        lines: 100,
        size: 1000,
        dependencies: ["src/utils/math.ts", "src/components/Button.tsx"]
      },
      {
        path: "src/utils/math.ts",
        lines: 50,
        size: 500,
        dependencies: []
      },
      {
        path: "src/components/Button.tsx",
        lines: 150,
        size: 1500,
        dependencies: []
      },
      {
        path: "package.json",
        lines: 30,
        size: 300,
        dependencies: []
      }
    ],
    commits: []
  };

  beforeAll(() => {
    Object.defineProperty(HTMLElement.prototype, "clientWidth", {
      configurable: true,
      value: 800
    });
    Object.defineProperty(HTMLElement.prototype, "clientHeight", {
      configurable: true,
      value: 600
    });
  });

  it("renders search and filter controls panel successfully", () => {
    render(<CodeDependencyGraph repository={mockRepository} />);

    // Assert that the controls are present
    expect(screen.getByText("Search Nodes")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Search file or folder...")).toBeInTheDocument();
    expect(screen.getByLabelText("Folders")).toBeInTheDocument();
    expect(screen.getByLabelText("Files")).toBeInTheDocument();
    expect(screen.getByText("Min Connections")).toBeInTheDocument();
  });

  it("filters nodes based on file/folder checkboxes", async () => {
    render(<CodeDependencyGraph repository={mockRepository} />);

    const foldersCheckbox = screen.getByLabelText("Folders") as HTMLInputElement;
    const filesCheckbox = screen.getByLabelText("Files") as HTMLInputElement;

    expect(foldersCheckbox.checked).toBe(true);
    expect(filesCheckbox.checked).toBe(true);

    // Turn off folder nodes
    fireEvent.click(foldersCheckbox);
    expect(foldersCheckbox.checked).toBe(false);

    // Turn off file nodes
    fireEvent.click(filesCheckbox);
    expect(filesCheckbox.checked).toBe(false);

    // Verify empty state is rendered when both are hidden
    const d3 = require("d3");
    await waitFor(() => {
      expect(d3.select().text).toHaveBeenCalledWith("No nodes match the filters");
    });
  });

  it("filters files by extension selection", async () => {
    render(<CodeDependencyGraph repository={mockRepository} />);

    // Check that extension selection dropdown is present
    const select = screen.getByRole("combobox") as HTMLSelectElement;
    expect(select).toBeInTheDocument();

    // Select ".tsx" extension
    fireEvent.change(select, { target: { value: ".tsx" } });
    expect(select.value).toBe(".tsx");
  });

  it("filters nodes based on centrality (min connections) slider", () => {
    render(<CodeDependencyGraph repository={mockRepository} />);

    const slider = screen.getByRole("slider") as HTMLInputElement;
    expect(slider).toBeInTheDocument();
    expect(slider.value).toBe("0");

    // Change slider value
    fireEvent.change(slider, { target: { value: "3" } });
    expect(slider.value).toBe("3");
  });

  it("handles autocomplete search and selection", async () => {
    render(<CodeDependencyGraph repository={mockRepository} />);

    const searchInput = screen.getByPlaceholderText("Search file or folder...") as HTMLInputElement;
    
    // Type a query
    fireEvent.change(searchInput, { target: { value: "math" } });
    expect(searchInput.value).toBe("math");

    // Wait for autocomplete suggestion and click it
    const button = await screen.findByRole("button", { name: /math\.ts/i });
    expect(button).toBeInTheDocument();

    fireEvent.click(button);

    // Verify input value is updated to selected node name
    expect(searchInput.value).toBe("math.ts");
  });
});
