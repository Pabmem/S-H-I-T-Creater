import * as vscode from 'vscode';
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
export declare class EmotionAnalyzer implements vscode.Disposable {
    private readonly linesToAnalyze;
    private typeSafeClient;
    constructor(options: EmotionAnalyzerOptions);
    analyze(): Promise<EmotionResult>;
    private getRecentCode;
    private analyzeWithCopilot;
    private parseEmotion;
    private fallbackAnalyze;
    dispose(): void;
}
//# sourceMappingURL=emotionAnalyzer.d.ts.map