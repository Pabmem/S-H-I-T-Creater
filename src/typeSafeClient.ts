import * as https from 'https';
import * as http from 'http';

/**
 * TypeSafe (jev) API 客户端。
 *
 * 调用 POST {endpoint}/v1/systemone，用 jev 模型对代码做结构化评估：
 *   - emotion: choice 问题 —— 从 7 个情绪标签中选一个（附带完整概率分布和 confidence）
 *   - quality: score 问题  —— 按评分细则给出概率加权分数（可落在两级之间）
 *
 * 文档: https://docs.typesafe.ai/ （API reference）
 */

export const EMOTION_LABELS = [
    'happy',
    'cool',
    'angry',
    'sad',
    'very happy',
    'angry and cool',
    'wdf',
] as const;

export type EmotionLabel = (typeof EMOTION_LABELS)[number];

export const QUALITY_LEVELS = [
    '非常糟糕，完全不能工作',
    '较差，有明显问题',
    '一般，能工作但不够好',
    '不错，结构清晰',
    '非常优秀，令人赞叹',
] as const;

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

interface TypeSafeAnswer {
    type: string;
    choice?: string;
    score?: number;
    legend?: Record<string, string>;
    probabilities?: Record<string, number>;
    confidence?: number;
    noul?: number;
}

interface TypeSafeResponse {
    model?: string;
    answers?: Record<string, TypeSafeAnswer>;
}

export class TypeSafeClient {
    private readonly endpoint: string;
    private readonly apiKey: string;
    private readonly model: string;
    private readonly timeoutMs: number;
    private readonly maxRetries: number;

    constructor(options: {
        apiKey: string;
        model?: string;
        endpoint?: string;
        timeoutMs?: number;
        maxRetries?: number;
    }) {
        this.apiKey = options.apiKey;
        this.model = options.model || 'jev-latest';
        // endpoint 允许覆盖（去掉末尾斜杠），默认官方地址
        this.endpoint = (options.endpoint || 'https://api.typesafe.ai').replace(/\/+$/, '');
        this.timeoutMs = options.timeoutMs ?? 30000;
        this.maxRetries = options.maxRetries ?? 3;
    }

    /**
     * 用 jev 评估一段代码，返回结构化结果。
     * 遇到 429/529 会按指数退避自动重试。
     */
    async evaluate(code: string): Promise<JevEvaluation> {
        const body = JSON.stringify({
            state: code,
            model: this.model,
            questions: {
                emotion: {
                    type: 'choice',
                    instructions:
                        '根据这段代码的质量，选择一个最匹配的情绪标签。\n' +
                        '- happy: 代码质量不错，结构清晰\n' +
                        '- cool: 代码写得出乎意料的好，有创意\n' +
                        '- angry: 代码质量很差，有明显问题\n' +
                        '- sad: 代码非常糟糕，让人沮丧\n' +
                        '- very happy: 代码非常优秀，令人赞叹\n' +
                        '- angry and cool: 代码有问题但也有亮点\n' +
                        '- wdf: 代码让人困惑，看不懂在写什么',
                    criteria: {
                        'happy': '代码质量不错，结构清晰',
                        'cool': '代码写得出乎意料的好，有创意',
                        'angry': '代码质量很差，有明显问题',
                        'sad': '代码非常糟糕，让人沮丧',
                        'very happy': '代码非常优秀，令人赞叹',
                        'angry and cool': '代码有问题但也有亮点',
                        'wdf': '代码让人困惑，看不懂在写什么',
                    },
                },
                quality: {
                    type: 'score',
                    instructions: '评估这段代码的整体质量。',
                    criteria: [...QUALITY_LEVELS],
                },
            },
        });

        const response = await this.requestWithRetry(body);
        return this.parseResponse(response);
    }

    // ── HTTP ─────────────────────────────────────────────────────────

