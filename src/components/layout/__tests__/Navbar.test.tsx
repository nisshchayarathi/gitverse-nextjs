import React from "react";
import { render, screen } from "@testing-library/react";

jest.mock("next/link", () => {
  const MockLink = ({ children, href, ...props }: any) =>
    React.createElement("a", { href, ...props }, children);
  return MockLink;
});

jest.mock("lucide-react", () => ({
  GitBranch: () => <svg data-testid="git-branch" />,
  Menu: () => <svg data-testid="menu" />,
  X: () => <svg data-testid="x" />,
}));

jest.mock("@/components/ui", () => ({
  Button: ({ children, ...props }: any) => <button {...props}>{children}</button>,
  ThemeToggle: () => <button data-testid="theme-toggle">Toggle</button>,
}));

import { Navbar } from "../Navbar";

describe("Navbar", () => {
  it("renders without crashing", () => {
    const { container } = render(<Navbar />);
    expect(container.querySelector("nav")).toBeTruthy();
  });

  it("renders navigation links", () => {
    render(<Navbar />);
    expect(screen.getByText((content) => content.includes("Features"))).toBeDefined();
    expect(screen.getByText((content) => content.includes("How it Works"))).toBeDefined();
    expect(screen.getByText((content) => content.includes("Pricing"))).toBeDefined();
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
