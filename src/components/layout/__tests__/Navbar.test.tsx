// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";

jest.mock("next/link", () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

vi.mock("lucide-react", () => ({
  GitBranch: () => <svg data-testid="git-branch" />,
  Menu: () => <svg data-testid="menu" />,
  X: () => <svg data-testid="x" />,
}));

vi.mock("@/components/ui", () => ({
  Button: ({ children, ...props }: any) => <button {...props}>{children}</button>,
}));

vi.mock("@/components/ThemeToggle", () => ({
  ThemeToggle: () => <button data-testid="theme-toggle">Toggle</button>,
}));

import { Navbar } from "../Navbar";

describe("Navbar", () => {
  it("renders without crashing", () => {
    render(<Navbar />);
    expect(screen.getByText("GitVerse")).toBeDefined();
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
