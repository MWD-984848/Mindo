
import { TextFileView, WorkspaceLeaf, TFile, Notice } from 'obsidian';
import React from 'react';
import { createRoot, Root } from 'react-dom/client';
import App from './App';
import MindoPlugin from './main';

export const VIEW_TYPE_MINDO = 'mindo-view';

export class MindoView extends TextFileView {
    root: Root | null = null;
    appContainer: HTMLElement | null = null;
    data: string = "";
    plugin: MindoPlugin; // Reference to access settings
    
    constructor(leaf: WorkspaceLeaf) {
        super(leaf);
        // We can access the plugin instance via the app object if needed, 
        // but typically plugins pass themselves to views or we look it up.
        // For simplicity here, we assume the leaf's view type matches our plugin.
        // A cleaner way is to have the plugin pass itself, but strict Obsidian typing makes that tricky in constructor.
        // We will grab it from the global app.plugins if needed, or rely on saving.
    }

    getViewType() {
        return VIEW_TYPE_MINDO;
    }

    getDisplayText() {
        // @ts-ignore
        const file = (this as any).file as TFile;
        return file ? file.basename : 'Mindo';
    }

    getViewData(): string {
        return this.data;
    }

    setViewData(data: string, clear: boolean): void {
        this.data = data;
        this.renderApp();
    }

    clear(): void {
        this.data = "";
    }

    handleDataChange = (newData: string) => {
        this.data = newData;
        (this as any).requestSave();
    }

    // Called by the plugin settings tab to force a re-render with new settings
    refreshSettings() {
        this.renderApp();
    }

    async onOpen() {
        this.appContainer = (this as any).contentEl;
        (this.appContainer as any).addClass('mindo-container');
        this.appContainer.style.height = '100%';
        this.appContainer.style.width = '100%';
        this.appContainer.style.overflow = 'hidden';
        this.appContainer.style.position = 'relative'; 

        this.root = createRoot(this.appContainer);
        this.renderApp();
    }

    getSettings() {
        // @ts-ignore - access internal plugin list to find our instance settings
        const plugin = (this.app as any).plugins.getPlugin('mindo') as MindoPlugin;
        return plugin?.settings || { aiProvider: 'gemini', aiBaseUrl: '', aiApiKey: '', aiModel: 'gemini-2.0-flash' };
    }

    renderApp() {
        if (this.root && this.appContainer) {
            let initialData = null;
            try {
                if (this.data) {
                    initialData = JSON.parse(this.data);
                }
            } catch (e) {
                console.error("Failed to parse Mindo file", e);
            }

            const settings = this.getSettings();
            
            // @ts-ignore
            const file = (this as any).file as TFile;

            this.root.render(
                <React.StrictMode>
                    <App 
                        initialData={initialData} 
                        onSave={this.handleDataChange}
                        fileName={file ? file.basename : 'Untitled'}
                        settings={settings}
                        onShowMessage={(msg) => new Notice(msg)}
                    />
                </React.StrictMode>
            );
        }
    }

    async onClose() {
        if (this.root) {
            this.root.unmount();
        }
    }
}
