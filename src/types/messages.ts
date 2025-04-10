export interface TabStateMessage {
  type: 'TAB_STATE_UPDATE';
  isAllowed: boolean;
  url?: string;
  title?: string;
}

export interface Note {
  text: string;
  timestamp: string;
}

export type ExtensionMessage = TabStateMessage;