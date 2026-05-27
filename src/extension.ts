import * as vscode from 'vscode';
import { ImageManager } from './imageManager';
import { CssInjector } from './cssInjector';
import { EmotionAnalyzer } from './emotionAnalyzer';
import { BackgroundRenderer } from './backgroundRenderer';

let refreshTimer: ReturnType<typeof setInterval> | undefined;
let cssInjectorInstance: CssInjector | undefined;

export async function activate(context: vscode.ExtensionContext): Promise<void> {
    try {
        const config = vscode.workspace.getConfiguration('moodBackground');
        let enabled = config.get<boolean>('enabled', true);

        // Create core instances
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

        // Inject CSS on startup if enabled
        if (enabled) {
            console.log('[MoodBackground] Applying background...');
            cssInjector.inject();
            console.log('[MoodBackground] Background applied. isInjected:', cssInjector.isInjected());
            // CSS 修改后需要重新加载窗口才能生效
            vscode.window.showInformationMessage(
                'Mood Background 已安装！需要重新加载窗口才能看到背景图片。',
                '重新加载'
            ).then(choice => {
                if (choice === '重新加载') {
                    vscode.commands.executeCommand('workbench.action.reloadWindow');
                }
            });
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
                console.log('[MoodBackground] refreshEmotion: disabled, skipping');
                return;
            }
            try {
                console.log('[MoodBackground] Analyzing emotion...');
                const emotion = await analyzer.analyze();
                console.log('[MoodBackground] Emotion result:', emotion);
                const imagePath = imageManager.getImageForEmotion(emotion);
                console.log('[MoodBackground] Image path for', emotion, ':', imagePath);
                console.log('[MoodBackground] Available emotions:', imageManager.getAvailableEmotions());
                if (imagePath) {
                    renderer.switchTo(imagePath, emotion);
                    console.log('[MoodBackground] Renderer.switchTo called');
                    // CSS 文件修改后需要重新加载窗口才能生效
                    vscode.window.showInformationMessage(
                        `情绪已切换为: ${emotion}`,
                        '重新加载以查看'
                    ).then(choice => {
                        if (choice === '重新加载以查看') {
                            vscode.commands.executeCommand('workbench.action.reloadWindow');
                        }
                    });
                }
                statusBar.text = `$(paintcan) Mood: ${emotion}`;
            } catch (err) {
                console.error('[MoodBackground] refreshEmotion error:', err);
            }
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
                    renderer.setTransitionDuration(cfg.get<number>('transitionDuration', 1.5) * 1000);
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
                    analyzer = new EmotionAnalyzer(cfg.get<number>('linesToAnalyze', 20));
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
