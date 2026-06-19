import { exportGraphAsSVG } from "../../svgExporter";

describe("svgExporter", () => {
  let originalCreateObjectURL: any;
  let originalRevokeObjectURL: any;
  let originalClick: any;
  let mockUrl: string;

  beforeAll(() => {
    // Mock URL methods
    originalCreateObjectURL = URL.createObjectURL;
    originalRevokeObjectURL = URL.revokeObjectURL;
    mockUrl = "blob:http://localhost/mock-uuid";
    URL.createObjectURL = jest.fn(() => mockUrl);
    URL.revokeObjectURL = jest.fn();

    // Mock HTMLAnchorElement click
    originalClick = HTMLAnchorElement.prototype.click;
    HTMLAnchorElement.prototype.click = jest.fn();
  });

  afterAll(() => {
    URL.createObjectURL = originalCreateObjectURL;
    URL.revokeObjectURL = originalRevokeObjectURL;
    HTMLAnchorElement.prototype.click = originalClick;
  });

  it("should clean and export the SVG in current view mode", () => {
    // Create a mock SVG structure
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg") as any as SVGSVGElement;
    svg.setAttribute("viewBox", "0 0 100 100");
    
    const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
    g.setAttribute("transform", "translate(10, 20) scale(1.5)");
    svg.appendChild(g);

    // Mock getBoundingClientRect
    svg.getBoundingClientRect = () => ({
      width: 500,
      height: 400,
      top: 0,
      left: 0,
      right: 500,
      bottom: 400,
      x: 0,
      y: 0,
      toJSON: () => {}
    });

    exportGraphAsSVG(svg, "current", "test-current.svg");

    // Expect createObjectURL to have been called with a blob
    expect(URL.createObjectURL).toHaveBeenCalled();
    const mockBlob = (URL.createObjectURL as jest.Mock).mock.calls[0][0];
    expect(mockBlob).toBeInstanceOf(Blob);

    // Verify blob content
    const reader = new FileReader();
    reader.onload = () => {
      const text = reader.result as string;
      expect(text).toContain('viewBox="0 0 500 400"');
      expect(text).toContain('width="500"');
      expect(text).toContain('height="400"');
      expect(text).toContain('transform="translate(10, 20) scale(1.5)"');
    };
    reader.readAsText(mockBlob);
  });

  it("should clean and export the SVG in full map mode", () => {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg") as any as SVGSVGElement;
    svg.setAttribute("viewBox", "0 0 100 100");
    
    const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
    g.setAttribute("transform", "translate(10, 20) scale(1.5)");
    svg.appendChild(g);

    // Mock getBBox on the group element
    (g as any).getBBox = () => ({
      x: 50,
      y: 50,
      width: 200,
      height: 150
    });

    exportGraphAsSVG(svg, "full", "test-full.svg");

    expect(URL.createObjectURL).toHaveBeenCalled();
    const mockBlob = (URL.createObjectURL as jest.Mock).mock.calls[1][0];
    expect(mockBlob).toBeInstanceOf(Blob);

    // Verify blob content
    const reader = new FileReader();
    reader.onload = () => {
      const text = reader.result as string;
      // In full map mode, the transform attribute is removed
      expect(text).not.toContain('transform="translate(10, 20) scale(1.5)"');
      // Bounding box calculation:
      // x = 50 - 50 = 0
      // y = 50 - 50 = 0
      // width = 200 + 100 = 300
      // height = 150 + 100 = 250
      expect(text).toContain('viewBox="0 0 300 250"');
      expect(text).toContain('width="300"');
      expect(text).toContain('height="250"');
    };
    reader.readAsText(mockBlob);
  });
});
