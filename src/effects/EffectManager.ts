import * as vscode from "vscode";
import * as fs from "fs";

type EffectKind = "blip" | "boom" | "newline";

// Per-editor state for rate limiting and decoration tracking
interface EditorState {
  lastBlipAt: number;
  lastBoomAt: number;
  activeDecorations: {
    blip: number;
    boom: number;
    newline: number;
  };
  buffers: Record<EffectKind, Array<{ opt: vscode.DecorationOptions; createdAt: number }>>;
  animTimers: Partial<Record<EffectKind, ReturnType<typeof setTimeout>>>;
  shakeTimer?: ReturnType<typeof setTimeout>;
  activeShakeDecoKey?: string;
  shakeEndAt?: number;
}

export class EffectManager {
  private context: vscode.ExtensionContext;
  private blipDecoration: vscode.TextEditorDecorationType;
  private boomDecoration: vscode.TextEditorDecorationType;
  private newlineDecoration: vscode.TextEditorDecorationType;
  private animDecoration: vscode.TextEditorDecorationType;

  // Jitter variants to approximate "shake"
  private jitterLeft: vscode.TextEditorDecorationType;
  private jitterRight: vscode.TextEditorDecorationType;

  // Cache of whole-line shake decorations by offset key ("x_y")
  private shakeDecoCache = new Map<string, vscode.TextEditorDecorationType>();

  // Per-editor state tracking
  private editorStates = new WeakMap<vscode.TextEditor, EditorState>();
  private fontBase64?: string;
  private readonly fontFamilyName = 'GravityBold8';
  private spriteData?: Record<EffectKind, {
    frames: Array<{ x: number; y: number; w: number; h: number }>;
    sheetW: number; sheetH: number; fps: number; pngBase64: string; frameUris: vscode.Uri[];
  }>;
  private runningSpriteAnim = new WeakMap<vscode.TextEditor, Partial<Record<EffectKind, NodeJS.Timeout>>>();
  
  // Maximum concurrent decorations per effect type per editor
  private readonly MAX_DECORATIONS_PER_TYPE = 5; // fallback; config can override

  constructor(context: vscode.ExtensionContext) {
    this.context = context;

    const media = vscode.Uri.joinPath(this.context.extensionUri, "media");
    const blipIcon = vscode.Uri.joinPath(media, "blip.svg");
    const boomIcon = vscode.Uri.joinPath(media, "boom.svg");
    const newlineIcon = vscode.Uri.joinPath(media, "newline.svg");

    this.blipDecoration = vscode.window.createTextEditorDecorationType({
      rangeBehavior: vscode.DecorationRangeBehavior.ClosedClosed,
      after: {
        contentIconPath: blipIcon,
        margin: "0 0 0 2px"
      }
    });

    this.boomDecoration = vscode.window.createTextEditorDecorationType({
      rangeBehavior: vscode.DecorationRangeBehavior.ClosedClosed,
      after: {
        contentIconPath: boomIcon,
        margin: "0 0 0 2px"
      }
    });

    this.newlineDecoration = vscode.window.createTextEditorDecorationType({
      rangeBehavior: vscode.DecorationRangeBehavior.ClosedClosed,
      after: {
        contentIconPath: newlineIcon,
        margin: "0 0 0 2px"
      }
    });

    this.animDecoration = vscode.window.createTextEditorDecorationType({
      rangeBehavior: vscode.DecorationRangeBehavior.ClosedClosed,
      after: {
        margin: '0',
      }
    });

    this.jitterLeft = vscode.window.createTextEditorDecorationType({
      after: { margin: "0 0 0 -2px" }
    });
    this.jitterRight = vscode.window.createTextEditorDecorationType({
      after: { margin: "0 0 0 2px" }
    });

    // Set up cleanup on editor close
    context.subscriptions.push(
      vscode.window.onDidChangeVisibleTextEditors(editors => {
        // Clean up state for editors that are no longer visible
        this.cleanupInvisibleEditors(editors);
      })
    );
  }

