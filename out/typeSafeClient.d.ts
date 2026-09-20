/**
 * TypeSafe (jev) API 客户端。
 *
 * 调用 POST {endpoint}/v1/systemone，用 jev 模型对代码做结构化评估：
 *   - emotion: choice 问题 —— 从 7 个情绪标签中选一个（附带完整概率分布和 confidence）
 *   - quality: score 问题  —— 按评分细则给出概率加权分数（可落在两级之间）
 *
 * 文档: https://docs.typesafe.ai/ （API reference）
 */
export declare const EMOTION_LABELS: readonly ["happy", "cool", "angry", "sad", "very happy", "angry and cool", "wdf"];
export type EmotionLabel = (typeof EMOTION_LABELS)[number];
export declare const QUALITY_LEVELS: readonly ["非常糟糕，完全不能工作", "较差，有明显问题", "一般，能工作但不够好", "不错，结构清晰", "非常优秀，令人赞叹"];
/** jev 评估结果 */
export interface JevEvaluation {
    /** 选中的情绪标签（choice 答案的最高概率项） */
    emotion: string;
    /** 概率加权质量分（0 ~ levels.length-1，可落在两级之间） */
    qualityScore: number;
    /** 评估置信度（choice/score 答案的 confidence） */
    confidence: number;
    /** 情绪标签 → 概率 */
    probabilities: Record<string, number>;
    /** 各质量等级的描述 */
    qualityLegend: string[];
}
export declare class TypeSafeClient {
    private readonly endpoint;
    private readonly apiKey;
    private readonly model;
    private readonly timeoutMs;
    private readonly maxRetries;
    constructor(options: {
        apiKey: string;
        model?: string;
        endpoint?: string;
        timeoutMs?: number;
        maxRetries?: number;
    });
    /**
     * 用 jev 评估一段代码，返回结构化结果。
     * 遇到 429/529 会按指数退避自动重试。
     */
    evaluate(code: string): Promise<JevEvaluation>;
    private requestWithRetry;
    private requestOnce;
    private parseResponse;
}
//# sourceMappingURL=typeSafeClient.d.ts.map