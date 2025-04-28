export interface TabUpdateMessage {
  type: 'TAB_STATE_UPDATE';
  url: string;
  title: string;
  isAllowed: boolean;
  wasVisited: boolean;
}

export interface ConnectionMessage {
  type: 'CONNECTION_STATE';
  connected: boolean;
}

export type ExtensionMessage = TabUpdateMessage | ConnectionMessage;