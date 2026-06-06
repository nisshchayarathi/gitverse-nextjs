<<<<<<< HEAD
// @jest-environment jsdom
import { render, screen } from "@testing-library/react";

jest.mock("next/link", () => ({
  default: ({
    children,
    href,
  }: {
    children: React.ReactNode;
    href: string;
  }) => <a href={href}>{children}</a>,
}));
=======
import React from "react";
import { render, screen } from "@testing-library/react";

jest.mock("next/link", () => {
  const MockLink = ({ children, href, ...props }: any) =>
    React.createElement("a", { href, ...props }, children);
  return MockLink;
});
>>>>>>> ede0d665ec4d448aa73484ccb136b2157752c0da

jest.mock("lucide-react", () => ({
  GitBranch: () => <svg data-testid="git-branch" />,
  Menu: () => <svg data-testid="menu" />,
  X: () => <svg data-testid="x" />,
}));

jest.mock("@/components/ui", () => ({
<<<<<<< HEAD
  Button: ({ children, ...props }: any) => (
    <button {...props}>{children}</button>
  ),
}));

jest.mock("@/components/ThemeToggle", () => ({
=======
  Button: ({ children, ...props }: any) => <button {...props}>{children}</button>,
>>>>>>> ede0d665ec4d448aa73484ccb136b2157752c0da
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
