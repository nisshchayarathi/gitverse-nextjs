export interface AIContext {
  moduleName: string;
  files: { path: string; size: number }[];
}
