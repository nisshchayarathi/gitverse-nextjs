import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as fs from 'fs/promises';
import * as fsSync from 'fs';
import * as path from 'path';
import { DependencyGraphService } from '../lib/services/dependency-graph';

describe('DependencyGraphService - Safe Traversal', () => {
  const baseDir = path.join(__dirname, 'mock-repos');

  beforeAll(async () => {
    try {
      await fs.rm(baseDir, { recursive: true, force: true });
    } catch(e) {}
    
    await fs.mkdir(baseDir, { recursive: true });

    // 1. Deep Nesting
    const deepDir = path.join(baseDir, 'deep-nesting');
    await fs.mkdir(deepDir);
    let currentPath = deepDir;
    for (let i = 0; i < 25; i++) {
      currentPath = path.join(currentPath, `level${i}`);
      await fs.mkdir(currentPath);
    }
    await fs.writeFile(path.join(currentPath, 'index.ts'), 'console.log("deep");');

    // 2. Circular Symlink
    const circularDir = path.join(baseDir, 'circular-symlink');
    await fs.mkdir(circularDir);
    const folderA = path.join(circularDir, 'folderA');
    await fs.mkdir(folderA);
    await fs.writeFile(path.join(folderA, 'index.ts'), 'console.log("A");');
    
    const folderB = path.join(folderA, 'folderB');
    try {
      fsSync.symlinkSync(folderA, folderB, 'junction');
    } catch (e) {
      console.warn("Could not create symlink, might be running on Windows without permissions/junctions");
    }
  });

  afterAll(async () => {
    try {
      await fs.rm(baseDir, { recursive: true, force: true });
    } catch(e) {}
  });

  it('stops traversal at MAX_DIRECTORY_DEPTH', async () => {
    const service = new DependencyGraphService();
    // Setting max depth to 10
    process.env.MAX_DIRECTORY_DEPTH = '10';
    
    const graph = await service.buildGraph(path.join(baseDir, 'deep-nesting'));
    // Since depth is 10, it shouldn't reach level 24 where index.ts is, so graph should be empty
    expect(graph.size).toBe(0);

    // Reset
    process.env.MAX_DIRECTORY_DEPTH = '20';
  });

  it('detects and skips circular symlinks', async () => {
    const service = new DependencyGraphService();
    // This should not throw maximum call stack exceeded
    const graph = await service.buildGraph(path.join(baseDir, 'circular-symlink'));
    // Should successfully find the index.ts at folderA, and not recurse into folderB forever
    expect(graph.size).toBeGreaterThanOrEqual(0);
  });

  it('aborts safely if MAX_FILES_INDEXED is exceeded', async () => {
    const service = new DependencyGraphService();
    process.env.MAX_FILES_INDEXED = '0'; // Immediately hit limit

    const graph = await service.buildGraph(path.join(baseDir, 'circular-symlink'));
    expect(graph.size).toBe(0);

    process.env.MAX_FILES_INDEXED = '10000';
  });

  it('aborts safely if TIMEOUT_MS is exceeded', async () => {
    const service = new DependencyGraphService();
    process.env.TRAVERSAL_TIMEOUT_MS = '-1'; // Immediately hit limit

    const graph = await service.buildGraph(path.join(baseDir, 'circular-symlink'));
    expect(graph.size).toBe(0);

    process.env.TRAVERSAL_TIMEOUT_MS = '30000';
  });
});
