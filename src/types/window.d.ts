export {};

declare global {
  interface Window {
    garlicSauce?: {
      platform: NodeJS.Platform;
      versions: {
        chrome: string;
        electron: string;
        node: string;
      };
    };
  }
}