    private async requestWithRetry(body: string): Promise<TypeSafeResponse> {
        let lastError: Error | undefined;

        for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
            try {
                return await this.requestOnce(body);
            } catch (err: unknown) {
                lastError = err instanceof Error ? err : new Error(String(err));
                const retryable = (err as { retryable?: boolean }).retryable === true;
                if (!retryable || attempt === this.maxRetries) {
                    throw lastError;
                }
                // 指数退避: 1s, 2s, 4s ...
                await sleep(1000 * Math.pow(2, attempt));
            }
        }

        throw lastError ?? new Error('TypeSafe request failed');
    }

    private requestOnce(body: string): Promise<TypeSafeResponse> {
        return new Promise<TypeSafeResponse>((resolve, reject) => {
            const url = new URL(`${this.endpoint}/v1/systemone`);
            const isHttps = url.protocol === 'https:';
            const transport = isHttps ? https : http;

            const req = transport.request(
                {
                    hostname: url.hostname,
                    port: url.port || (isHttps ? 443 : 80),
                    path: url.pathname + url.search,
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${this.apiKey}`,
                        'Content-Type': 'application/json',
                        'Content-Length': Buffer.byteLength(body),
                    },
                    timeout: this.timeoutMs,
                },
                (res) => {
                    const chunks: Buffer[] = [];
                    res.on('data', (chunk: Buffer) => chunks.push(chunk));
                    res.on('end', () => {
                        const text = Buffer.concat(chunks).toString('utf8');
                        const status = res.statusCode ?? 0;

                        if (status === 429 || status === 529) {
                            const e = new Error(`TypeSafe rate limited (HTTP ${status})`);
                            (e as { retryable?: boolean }).retryable = true;
                            reject(e);
                            return;
                        }
                        if (status === 401) {
                            reject(new Error('TypeSafe 认证失败 (401)：请检查 API Key（moodBackground.apiKey）'));
                            return;
                        }
                        if (status === 422) {
                            reject(new Error(`TypeSafe 请求校验失败 (422)：${text}`));
                            return;
                        }
                        if (status < 200 || status >= 300) {
                            const e = new Error(`TypeSafe 请求失败 (HTTP ${status})：${text}`);
                            // 5xx 一律可重试
                            (e as { retryable?: boolean }).retryable = status >= 500;
                            reject(e);
                            return;
                        }

                        try {
                            resolve(JSON.parse(text) as TypeSafeResponse);
                        } catch {
                            reject(new Error(`TypeSafe 返回了无法解析的响应：${text.slice(0, 200)}`));
                        }
                    });
                }
            );

            req.on('timeout', () => {
                req.destroy(new Error('TypeSafe 请求超时'));
            });
            req.on('error', (err) => {
                const e = new Error(`TypeSafe 网络错误：${err.message}`);
                (e as { retryable?: boolean }).retryable = true;
                reject(e);
            });

            req.write(body);
            req.end();
        });
    }

    // ── 解析 ─────────────────────────────────────────────────────────

    private parseResponse(response: TypeSafeResponse): JevEvaluation {
        const answers = response.answers ?? {};
        const emotionAnswer = answers['emotion'];
        const qualityAnswer = answers['quality'];

        if (!emotionAnswer || emotionAnswer.type !== 'choice' || !emotionAnswer.choice) {
            throw new Error('TypeSafe 响应缺少有效的 emotion (choice) 答案');
        }

        const emotion = emotionAnswer.choice;
        const probabilities = emotionAnswer.probabilities ?? {};

        let qualityScore = 0;
        let qualityLegend: string[] = [...QUALITY_LEVELS];
        if (qualityAnswer && qualityAnswer.type === 'score' && typeof qualityAnswer.score === 'number') {
            qualityScore = qualityAnswer.score;
            if (qualityAnswer.legend) {
                qualityLegend = Object.keys(qualityAnswer.legend)
                    .sort((a, b) => Number(a) - Number(b))
                    .map((k) => qualityAnswer.legend![k]);
            }
        }

        const confidence =
            emotionAnswer.confidence ?? qualityAnswer?.confidence ?? 0;

        return {
            emotion,
            qualityScore,
            confidence,
            probabilities,
            qualityLegend,
        };
    }
}

function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
