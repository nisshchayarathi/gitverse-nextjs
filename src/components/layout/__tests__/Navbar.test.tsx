import { render, screen } from "@testing-library/react";

jest.mock("next/link", () => ({
  __esModule: true,
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

jest.mock("lucide-react", () => ({
  __esModule: true,
  GitBranch: () => <svg data-testid="git-branch" />,
  Menu: () => <svg data-testid="menu" />,
  X: () => <svg data-testid="x" />,
}));

jest.mock("@/components/ui", () => ({
  __esModule: true,
  Button: ({ children, ...props }: any) => <button {...props}>{children}</button>,
  ThemeToggle: () => <button data-testid="theme-toggle">Toggle</button>,
}));

import { Navbar } from "../Navbar";

describe("Navbar", () => {
  it("renders without crashing", () => {
    render(<Navbar />);
    expect(screen.getByText(/Git/i)).toBeDefined();
  });

  it("renders navigation links", () => {
    render(<Navbar />);
    expect(screen.getByText("Features")).toBeDefined();
    expect(screen.getByText("How it Works")).toBeDefined();
    expect(screen.getByText("Pricing")).toBeDefined();
  });

  it("renders sign in and get started buttons", () => {
    render(<Navbar />);
    expect(screen.getByText("Sign In")).toBeDefined();
    expect(screen.getByText("Get Started")).toBeDefined();
  });

  it("renders theme toggle", () => {
    render(<Navbar />);
    expect(screen.getByTestId("theme-toggle")).toBeDefined();
  });
});
