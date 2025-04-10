declare namespace chrome.sidePanel {
    interface OpenOptions {
        windowId?: number;
    }

    export function open(options?: OpenOptions, callback?: () => void): void;
    export function setOptions(options: { path?: string; enabled?: boolean }): Promise<void>;
}