/* eslint-disable no-console */
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const cssInjectorPath = path.join(root, 'src', 'cssInjector.ts');
const imageManagerPath = path.join(root, 'src', 'imageManager.ts');
const extensionPath = path.join(root, 'src', 'extension.ts');
const imagesDir = path.join(root, 'images');

const requiredEmotions = [
  'happy',
  'cool',
  'angry',
  'sad',
  'very happy',
  'angry and cool',
  'wdf',
];

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function read(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

function normalizeEmotionName(fileName) {
  return path
    .basename(fileName, path.extname(fileName))
    .toLowerCase()
    .replace(/[_-]+/g, ' ')
    .trim();
}

function checkImages() {
  assert(fs.existsSync(imagesDir), `Missing images directory: ${imagesDir}`);

  const files = fs.readdirSync(imagesDir).filter((name) => {
    return ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.bmp'].includes(path.extname(name).toLowerCase());
  });

  const labels = new Set(files.map(normalizeEmotionName));
  for (const emotion of requiredEmotions) {
    const ok = labels.has(emotion) || (emotion === 'wdf' && [...labels].some((label) => label.includes('wdf')));
    assert(ok, `Missing image for emotion: ${emotion}`);
  }

  console.log(`✓ images: found ${files.length} supported emotion images`);
}

function checkSafeRendering() {
  const cssInjector = read(cssInjectorPath);
  const forbidden = [
    'workbench.desktop.main.css',
    '.mood-backup',
    'copyFileSync',
    'writeFileSync',
    'MARKER_START',
    'MARKER_END',
  ];

  for (const token of forbidden) {
    assert(!cssInjector.includes(token), `Unsafe core-CSS mutation token still present: ${token}`);
  }

  const requiredTokens = [
    'createTextEditorDecorationType',
    'contentIconPath: vscode.Uri.file(imagePath)',
    'width: \'100vw\'',
    'height: \'100vh\'',
    'background-size: cover !important',
    'opacity:',
    'animateCrossfade',
  ];

  for (const token of requiredTokens) {
    assert(cssInjector.includes(token), `Missing decoration rendering token: ${token}`);
  }

  console.log('✓ rendering: uses safe editor decorations with fullscreen cover styling');
}

function checkEmotionFlow() {
  const imageManager = read(imageManagerPath);
  const extension = read(extensionPath);

  assert(imageManager.includes('setImagesFolder'), 'ImageManager must support rescanning custom image folders');
  assert(extension.includes('onDidChangeTextDocument'), 'Extension must refresh after edits');
  assert(extension.includes('scheduleEditRefresh'), 'Extension must debounce live LLM refresh');
  assert(extension.includes('onDidChangeVisibleTextEditors'), 'Extension must reapply decorations to visible editors');
  assert(!extension.includes('reloadWindow'), 'Extension should not require window reload for mood changes');

  console.log('✓ flow: live debounced emotion refresh and image-folder rescan are wired');
}

function main() {
  checkImages();
  checkSafeRendering();
  checkEmotionFlow();
  console.log('\nMood Background self-check passed.');
}

try {
  main();
} catch (error) {
  console.error('\nMood Background self-check failed:');
  console.error(error.message);
  process.exit(1);
}
