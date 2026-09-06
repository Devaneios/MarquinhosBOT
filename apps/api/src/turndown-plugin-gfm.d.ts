declare module 'turndown-plugin-gfm' {
  import type TurndownService from 'turndown';
  export type TurndownPlugin = (service: TurndownService) => void;
  export const gfm: TurndownPlugin;
}