  dispose() {
    this.blipDecoration.dispose();
    this.boomDecoration.dispose();
    this.newlineDecoration.dispose();
    this.jitterLeft.dispose();
    this.jitterRight.dispose();
    this.animDecoration.dispose();
    // Do not dispose shakeDecoCache here; they are reused and VS Code cleans up on extension deactivate
  }

  private getEditorState(editor: vscode.TextEditor): EditorState {
    let state = this.editorStates.get(editor);
    if (!state) {
      state = {
        lastBlipAt: 0,
        lastBoomAt: 0,
        activeDecorations: {
          blip: 0,
          boom: 0,
          newline: 0
        },
        buffers: { blip: [], boom: [], newline: [] },
        animTimers: {}
      };
      this.editorStates.set(editor, state);
    }
    return state;
  }

  private godotRandfRange(min: number, max: number): number {
    return Math.random() * (max - min) + min;
  }

  private randomGodotColor(): string {
    const r = Math.min(1, this.godotRandfRange(0, 2));
    const g = Math.min(1, this.godotRandfRange(0, 2));
    const b = Math.min(1, this.godotRandfRange(0, 2));
    const R = Math.round(r * 255);
    const G = Math.round(g * 255);
    const B = Math.round(b * 255);
    return `rgb(${R}, ${G}, ${B})`;
  }

  private getCaretHeightEm(editor: vscode.TextEditor): number {
    try {
      const cfg = vscode.workspace.getConfiguration('editor', editor.document.uri);
      const fontSize = Math.max(8, cfg.get<number>('fontSize', 14));
      const lineHeightPx = Math.max(0, cfg.get<number>('lineHeight', 0));
      if (lineHeightPx > 0) return lineHeightPx / fontSize;
      return 1.35; // fallback typical VS Code ratio
    } catch {
      return 1.35;
    }
  }

  private getComboConfig() {
    const cfg = vscode.workspace.getConfiguration('ridiculousCoding');
    const maxTrail = Math.max(0, cfg.get<number>('combo.maxTrail', 5));
    const blipMs = Math.max(0, cfg.get<number>('combo.ttl.blipMs', 400));
    const boomMs = Math.max(0, cfg.get<number>('combo.ttl.boomMs', 650));
    const newlineMs = Math.max(0, cfg.get<number>('combo.ttl.newlineMs', 350));
    const frameMs = Math.max(10, cfg.get<number>('combo.anim.frameMs', 50));
    const floatEm = Math.max(0, cfg.get<number>('combo.anim.floatEm', 0.7));
    const scaleAdd = Math.max(0, cfg.get<number>('combo.anim.scaleAdd', 0.6));
    return { maxTrail, ttl: { blipMs, boomMs, newlineMs }, anim: { frameMs, floatEm, scaleAdd } };
  }

  private getTtl(kind: EffectKind): number {
    const { ttl } = this.getComboConfig();
    return kind === 'boom' ? ttl.boomMs : kind === 'blip' ? ttl.blipMs : ttl.newlineMs;
  }

  private ensureAnimating(editor: vscode.TextEditor, kind: EffectKind) {
    const state = this.getEditorState(editor);
    if (state.animTimers[kind]) return;
    const dec = (kind === "blip" ? this.blipDecoration : kind === "boom" ? this.boomDecoration : this.newlineDecoration);

    const tick = () => {
      const st = this.getEditorState(editor);
      const buf = st.buffers[kind];
      if (!buf.length) {
        const t = st.animTimers[kind];
        if (t) clearTimeout(t);
        delete st.animTimers[kind];
        return;
      }

      const now = Date.now();
      const ttl = this.getTtl(kind);
      const { anim } = this.getComboConfig();
      const baseY = 1.1; // em above caret
      const extraY = anim.floatEm; // additional float up over lifetime
      const baseScale = 1.6;
      const extraScale = anim.scaleAdd;

      // Update transforms per item based on age
      for (const item of buf) {
        const age = now - item.createdAt;
        const p = Math.max(0, Math.min(1, age / ttl));
        const y = -(baseY + extraY * p);
        const s = baseScale + extraScale * p;
        const after = ((item.opt.renderOptions ??= {}).after ??= {} as any);
        after.width = '0';
        after.height = after.height ?? '1em';
        after.textDecoration = `none; position: absolute; display: inline-block; transform: translateY(${y}em) scale(${s}); transform-origin: left bottom; pointer-events: none; z-index: 1000; line-height: 0;`;
      }

      // Re-apply all current options
      editor.setDecorations(dec, buf.map(b => b.opt));

      // Schedule next frame
      state.animTimers[kind] = setTimeout(tick, this.getComboConfig().anim.frameMs);
    };

    state.animTimers[kind] = setTimeout(tick, this.getComboConfig().anim.frameMs);
  }

