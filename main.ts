
import { App, Plugin, PluginSettingTab, Setting, WorkspaceLeaf, TFile, TextFileView, Menu } from 'obsidian';
import { MindoView, VIEW_TYPE_MINDO } from './view';
import { MindoSettings } from './types';

const DEFAULT_SETTINGS: MindoSettings = {
    aiProvider: 'gemini',
    aiBaseUrl: '',
    aiApiKey: '',
    aiModel: 'gemini-2.0-flash'
}

export default class MindoPlugin extends Plugin {
	settings: MindoSettings;

	async onload() {
		await this.loadSettings();

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
        
        let baseName = "Untitled";
        let path = `${baseName}.mindo`;
        let i = 1;
        
        // Find a unique filename
        while (app.vault.getAbstractFileByPath(path)) {
            path = `${baseName} ${i}.mindo`;
            i++;
        }
        
        const initialData = JSON.stringify({
            nodes: [
                { id: 'root', title: 'Central Topic', content: '', x: 0, y: 0, width: 200, height: 100, color: 'yellow' }
            ],
            edges: [],
            version: 1
        }, null, 2);

        const newFile = await app.vault.create(path, initialData);
        app.workspace.getLeaf(true).openFile(newFile as TFile);
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

        // Preset Selector
        new Setting(containerEl)
            .setName('AI Provider Preset')
            .setDesc('Select a preset to auto-fill configurations. You can still edit them manually.')
            .addDropdown(dropdown => dropdown
                .addOption('gemini', 'Google Gemini')
                .addOption('deepseek', 'DeepSeek')
                .addOption('openai', 'OpenAI')
                .addOption('custom', 'Custom (OpenAI Compatible)')
                .setValue(this.plugin.settings.aiProvider === 'gemini' ? 'gemini' : (this.plugin.settings.aiBaseUrl.includes('deepseek') ? 'deepseek' : (this.plugin.settings.aiBaseUrl.includes('openai') ? 'openai' : 'custom')))
                .onChange(async (value) => {
                    if (value === 'gemini') {
                        this.plugin.settings.aiProvider = 'gemini';
                        this.plugin.settings.aiBaseUrl = '';
                        this.plugin.settings.aiModel = 'gemini-2.0-flash';
                    } else if (value === 'deepseek') {
                        this.plugin.settings.aiProvider = 'openai';
                        this.plugin.settings.aiBaseUrl = 'https://api.deepseek.com';
                        this.plugin.settings.aiModel = 'deepseek-chat';
                    } else if (value === 'openai') {
                        this.plugin.settings.aiProvider = 'openai';
                        this.plugin.settings.aiBaseUrl = 'https://api.openai.com/v1';
                        this.plugin.settings.aiModel = 'gpt-4o';
                    } else {
                        this.plugin.settings.aiProvider = 'openai';
                        // Keep existing or clear if switching to custom? Keep existing is safer.
                    }
                    await this.plugin.saveSettings();
                    this.display(); // Refresh to show new values
                }));

        // Base URL (Hidden for Gemini)
        if (this.plugin.settings.aiProvider === 'openai') {
            new Setting(containerEl)
                .setName('API Base URL')
                .setDesc('The base URL for the API (e.g., https://api.deepseek.com).')
                .addText(text => text
                    .setPlaceholder('https://api.example.com/v1')
                    .setValue(this.plugin.settings.aiBaseUrl)
                    .onChange(async (value) => {
                        this.plugin.settings.aiBaseUrl = value;
                        await this.plugin.saveSettings();
                    }));
        }

        // API Key
        new Setting(containerEl)
            .setName('API Key')
            .setDesc('Enter your API key.')
            .addText(text => text
                .setPlaceholder('sk-...')
                .setValue(this.plugin.settings.aiApiKey)
                .onChange(async (value) => {
                    this.plugin.settings.aiApiKey = value;
                    await this.plugin.saveSettings();
                }));

        // Model Name
        new Setting(containerEl)
            .setName('Model Name')
            .setDesc('The model ID to use (e.g., gemini-2.0-flash, deepseek-chat, gpt-4).')
            .addText(text => text
                .setPlaceholder('Model ID')
                .setValue(this.plugin.settings.aiModel)
                .onChange(async (value) => {
                    this.plugin.settings.aiModel = value;
                    await this.plugin.saveSettings();
                }));
	}
}
