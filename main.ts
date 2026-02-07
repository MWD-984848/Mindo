
import { App, Plugin, PluginSettingTab, Setting, WorkspaceLeaf, TFile, TextFileView, Menu } from 'obsidian';
import { MindoView, VIEW_TYPE_MINDO } from './view';

export interface MindoPluginSettings {
    aiApiKey: string;
    aiModel: string;
}

const DEFAULT_SETTINGS: MindoPluginSettings = {
    aiApiKey: '',
    aiModel: 'gemini-2.0-flash'
}

export default class MindoPlugin extends Plugin {
	settings: MindoPluginSettings;

	async onload() {
		await this.loadSettings();
        
        this.injectTailwind();

        (this as any).registerView(
            VIEW_TYPE_MINDO,
            (leaf: WorkspaceLeaf) => new MindoView(leaf)
        );

        (this as any).registerExtensions(['mindo'], VIEW_TYPE_MINDO);

		(this as any).addRibbonIcon('brain-circuit', 'New Mindo Board', () => {
			this.createMindoFile();
		});

        (this as any).addCommand({
            id: 'create-mindo-board',
            name: 'Create New Mindo Board',
            callback: () => {
                this.createMindoFile();
            }
        });

		(this as any).addSettingTab(new MindoSettingTab((this as any).app, this));
	}

    async createMindoFile() {
        const app = (this as any).app as App;
        let file = app.vault.getAbstractFileByPath("Untitled.mindo");
        let i = 1;
        while (file) {
            file = app.vault.getAbstractFileByPath(`Untitled ${i}.mindo`);
            i++;
        }
        
        const initialData = JSON.stringify({
            nodes: [
                { id: 'root', title: 'Central Topic', content: '', x: 0, y: 0, width: 200, height: 100, color: 'yellow' }
            ],
            edges: [],
            version: 1
        }, null, 2);

        const newFile = await app.vault.create(file ? file.path : `Untitled.mindo`, initialData);
        app.workspace.getLeaf(true).openFile(newFile as TFile);
    }

    injectTailwind() {
        if (!document.querySelector('#mindo-tailwind-config')) {
            const configScript = document.createElement('script');
            configScript.id = 'mindo-tailwind-config';
            configScript.textContent = `
                tailwind.config = {
                    darkMode: 'class',
                    theme: {
                        extend: {
                            colors: {
                                dark: {
                                    bg: '#1e1e1e',
                                    surface: '#2d2d2d',
                                    border: '#404040',
                                    text: '#e0e0e0'
                                }
                            }
                        }
                    }
                }
            `;
            document.head.appendChild(configScript);
        }

        if (!document.querySelector('#mindo-tailwind')) {
            const script = document.createElement('script');
            script.id = 'mindo-tailwind';
            script.src = 'https://cdn.tailwindcss.com';
            document.head.appendChild(script);
        }
    }

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await (this as any).loadData());
	}

	async saveSettings() {
		await (this as any).saveData(this.settings);
        // Refresh views to apply new settings immediately
        const app = (this as any).app as App;
        app.workspace.getLeavesOfType(VIEW_TYPE_MINDO).forEach((leaf) => {
            if (leaf.view instanceof MindoView) {
                leaf.view.refreshSettings();
            }
        });
	}
}

class MindoSettingTab extends PluginSettingTab {
	plugin: MindoPlugin;

	constructor(app: App, plugin: MindoPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = (this as any);
		containerEl.empty();
		containerEl.createEl('h2', { text: 'Mindo Settings' });

        new Setting(containerEl)
            .setName('Google Gemini API Key')
            .setDesc('Enter your API key from Google AI Studio.')
            .addText(text => text
                .setPlaceholder('Enter your API Key')
                .setValue(this.plugin.settings.aiApiKey)
                .onChange(async (value) => {
                    this.plugin.settings.aiApiKey = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Model Name')
            .setDesc('The model to use for expansion (e.g., gemini-2.0-flash, gemini-1.5-pro).')
            .addText(text => text
                .setPlaceholder('gemini-2.0-flash')
                .setValue(this.plugin.settings.aiModel)
                .onChange(async (value) => {
                    this.plugin.settings.aiModel = value;
                    await this.plugin.saveSettings();
                }));
	}
}
