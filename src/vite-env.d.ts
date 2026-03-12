/// <reference types="vite/client" />

declare global {
  interface Window {
    prerenderReady: boolean;
  }
}

export {};
