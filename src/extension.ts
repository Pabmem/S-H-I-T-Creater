import * as vscode from 'vscode';
import { ImageManager } from './imageManager';
import { CssInjector } from './cssInjector';
import { EmotionAnalyzer } from './emotionAnalyzer';
import { BackgroundRenderer } from './backgroundRenderer';

let refreshTimer: ReturnType<typeof setInterval> | undefined;
let editRefreshTimer: ReturnType<typeof setTimeout> | undefined;
let cssInjectorInstance: CssInjector | undefined;

export async function activate(context: vscode.ExtensionContext): Promise<void> {
    try {
        const config = vscode.workspace.getConfiguration('moodBackground');
        let enabled = config.get<boolean>('enabled', true);

        const imageManager = new ImageManager(context, config.get<string>('imagesFolder', ''));
        await imageManager.scanImages();

        const cssInjector = new CssInjector(
            config.get<number>('opacity', 0.15),
            config.get<number>('transitionDuration', 1.5)
        );
        cssInjectorInstance = cssInjector;
        let analyzer = new EmotionAnalyzer(config.get<number>('linesToAnalyze', 20));
        const renderer = new BackgroundRenderer(cssInjector);
        renderer.setTransitionDuration(config.get<number>('transitionDuration', 1.5) * 1000);
        context.subscriptions.push(cssInjector, renderer, analyzer);

        if (enabled) {
            cssInjector.inject();
        }

        // ── Status bar ──────────────────────────────────────────
        const statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
        statusBar.text = '$(paintcan) Mood: --';
        statusBar.command = 'moodBackground.refresh';
        statusBar.tooltip = 'Mood Background: Click to refresh';
        if (enabled) {
            statusBar.show();
        }
        context.subscriptions.push(statusBar);

        // ── Refresh logic ───────────────────────────────────────
        async function refreshEmotion(): Promise<void> {
            if (!enabled) {
                return;
            }
            try {
                const emotion = await analyzer.analyze();
                const imagePath = imageManager.getImageForEmotion(emotion);
                if (imagePath) {
                    renderer.switchTo(imagePath, emotion);
                } else {
                    const fallbackImage = imageManager.getImageForEmotion('happy');
                    if (fallbackImage) {
                        renderer.switchTo(fallbackImage, 'happy');
                    }
                }
                statusBar.text = `$(paintcan) Mood: ${emotion}`;
            } catch (err) {
                console.error('[MoodBackground] refreshEmotion error:', err);
            }
        }

        function scheduleEditRefresh(): void {
            if (!enabled) {
                return;
            }
            if (editRefreshTimer !== undefined) {
                clearTimeout(editRefreshTimer);
            }
            editRefreshTimer = setTimeout(() => {
                editRefreshTimer = undefined;
                refreshEmotion();
            }, 3000);
        }

        // ── Timer helpers ───────────────────────────────────────
        function startTimer(): void {
            stopTimer();
            const interval = config.get<number>('updateInterval', 30) * 1000;
            refreshTimer = setInterval(() => { refreshEmotion(); }, interval);
        }

        function stopTimer(): void {
            if (refreshTimer !== undefined) {
                clearInterval(refreshTimer);
                refreshTimer = undefined;
            }
        }

        // ── Commands ────────────────────────────────────────────
        context.subscriptions.push(
            vscode.commands.registerCommand('moodBackground.enable', async () => {
                enabled = true;
                await config.update('enabled', true, vscode.ConfigurationTarget.Global);
                cssInjector.inject();
                statusBar.show();
                startTimer();
                await refreshEmotion();
            })
        );

        context.subscriptions.push(
            vscode.commands.registerCommand('moodBackground.disable', async () => {
                enabled = false;
                await config.update('enabled', false, vscode.ConfigurationTarget.Global);
                cssInjector.restore();
                statusBar.hide();
                stopTimer();
                if (editRefreshTimer !== undefined) {
                    clearTimeout(editRefreshTimer);
                    editRefreshTimer = undefined;
                }
            })
        );

        context.subscriptions.push(
            vscode.commands.registerCommand('moodBackground.toggle', async () => {
                if (enabled) {
                    await vscode.commands.executeCommand('moodBackground.disable');
                } else {
                    await vscode.commands.executeCommand('moodBackground.enable');
                }
            })
        );

        context.subscriptions.push(
            vscode.commands.registerCommand('moodBackground.refresh', async () => {
                await refreshEmotion();
            })
        );

        // ── Event listeners ─────────────────────────────────────
        // Refresh on file save
        context.subscriptions.push(
            vscode.workspace.onDidSaveTextDocument(() => {
                refreshEmotion();
            })
        );

        context.subscriptions.push(
            vscode.workspace.onDidChangeTextDocument((event) => {
                if (event.document === vscode.window.activeTextEditor?.document) {
                    scheduleEditRefresh();
                }
            })
        );

        context.subscriptions.push(
            vscode.window.onDidChangeActiveTextEditor(() => {
                cssInjector.applyToVisibleEditors();
                scheduleEditRefresh();
            })
        );

        context.subscriptions.push(
            vscode.window.onDidChangeVisibleTextEditors(() => {
                cssInjector.applyToVisibleEditors();
            })
        );

        // React to configuration changes
        context.subscriptions.push(
            vscode.workspace.onDidChangeConfiguration(async (e) => {
                const cfg = vscode.workspace.getConfiguration('moodBackground');

                if (e.affectsConfiguration('moodBackground.opacity')) {
                    cssInjector.updateOpacity(cfg.get<number>('opacity', 0.15));
                    if (enabled) {
                        cssInjector.inject();
                    }
                }

                if (e.affectsConfiguration('moodBackground.transitionDuration')) {
                    const duration = cfg.get<number>('transitionDuration', 1.5);
                    renderer.setTransitionDuration(duration * 1000);
                    cssInjector.updateTransitionDuration(duration);
                }

                if (e.affectsConfiguration('moodBackground.updateInterval')) {
                    if (enabled) {
                        startTimer();
                    }
                }

                if (e.affectsConfiguration('moodBackground.enabled')) {
                    const newEnabled = cfg.get<boolean>('enabled', true);
                    if (newEnabled && !enabled) {
                        await vscode.commands.executeCommand('moodBackground.enable');
                    } else if (!newEnabled && enabled) {
                        await vscode.commands.executeCommand('moodBackground.disable');
                    }
                }

                if (e.affectsConfiguration('moodBackground.linesToAnalyze')) {
                    analyzer.dispose();
                    analyzer = new EmotionAnalyzer(cfg.get<number>('linesToAnalyze', 20));
                    await refreshEmotion();
                }

                if (e.affectsConfiguration('moodBackground.imagesFolder')) {
                    await imageManager.setImagesFolder(cfg.get<string>('imagesFolder', ''));
                    await refreshEmotion();
                }
            })
        );

        // ── Kick off ────────────────────────────────────────────
        startTimer();
        setTimeout(() => { refreshEmotion(); }, 2000);

    } catch (err) {
        vscode.window.showErrorMessage(`Mood Background activation failed: ${err}`);
        console.error('[MoodBackground] activate error:', err);
    }
}

export function deactivate(): void {
    if (refreshTimer !== undefined) {
        clearInterval(refreshTimer);
        refreshTimer = undefined;
    }
    if (cssInjectorInstance) {
        cssInjectorInstance.restore();
    }
}
