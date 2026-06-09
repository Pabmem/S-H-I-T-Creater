import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

/**
 * Maps emotion labels to image file paths.
 * Scans an `images/` directory and provides fuzzy-matching lookup.
 */
export class ImageManager {
    private imagesFolder: string;
    private emotionMap: Map<string, string> = new Map();
    private readonly defaultImagesFolder: string;

    constructor(context: vscode.ExtensionContext, customImagesFolder?: string) {
        this.defaultImagesFolder = context.asAbsolutePath('images');
        this.imagesFolder = this.resolveImagesFolder(customImagesFolder);
    }

    /**
     * Scan the images folder and build the emotion → absolute-path map.
     */
    async scanImages(): Promise<void> {
        this.emotionMap.clear();

        console.log('[ImageManager] Scanning images folder:', this.imagesFolder);

        let entries: Array<{ name: string; isFile: boolean }>;

        try {
            // Try native fs first (more reliable for extension installation paths)
            if (!fs.existsSync(this.imagesFolder)) {
                console.warn('[ImageManager] Images folder does not exist:', this.imagesFolder);
                return;
            }
            const raw = fs.readdirSync(this.imagesFolder, { withFileTypes: true });
            entries = raw.map((d) => ({ name: d.name, isFile: d.isFile() }));
        } catch (err) {
            console.error('[ImageManager] Failed to read images folder:', err);
            return;
        }

        const imageExts = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.bmp']);

        for (const entry of entries) {
            if (!entry.isFile) {
				continue;
			}

            const ext = path.extname(entry.name).toLowerCase();
            if (!imageExts.has(ext)) {
				continue;
			}

            const label = path.basename(entry.name, ext).toLowerCase();
            const absPath = path.join(this.imagesFolder, entry.name);

            // First file wins if duplicate labels exist
            if (!this.emotionMap.has(label)) {
                this.emotionMap.set(label, absPath);
            }
        }

        console.log('[ImageManager] Scan complete. Found', this.emotionMap.size, 'images:', Array.from(this.emotionMap.entries()));
    }

    /**
     * Get the absolute image path for an emotion label.
     * Supports case-insensitive and fuzzy matching.
     */
    getImageForEmotion(emotion: string): string | undefined {
        const normalized = this.normalizeEmotion(emotion);

        // Direct match
        if (this.emotionMap.has(normalized)) {
            return this.emotionMap.get(normalized);
        }

        // Try fuzzy aliases
        const aliased = this.fuzzyResolve(normalized);
        if (aliased && this.emotionMap.has(aliased)) {
            return this.emotionMap.get(aliased);
        }

        // Substring fallback — try to find a key that contains the query or vice-versa
        for (const [key, val] of this.emotionMap) {
            if (key.includes(normalized) || normalized.includes(key)) {
                return val;
            }
        }

        return undefined;
    }

    /**
     * Return all available emotion labels (lowercase, as derived from filenames).
     */
    getAvailableEmotions(): string[] {
        return Array.from(this.emotionMap.keys());
    }

    async setImagesFolder(customImagesFolder?: string): Promise<void> {
        this.imagesFolder = this.resolveImagesFolder(customImagesFolder);
        await this.scanImages();
    }

    /**
     * Check whether an emotion image exists (uses the same fuzzy logic).
     */
    hasEmotion(emotion: string): boolean {
        return this.getImageForEmotion(emotion) !== undefined;
    }

    // ── internal helpers ──────────────────────────────────────────────

    /**
     * Normalize an emotion string: lowercase, replace underscores/hyphens with spaces.
     */
    private normalizeEmotion(emotion: string): string {
        return emotion
            .toLowerCase()
            .replace(/[_-]+/g, ' ')
            .trim();
    }

    private resolveImagesFolder(customImagesFolder?: string): string {
        return (customImagesFolder && customImagesFolder.trim())
            ? customImagesFolder.trim()
            : this.defaultImagesFolder;
    }

    /**
     * Apply well-known fuzzy alias mappings.
     * Returns the canonical label if a match is found, otherwise `undefined`.
     */
    private fuzzyResolve(normalized: string): string | undefined {
        // "wtf" / "what" → "wdf is that"
        if (normalized === 'wtf' || normalized === 'what' || normalized === 'what is that') {
            return 'wdf is that';
        }

        // "veryhappy" (no space) → "very happy"
        if (normalized === 'veryhappy' || normalized === 'very happy') {
            return 'very happy';
        }

        // "angrycool" / "angry cool" / "angry_and_cool" → "angry and cool"
        if (
            normalized === 'angrycool' ||
            normalized === 'angry cool' ||
            normalized === 'angry and cool'
        ) {
            return 'angry and cool';
        }

        return undefined;
    }
}
