import * as vscode from 'vscode';
import {
    TypeSafeClient,
    JevEvaluation,
    EmotionLabel,
    EMOTION_LABELS,
} from './typeSafeClient';

const DEFAULT_EMOTION: EmotionLabel = 'happy';

/** 一次情绪分析的完整结果 */
export interface EmotionResult {
    /** 情绪标签（用于挑选背景图片） */
    emotion: string;
    /** jev 质量分（0 ~ 4，可有小数），仅 jev 分析时有效 */
    qualityScore?: number;
    /** jev 置信度（0 ~ 1），仅 jev / copilot 分析时有效 */
    confidence?: number;
    /** 结果来源 */
    source: 'jev' | 'copilot' | 'fallback';
    /** 情绪概率分布（仅 jev） */
    probabilities?: Record<string, number>;
    /** 质量等级描述（仅 jev） */
    qualityLegend?: string[];
}

export interface EmotionAnalyzerOptions {
    linesToAnalyze: number;
    apiKey?: string;
    model?: string;
    endpoint?: string;
}

export class EmotionAnalyzer implements vscode.Disposable {
    private readonly linesToAnalyze: number;
    private typeSafeClient: TypeSafeClient | undefined;

    constructor(options: EmotionAnalyzerOptions) {
        this.linesToAnalyze = options.linesToAnalyze;
        if (options.apiKey && options.apiKey.trim()) {
            this.typeSafeClient = new TypeSafeClient({
                apiKey: options.apiKey.trim(),
                model: options.model,
                endpoint: options.endpoint,
            });
        }
    }

    async analyze(): Promise<EmotionResult> {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            return { emotion: DEFAULT_EMOTION, source: 'fallback' };
        }

        const document = editor.document;
        if (document.lineCount === 0) {
            return { emotion: DEFAULT_EMOTION, source: 'fallback' };
        }

        const recentCode = this.getRecentCode(editor, document);
        if (!recentCode.trim()) {
            return { emotion: DEFAULT_EMOTION, source: 'fallback' };
        }

        // 1) 优先：TypeSafe jev 结构化评估
        if (this.typeSafeClient) {
            try {
                const jev = await this.typeSafeClient.evaluate(recentCode);
                return {
                    emotion: jev.emotion,
                    qualityScore: jev.qualityScore,
                    confidence: jev.confidence,
                    probabilities: jev.probabilities,
                    qualityLegend: jev.qualityLegend,
                    source: 'jev',
                };
            } catch (error) {
                console.warn('[EmotionAnalyzer] TypeSafe jev evaluation failed, falling back:', error);
            }
        }

        // 2) 备选：Copilot LLM
        try {
            const [model] = await vscode.lm.selectChatModels({
                vendor: 'copilot',
            });

            if (model) {
                const result = await this.analyzeWithCopilot(model, recentCode);
                if (result) {
                    return result;
                }
            }
        } catch (error) {
            if (error instanceof vscode.LanguageModelError) {
                if (error.code === 'NotFound' || error.code === 'NoPermissions') {
                    console.warn('[EmotionAnalyzer] Copilot language model unavailable, using fallback analysis.');
                } else {
                    console.error('[EmotionAnalyzer] Copilot analysis error:', error);
                }
            } else {
                console.error('[EmotionAnalyzer] Unexpected error during emotion analysis:', error);
            }
        }

        // 3) 兜底：基于诊断的规则分析
        return this.fallbackAnalyze(document);
    }

    // ── internal helpers ──────────────────────────────────────────────

    private getRecentCode(
        editor: vscode.TextEditor,
        document: vscode.TextDocument
    ): string {
        const cursorLine = editor.selection.active.line;
        const endLine = Math.min(document.lineCount - 1, cursorLine);
        const startLine = Math.max(0, endLine - this.linesToAnalyze + 1);
        return document.getText(
            new vscode.Range(startLine, 0, endLine, document.lineAt(endLine).text.length)
        );
    }

    private async analyzeWithCopilot(
        model: vscode.LanguageModelChat,
        recentCode: string
    ): Promise<EmotionResult | undefined> {
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

        const emotion = this.parseEmotion(result);
        return { emotion, source: 'copilot' };
    }

    private parseEmotion(text: string): EmotionLabel {
        const normalized = text.trim().toLowerCase();
        for (const label of EMOTION_LABELS) {
            if (normalized.includes(label)) {
                return label;
            }
        }
        return DEFAULT_EMOTION;
    }

    private fallbackAnalyze(document: vscode.TextDocument): EmotionResult {
        const diagnostics = vscode.languages.getDiagnostics(document.uri);
        const errorCount = diagnostics.filter(
            (d) => d.severity === vscode.DiagnosticSeverity.Error
        ).length;

        let emotion: EmotionLabel;
        if (errorCount > 5) {
            emotion = 'sad';
        } else if (errorCount > 2) {
            emotion = 'angry';
        } else if (errorCount > 0) {
            emotion = 'angry and cool';
        } else {
            emotion = DEFAULT_EMOTION;
        }

        return { emotion, source: 'fallback' };
    }

    dispose(): void {
        // No resources to dispose
    }
}
