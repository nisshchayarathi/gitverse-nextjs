/**
 * Maps dependencies from package.json to a list of major technology names.
 */
export function extractTechStack(packageJson: {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
}): string[] {
  const techStack = new Set<string>();

  const deps = {
    ...packageJson.dependencies,
    ...packageJson.devDependencies,
  };

  const depKeys = Object.keys(deps).map((k) => k.toLowerCase());

  if (depKeys.length === 0) {
    return [];
  }

  // TypeScript
  if (depKeys.includes("typescript") || depKeys.some((k) => k.startsWith("@types/"))) {
    techStack.add("TypeScript");
  }

  // Next.js
  if (depKeys.includes("next")) {
    techStack.add("Next.js");
  }

  // React
  if (depKeys.includes("react") || depKeys.includes("react-dom") || depKeys.includes("next")) {
    techStack.add("React");
  }

  // Tailwind CSS
  if (depKeys.includes("tailwindcss")) {
    techStack.add("Tailwind CSS");
  }

  // Prisma
  if (depKeys.includes("prisma") || depKeys.includes("@prisma/client")) {
    techStack.add("Prisma");
  }

  // Express
  if (depKeys.includes("express") || depKeys.some((k) => k.startsWith("@types/express"))) {
    techStack.add("Express");
  }

  // Vue
  if (depKeys.includes("vue") || depKeys.includes("@vue/cli-service") || depKeys.includes("nuxt")) {
    techStack.add("Vue");
  }

  // Angular
  if (depKeys.includes("@angular/core") || depKeys.includes("@angular/cli")) {
    techStack.add("Angular");
  }

  // MongoDB
  if (depKeys.includes("mongodb") || depKeys.includes("mongoose")) {
    techStack.add("MongoDB");
  }

  // NestJS
  if (depKeys.includes("@nestjs/core") || depKeys.includes("nestjs")) {
    techStack.add("NestJS");
  }

  // Svelte
  if (depKeys.includes("svelte") || depKeys.includes("@sveltejs/kit")) {
    techStack.add("Svelte");
  }

  // Vite
  if (depKeys.includes("vite")) {
    techStack.add("Vite");
  }

  // Redux
  if (depKeys.includes("redux") || depKeys.includes("@reduxjs/toolkit") || depKeys.includes("react-redux")) {
    techStack.add("Redux");
  }

  // Astro
  if (depKeys.includes("astro")) {
    techStack.add("Astro");
  }

  // SolidJS
  if (depKeys.includes("solid-js")) {
    techStack.add("SolidJS");
  }

  // Electron
  if (depKeys.includes("electron")) {
    techStack.add("Electron");
  }

  // Fastify
  if (depKeys.includes("fastify")) {
    techStack.add("Fastify");
  }

  // Koa
  if (depKeys.includes("koa")) {
    techStack.add("Koa");
  }

  // Webpack
  if (depKeys.includes("webpack")) {
    techStack.add("Webpack");
  }

  // Bootstrap
  if (depKeys.includes("bootstrap")) {
    techStack.add("Bootstrap");
  }

  // jQuery
  if (depKeys.includes("jquery")) {
    techStack.add("jQuery");
  }

  // GraphQL
  if (depKeys.includes("graphql") || depKeys.includes("@apollo/client") || depKeys.includes("apollo-server")) {
    techStack.add("GraphQL");
  }
  return Array.from(techStack);
}
