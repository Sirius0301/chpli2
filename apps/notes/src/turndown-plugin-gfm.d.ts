// turndown-plugin-gfm ships no types (tiny plugin: tables/strikethrough/task lists).
declare module 'turndown-plugin-gfm' {
  import type TurndownService from 'turndown';
  export function gfm(service: TurndownService): void;
}
