import * as vscode from 'vscode';

const VALID_EMOTIONS = [
    'very happy',
    'angry and cool',
    'happy',
    'cool',
    'angry',
    'sad',
    'wdf',
] as const;

type EmotionLabel = (typeof VALID_EMOTIONS)[number];

const DEFAULT_EMOTION: EmotionLabel = 'happy';

export class EmotionAnalyzer implements vscode.Disposable {
    private readonly linesToAnalyze: number;

    constructor(linesToAnalyze: number = 20) {
        this.linesToAnalyze = linesToAnalyze;
    }

    async analyze(): Promise<string> {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            return DEFAULT_EMOTION;
        }

        const document = editor.document;
        if (document.lineCount === 0) {
            return DEFAULT_EMOTION;
        }

        const cursorLine = editor.selection.active.line;
        const endLine = Math.min(document.lineCount - 1, cursorLine);
        const startLine = Math.max(0, endLine - this.linesToAnalyze + 1);
        const recentCode = document.getText(
            new vscode.Range(startLine, 0, endLine, document.lineAt(endLine).text.length)
        );

        if (!recentCode.trim()) {
            return DEFAULT_EMOTION;
        }

        try {
            const [model] = await vscode.lm.selectChatModels({
                vendor: 'copilot',
            });

            if (!model) {
                return this.fallbackAnalyze(document);
            }

            const messages = [
                vscode.LanguageModelChatMessage.User(
                    `你是一个代码质量情绪分析师。根据以下代码片段，选择一个最匹配的情绪标签。\n\n` +
                    `可选标签（必须从以下列表中选择一个）:\n` +
                    `- happy: 代码质量不错，结构清晰\n` +
                    `- cool: 代码写得出乎意料的好，有创意\n` +
                    `- angry: 代码质量很差，有明显问题\n` +
                    `- sad: 代码非常糟糕，让人沮丧\n` +
                    `- very happy: 代码非常优秀，令人赞叹\n` +
                    `- angry and cool: 代码有问题但也有亮点\n` +
                    `- wdf: 代码让人困惑，看不懂在写什么\n\n` +
                    `只输出一个标签，不要任何解释或额外文字。`
                ),
                vscode.LanguageModelChatMessage.User(recentCode),
            ];

            const response = await model.sendRequest(messages, {});
            let result = '';
            for await (const fragment of response.text) {
                result += fragment;
            }

            return this.parseEmotion(result);
        } catch (error) {
            if (error instanceof vscode.LanguageModelError) {
                if (error.code === 'NotFound') {
                    console.warn('[EmotionAnalyzer] Language model not found, using fallback analysis.');
                    return this.fallbackAnalyze(document);
                }
                if (error.code === 'NoPermissions') {
                    console.warn('[EmotionAnalyzer] No permissions to access language model, using fallback analysis.');
                    return this.fallbackAnalyze(document);
                }
            }

            console.error('[EmotionAnalyzer] Unexpected error during emotion analysis:', error);
            return DEFAULT_EMOTION;
        }
    }

    private parseEmotion(text: string): EmotionLabel {
        const normalized = text.trim().toLowerCase();
        for (const label of VALID_EMOTIONS) {
            if (normalized.includes(label)) {
                return label;
            }
        }
        return DEFAULT_EMOTION;
    }

    private fallbackAnalyze(document: vscode.TextDocument): EmotionLabel {
        const diagnostics = vscode.languages.getDiagnostics(document.uri);
        const errorCount = diagnostics.filter(
            (d) => d.severity === vscode.DiagnosticSeverity.Error
        ).length;

        if (errorCount > 5) {
            return 'sad';
        }
        if (errorCount > 2) {
            return 'angry';
        }
        if (errorCount > 0) {
            return 'angry and cool';
        }
        return DEFAULT_EMOTION;
    }

    dispose(): void {
        // No resources to dispose
    }
}
