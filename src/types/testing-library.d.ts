declare module '@testing-library/react' {
  import * as RTL from '@testing-library/react';
  export const render: typeof RTL.render;
  export const renderHook: typeof RTL.renderHook;
  export const act: typeof RTL.act;
  export const screen: typeof RTL.screen;
  export const waitFor: typeof RTL.waitFor;
  export * from '@testing-library/react';
}