  private getFontBase64(): string | undefined {
    if (this.fontBase64) return this.fontBase64;
    try {
      const fontUri = vscode.Uri.joinPath(this.context.extensionUri, "media", "font", "GravityBold8.ttf");
      const buf = fs.readFileSync(fontUri.fsPath);
      this.fontBase64 = Buffer.from(buf).toString("base64");
      return this.fontBase64;
    } catch {
      return undefined;
    }
  }

  private getEditorFontSizePx(editor: vscode.TextEditor): number {
    try {
      const cfg = vscode.workspace.getConfiguration('editor', editor.document.uri);
      return Math.max(8, cfg.get<number>('fontSize', 14));
    } catch {
      return 14;
    }
  }

  private cleanupInvisibleEditors(visibleEditors: readonly vscode.TextEditor[]) {
    // This is a simple cleanup - more sophisticated cleanup would require 
    // tracking all editors we've seen, but WeakMap handles memory automatically
    // when editors are garbage collected
  }

  private canAddDecoration(editor: vscode.TextEditor, kind: EffectKind): boolean {
    const state = this.getEditorState(editor);
    return state.activeDecorations[kind] < this.MAX_DECORATIONS_PER_TYPE;
  }

  private caretRange(editor: vscode.TextEditor): vscode.Range {
    const pos = editor.selection.active;
    return new vscode.Range(pos, pos);
  }

  private rangeAboveCaret(editor: vscode.TextEditor): vscode.Range {
  const pos = editor.selection.active;
  const lineAbove = Math.max(0, pos.line - 1);
  const abovePos = new vscode.Position(lineAbove, pos.character);
  return new vscode.Range(abovePos, abovePos);
}

