import * as vscode from 'vscode';
import { ImageManager } from './imageManager';
import { CssInjector } from './cssInjector';
import { EmotionAnalyzer } from './emotionAnalyzer';
import { BackgroundRenderer } from './backgroundRenderer';

let refreshTimer: ReturnType<typeof setInterval> | undefined;
let editRefreshTimer: ReturnType<typeof setTimeout> | undefined;
let cssInjectorInstance: CssInjector | undefined;

/** 根据当前配置创建情绪分析器（jev API Key 支持设置项或 TYPESAFE_API_KEY 环境变量） */
function createAnalyzer(config: vscode.WorkspaceConfiguration): EmotionAnalyzer {
    const envKey = process.env.TYPESAFE_API_KEY;
    return new EmotionAnalyzer({
        linesToAnalyze: config.get<number>('linesToAnalyze', 20),
        apiKey: config.get<string>('apiKey', '') || envKey,
        model: config.get<string>('model', 'jev-latest'),
        endpoint: config.get<string>('apiEndpoint', ''),
    });
}

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
        let analyzer = createAnalyzer(config);
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
                const result = await analyzer.analyze();
                const imagePath = imageManager.getImageForEmotion(result.emotion);
                if (imagePath) {
                    renderer.switchTo(imagePath, result.emotion);
                } else {
                    const fallbackImage = imageManager.getImageForEmotion('happy');
                    if (fallbackImage) {
                        renderer.switchTo(fallbackImage, 'happy');
                    }
                }

                // ── 状态栏：情绪 + jev 质量分/置信度 ──────────────
                let detail = '';
                if (result.source === 'jev') {
                    const scoreStr =
                        result.qualityScore !== undefined
                            ? ` Q${Number(result.qualityScore).toFixed(1)}`
                            : '';
                    const confStr =
                        result.confidence !== undefined
                            ? ` (${Math.round(result.confidence * 100)}%)`
                            : '';
                    detail = `${scoreStr}${confStr}`;
                } else if (result.source === 'copilot') {
                    detail = ' (copilot)';
                }
                statusBar.text = `$(paintcan) Mood: ${result.emotion}${detail}`;

                // 悬浮提示：jev 概率分布明细
                const md = new vscode.MarkdownString();
                md.isTrusted = true;
                md.appendMarkdown(`**当前情绪**: ${result.emotion}\n\n`);
                md.appendMarkdown(`**分析来源**: ${result.source}\n`);
                if (result.qualityScore !== undefined && result.qualityLegend && result.qualityLegend.length > 0) {
                    const level = Math.min(
                        result.qualityLegend.length - 1,
                        Math.max(0, Math.round(result.qualityScore))
                    );
                    md.appendMarkdown(`\n\n**质量分**: ${result.qualityScore.toFixed(2)} / ${result.qualityLegend.length - 1}`);
                    md.appendMarkdown(`\n\n**质量等级**: ${result.qualityLegend[level]}`);
                }
                if (result.probabilities && Object.keys(result.probabilities).length > 0) {
                    md.appendMarkdown('\n\n**情绪概率分布**\n\n');
                    for (const [label, prob] of Object.entries(result.probabilities)
                        .sort((a, b) => b[1] - a[1])) {
                        md.appendMarkdown(`- ${label}: ${(prob * 100).toFixed(1)}%\n`);
                    }
                }
                statusBar.tooltip = md;
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

                if (e.affectsConfiguration('moodBackground.linesToAnalyze') ||
                    e.affectsConfiguration('moodBackground.apiKey') ||
                    e.affectsConfiguration('moodBackground.model') ||
                    e.affectsConfiguration('moodBackground.apiEndpoint')) {
                    analyzer.dispose();
                    analyzer = createAnalyzer(cfg);
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