  // Build a lightweight SVG as a data URI for the provided text
  private buildTextSvgDataUri(text: string, options?: { color?: string; fontSize?: number; fontFamily?: string; paddingX?: number; paddingY?: number }): vscode.Uri {
    const esc = (s: string) => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
    const color = options?.color ?? '#ffffff';
    const fontSize = Math.max(8, Math.min(48, options?.fontSize ?? 14));
    const fontFamily = options?.fontFamily ?? `'${this.fontFamilyName}', 'Cascadia Code','Consolas',monospace`;
    const paddingX = options?.paddingX ?? 2;
    const paddingY = options?.paddingY ?? 1;

    // We do not measure width; let VS Code scale via height and rely on auto text layout.
    // Add minimal padding and baseline to avoid clipping.
    const baseline = fontSize + paddingY;
    const fontData = this.getFontBase64();
    const fontFace = fontData
      ? `@font-face { font-family: '${this.fontFamilyName}'; src: url(data:font/ttf;base64,${fontData}) format('truetype'); font-weight: normal; font-style: normal; }`
      : '';
    const svg = `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" height="${baseline + paddingY}">\n  <defs>\n    <style><![CDATA[\n      ${fontFace}\n      .t { font-family: ${fontFamily}; font-size: ${fontSize}px; fill: ${color}; }\n    ]]></style>\n  </defs>\n  <text class="t" x="${paddingX}" y="${baseline}">${esc(text)}</text>\n</svg>`;
    const data = 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);
    return vscode.Uri.parse(data);
  }

  private async ensureSpriteData(kind: EffectKind): Promise<void> {
    if (this.spriteData && this.spriteData[kind]) return;
    const dir = vscode.Uri.joinPath(this.context.extensionUri, 'media', 'animations');
    const tscnUri = vscode.Uri.joinPath(dir, `${kind}.tscn`);
    const pngUri = vscode.Uri.joinPath(dir, `${kind}.png`);
    const tscnText = fs.readFileSync(tscnUri.fsPath, 'utf8');
    const pngB64 = Buffer.from(fs.readFileSync(pngUri.fsPath)).toString('base64');
    
    // Parse AtlasTextures regions by id
    const atlasMap = new Map<string, { x: number; y: number; w: number; h: number }>();
    const atlasBlocks = [...tscnText.matchAll(/\[sub_resource\s+type="AtlasTexture"\s+id="(.*?)"\][\s\S]*?region\s*=\s*Rect2\(([^\)]*)\)/g)];
    for (const m of atlasBlocks) {
      const id = m[1];
      const nums = m[2].split(',').map(s => parseFloat(s.trim()));
      if (nums.length >= 4) atlasMap.set(id, { x: nums[0], y: nums[1], w: nums[2], h: nums[3] });
    }
    //
    // Parse SpriteFrames order and speed
    const framesOrder: string[] = [];
    const animBlock = tscnText.match(/\[sub_resource\s+type="SpriteFrames"[\s\S]*?animations\s*=\s*\[(\{[\s\S]*?\})\][\s\S]*?\n/);
    if (animBlock) {
      const block = animBlock[1];
      const subResRefs = [...block.matchAll(/SubResource\("(.*?)"\)/g)];
      for (const sr of subResRefs) framesOrder.push(sr[1]);
    }
    const speedMatch = tscnText.match(/\"speed\"\s*:\s*([0-9.]+)/);
    const fps = speedMatch ? Math.max(1, parseFloat(speedMatch[1])) : 24;

    const frames: Array<{ x: number; y: number; w: number; h: number }> = [];
    for (const id of framesOrder) {
      const rect = atlasMap.get(id);
      if (rect) frames.push(rect);
    }
    // Fallback: if order failed, use atlas order
    if (!frames.length && atlasMap.size) frames.push(...[...atlasMap.values()]);

    // Compute sheet dimensions from max extents
    let sheetW = 0, sheetH = 0;
    for (const f of frames) { sheetW = Math.max(sheetW, f.x + f.w); sheetH = Math.max(sheetH, f.y + f.h); }

    // Prebuild frame SVG URIs
    const frameUris: vscode.Uri[] = frames.map(f => {
      const svg = `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${f.w} ${f.h}" width="${f.w}" height="${f.h}">\n  <image href="data:image/png;base64,${pngB64}" x="-${f.x}" y="-${f.y}" width="${sheetW}" height="${sheetH}" preserveAspectRatio="none"/>\n</svg>`;
      return vscode.Uri.parse('data:image/svg+xml;utf8,' + encodeURIComponent(svg));
    });

  this.spriteData = this.spriteData ?? ({} as Record<EffectKind, any>);
  (this.spriteData as Record<EffectKind, any>)[kind] = { frames, sheetW, sheetH, fps, pngBase64: pngB64, frameUris };
  }

  private clearSpriteAnim(editor: vscode.TextEditor, kind?: EffectKind) {
    const map = this.runningSpriteAnim.get(editor);
    if (!map) return;
    const kinds: EffectKind[] = kind ? [kind] : (['blip','boom','newline'] as EffectKind[]);
    for (const k of kinds) {
      const t = map[k];
      if (t) { clearTimeout(t); delete map[k]; }
    }
    if (!kind) this.runningSpriteAnim.delete(editor);
    // Also clear decoration if we stopped a specific kind
    if (kind) editor.setDecorations(this.animDecoration, []);
  }

  private async playSpriteAnim(editor: vscode.TextEditor, kind: EffectKind) {
    await this.ensureSpriteData(kind);
    const data = this.spriteData![kind];
    if (!data || !data.frames.length) return;
    // Cancel any running anim for this kind
    let map = this.runningSpriteAnim.get(editor);
    if (!map) { map = {}; this.runningSpriteAnim.set(editor, map); }
    const existing = map[kind]; if (existing) { clearTimeout(existing); delete map[kind]; }

    const caretRange = this.caretRange(editor);
    const total = data.frameUris.length;
    const frameMs = Math.max(10, Math.round(1000 / data.fps));
    let i = 0;
    const step = () => {
      if (i >= total) { editor.setDecorations(this.animDecoration, []); delete map![kind]; return; }
      const idx = i++;
      const icon = data.frameUris[idx];
      let opt: vscode.DecorationOptions;
      if (kind === 'boom') {
        const frame = data.frames[idx];
        const hPx = Math.max(1, Math.round(frame?.h ?? 1));
        const wPx = Math.max(1, Math.round(frame?.w ?? 1));
        const fontPx = this.getEditorFontSizePx(editor);
        const targetHeightPx = fontPx * 1.5; // exactly 1em (same as font size)
        const targetWidthPx = Math.max(1, Math.round((wPx / hPx) * targetHeightPx));
        const heightEm = targetHeightPx / fontPx; // 1.0
        const widthEm = targetWidthPx / fontPx;
        const lineEm = this.getCaretHeightEm(editor);
        const txEm = -(widthEm / 2);
        const tyEm = (heightEm/2) - (lineEm / 2); // center vertically in line
        // Build a per-frame SVG at the desired px size so the image is intrinsically sized correctly
        const sheetW = data.sheetW;
        const sheetH = data.sheetH;
        const svg = `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${wPx} ${hPx}" width="${targetWidthPx}" height="${targetHeightPx}">\n  <image href="data:image/png;base64,${data.pngBase64}" x="-${frame.x}" y="-${frame.y}" width="${sheetW}" height="${sheetH}" preserveAspectRatio="none"/>\n</svg>`;
        const scaledIcon = vscode.Uri.parse('data:image/svg+xml;utf8,' + encodeURIComponent(svg));
        opt = {
          range: caretRange,
          renderOptions: {
            after: {
              contentIconPath: scaledIcon,
              width: '0',
              textDecoration: `none; position:absolute; display:inline-block; line-height:0; transform: translate(${txEm.toFixed(3)}em, ${tyEm.toFixed(3)}em); transform-origin:left bottom; pointer-events:none; z-index:1000;`
            }
          }
        };
      } else if (kind === 'blip') {
        const frame = data.frames[idx];
        const hPx = Math.max(1, Math.round(frame?.h ?? 1));
        const wPx = Math.max(1, Math.round(frame?.w ?? 1));
        const fontPx = this.getEditorFontSizePx(editor);
        const targetHeightPx = fontPx; // exactly 1em
        const targetWidthPx = Math.max(1, Math.round((wPx / hPx) * targetHeightPx));
        const heightEm = targetHeightPx / fontPx; // 1.0
        const widthEm = targetWidthPx / fontPx;
        const lineEm = this.getCaretHeightEm(editor);
        const txEm = -(widthEm / 2);
        const tyEm = (heightEm / 2) - (lineEm / 2);
        opt = {
          range: caretRange,
          renderOptions: {
            after: {
              contentIconPath: icon,
              height: `${heightEm}em`,
              width: '0',
              textDecoration: `none; position:absolute; display:inline-block; line-height:0; transform: translate(${txEm.toFixed(3)}em, ${tyEm.toFixed(3)}em); transform-origin:left bottom; pointer-events:none; z-index:1000;`
            }
          }
        };
      } else {
        opt = {
          range: caretRange,
          renderOptions: {
            after: {
              contentIconPath: icon,
              height: '1.2em',
              width: '0',
              textDecoration: 'none; position:absolute; display:inline-block; line-height:0; transform: translate(-0.6em, -1.2em); transform-origin:left bottom; pointer-events:none; z-index:1000;'
            }
          }
        };
      }
      editor.setDecorations(this.animDecoration, [opt]);
      map![kind] = setTimeout(step, frameMs);
    };
    step();
  }

  private applyOnce(editor: vscode.TextEditor, kind: EffectKind, label?: string) {
    if (!this.canAddDecoration(editor, kind)) {
      return; // Skip if too many decorations
    }
    const range = this.caretRange(editor);
    const dec = (kind === "blip" ? this.blipDecoration : kind === "boom" ? this.boomDecoration : this.newlineDecoration);

    // Build render options with optional text label via "renderOptions" at runtime
    const opt: vscode.DecorationOptions = (() => {
      if (label) {
        const color = this.randomGodotColor();
          const icon = this.buildTextSvgDataUri(label, { color, fontSize: 18 });
        return {
          range,
          renderOptions: {
            after: {
              contentIconPath: icon,
              height: '1em',
              width: '0',
              textDecoration: `none; position: absolute; display: inline-block; line-height: 0; transform: translateY(-1.1em) scale(1.6); transform-origin: left bottom; pointer-events: none; z-index: 1000;`
            }
          }
        } as vscode.DecorationOptions;
      }
      return { range } as vscode.DecorationOptions;
    })();

    // Push to buffer and render all active decorations for this kind
    const buffer = this.getEditorState(editor).buffers[kind];
    buffer.push({ opt, createdAt: Date.now() });
    const { maxTrail } = this.getComboConfig();
    const cap = Math.max(maxTrail, this.MAX_DECORATIONS_PER_TYPE);
    if (buffer.length > cap) {
      buffer.shift();
    }
    editor.setDecorations(dec, buffer.map(b => b.opt));
    this.ensureAnimating(editor, kind);

    // Track active decoration
    const state = this.getEditorState(editor);
    state.activeDecorations[kind]++;

    // Clear shortly after to simulate animation flash
    const ttl = this.getTtl(kind);
    setTimeout(() => {
      try {
        const st = this.getEditorState(editor);
        const arr = st.buffers[kind];
        const idx = arr.findIndex(x => x.opt === opt);
        if (idx !== -1) {
          arr.splice(idx, 1);
          editor.setDecorations(dec, arr.map(b => b.opt));
        }
        st.activeDecorations[kind] = Math.max(0, st.activeDecorations[kind] - 1);
      } catch {
        // no-op - editor might have been disposed
      }
    }, ttl);
  }

  private shake(editor: vscode.TextEditor, extendMs: number) {
    const state = this.getEditorState(editor);
    const now = Date.now();
    const cfg = vscode.workspace.getConfiguration('ridiculousCoding');
    const decayMs = Math.max(20, cfg.get<number>('shakeDecayMs', 120));
    const maxExtend = Math.max(extendMs, decayMs);
    state.shakeEndAt = Math.max(state.shakeEndAt ?? 0, now + maxExtend);

    // Fixed amplitude for uniform magnitude in all directions
    const amplitudePx = Math.max(0, Math.min(32, cfg.get<number>('shakeAmplitude', 6)));

    const getKey = (x: number, y: number) => `${x}_${y}`;
    const getDeco = (x: number, y: number) => {
      const key = getKey(x, y);
      let deco = this.shakeDecoCache.get(key);
      if (!deco) {
        deco = vscode.window.createTextEditorDecorationType({
          isWholeLine: true,
          rangeBehavior: vscode.DecorationRangeBehavior.ClosedClosed,
          textDecoration: `none; position: relative; left: ${x}px; top: ${y}px;`
        });
        this.shakeDecoCache.set(key, deco);
      }
      return { key, deco };
    };

    const visibleLineRanges = () => {
      const ranges: vscode.Range[] = [];
      const doc = editor.document;
      for (const r of editor.visibleRanges) {
        const startLine = Math.max(0, r.start.line);
        const endLine = Math.min(doc.lineCount - 1, r.end.line);
        for (let line = startLine; line <= endLine; line++) {
          const textLine = doc.lineAt(line);
          ranges.push(new vscode.Range(line, 0, line, textLine.range.end.character));
        }
      }
      // Fallback to entire doc if visibleRanges is empty
      if (!ranges.length && doc.lineCount > 0) {
        for (let line = 0; line < doc.lineCount; line++) {
          const textLine = doc.lineAt(line);
          ranges.push(new vscode.Range(line, 0, line, textLine.range.end.character));
        }
      }
      return ranges;
    };

    const applyShake = () => {
      const elapsedNow = Date.now();
      if (!state.shakeEndAt || elapsedNow > state.shakeEndAt) {
        // Clear any active shake decoration
        if (state.activeShakeDecoKey) {
          const prev = this.shakeDecoCache.get(state.activeShakeDecoKey);
          if (prev) editor.setDecorations(prev, []);
          state.activeShakeDecoKey = undefined;
        }
        state.shakeTimer = undefined;
        return;
      }

      // Pick a random direction on the circle, fixed radius
      const angle = Math.random() * Math.PI * 2;
      const dx = Math.round(Math.cos(angle) * amplitudePx);
      const dy = Math.round(Math.sin(angle) * amplitudePx);
      const { key, deco } = getDeco(dx, dy);

      // Clear previous decoration if different
      if (state.activeShakeDecoKey && state.activeShakeDecoKey !== key) {
        const prev = this.shakeDecoCache.get(state.activeShakeDecoKey);
        if (prev) editor.setDecorations(prev, []);
      }

      const ranges = visibleLineRanges();
      editor.setDecorations(deco, ranges);
      state.activeShakeDecoKey = key;

      state.shakeTimer = setTimeout(applyShake, 16);
    };

    if (!state.shakeTimer) {
      applyShake();
    }
  }

  showBlip(editor: vscode.TextEditor, showChars: boolean, shake?: boolean, charLabel?: string) {
    const state = this.getEditorState(editor);
    const now = Date.now();
    let didVisual = false;
    if (now - state.lastBlipAt >= 20) {
      state.lastBlipAt = now;
      this.clearSpriteAnim(editor); // reset previous anims on new keypress
      this.applyOnce(editor, "blip", showChars ? charLabel : undefined);
      this.playSpriteAnim(editor, 'blip');
      didVisual = true;
    }
  if (shake) this.shake(editor, 120);
  }

  showBoom(editor: vscode.TextEditor, showChars: boolean, shake?: boolean, charLabel?: string) {
    const state = this.getEditorState(editor);
    const now = Date.now();
    let didVisual = false;
    if (now - state.lastBoomAt >= 100) {
      state.lastBoomAt = now;
      this.clearSpriteAnim(editor);
      this.applyOnce(editor, "boom", showChars ? charLabel : undefined);
      this.playSpriteAnim(editor, 'boom');
      didVisual = true;
    }
  if (shake) this.shake(editor, 180);
  }

  showNewline(editor: vscode.TextEditor, shake: boolean) {
    this.clearSpriteAnim(editor);
    this.applyOnce(editor, "newline");
    this.playSpriteAnim(editor, 'newline');
  if (shake) this.shake(editor, 140);
  }

  // Method to clean up all decorations for an editor (useful for reduced effects)
  clearAllDecorations(editor: vscode.TextEditor) {
    try {
      editor.setDecorations(this.blipDecoration, []);
      editor.setDecorations(this.boomDecoration, []);
      editor.setDecorations(this.newlineDecoration, []);
      editor.setDecorations(this.jitterLeft, []);
      editor.setDecorations(this.jitterRight, []);
      
      // Reset decoration counts
      const state = this.getEditorState(editor);
      state.activeDecorations = { blip: 0, boom: 0, newline: 0 };
      state.buffers = { blip: [], boom: [], newline: [] };
      // Stop any anim timers
      for (const k of ["blip","boom","newline"] as EffectKind[]) {
        const t = state.animTimers[k];
        if (t) clearTimeout(t);
        delete state.animTimers[k];
      }
    } catch {
      // no-op - editor might have been disposed
    }
  }
}