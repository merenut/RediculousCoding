import * as vscode from "vscode";
import { PanelMessageFromExt, PanelMessageToExt, Settings } from "../types";

export class PanelViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = "ridiculousCoding.panel";

  private _view?: vscode.WebviewView;
  private context: vscode.ExtensionContext;

  constructor(context: vscode.ExtensionContext) {
    this.context = context;
  }

  resolveWebviewView(webviewView: vscode.WebviewView): void | Thenable<void> {
    this._view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this.context.extensionUri]
    };

  webviewView.webview.html = this.getHtml(webviewView.webview);

    webviewView.webview.onDidReceiveMessage((msg: PanelMessageToExt) => {
      switch (msg.type) {
        case "ready":
          const soundBase = vscode.Uri.joinPath(this.context.extensionUri, 'media', 'sound');
          const soundUris = {
            blip: webviewView.webview.asWebviewUri(vscode.Uri.joinPath(soundBase, 'blip.wav')).toString(),
            boom: webviewView.webview.asWebviewUri(vscode.Uri.joinPath(soundBase, 'boom.wav')).toString(),
            fireworks: webviewView.webview.asWebviewUri(vscode.Uri.joinPath(soundBase, 'fireworks.wav')).toString()
          };
          this.post({
            type: "init",
            settings: this.getSettings(),
            xp: this.context.globalState.get("xp", 0),
            level: this.context.globalState.get("level", 1),
            xpNext: this.context.globalState.get("xpNextAbs", 100),
            xpLevelStart: this.context.globalState.get("xpLevelStart", 0),
            soundUris
          });
          break;
        case "toggle":
          this.updateSetting(msg.key, msg.value);
          break;
        case "resetXp":
          vscode.commands.executeCommand("ridiculousCoding.resetXp");
          break;
        case "requestState":
          this.post({
            type: "state",
            xp: this.context.globalState.get("xp", 0),
            level: this.context.globalState.get("level", 1),
            xpNext: this.context.globalState.get("xpNextAbs", 100),
            xpLevelStart: this.context.globalState.get("xpLevelStart", 0)
          });
          break;
      }
    });
  }

  post(message: PanelMessageFromExt) {
    this._view?.webview.postMessage(message);
  }

  reveal() {
    this._view?.show?.(true);
  }

  private getSettings(): Settings {
    const cfg = vscode.workspace.getConfiguration("ridiculousCoding");
    return {
      explosions: cfg.get("explosions", true),
      blips: cfg.get("blips", true),
      chars: cfg.get("chars", true),
      shake: cfg.get("shake", true),
      shakeAmplitude: cfg.get("shakeAmplitude", 6),
      shakeDecayMs: cfg.get("shakeDecayMs", 120),
      sound: cfg.get("sound", true),
      nativeSound: cfg.get("nativeSound", true),
      fireworks: cfg.get("fireworks", true),
      baseXp: cfg.get("leveling.baseXp", 50),
      enableStatusBar: cfg.get("enableStatusBar", true),
      reducedEffects: cfg.get("reducedEffects", false)
    };
  }

  private async updateSetting<K extends keyof Settings>(key: K, value: Settings[K]) {
    const map: Record<string, string> = {
      explosions: "explosions",
      blips: "blips",
      chars: "chars",
      shake: "shake",
      shakeAmplitude: "shakeAmplitude",
      shakeDecayMs: "shakeDecayMs",
      sound: "sound",
      nativeSound: "nativeSound",
      fireworks: "fireworks",
      baseXp: "leveling.baseXp",
      enableStatusBar: "enableStatusBar",
      reducedEffects: "reducedEffects"
    };
    const configKey = map[key];
    if (!configKey) return;
    await vscode.workspace.getConfiguration("ridiculousCoding").update(configKey, value, true);
  }

  private getHtml(webview: vscode.Webview): string {
    const nonce = Math.random().toString(36).slice(2);
    const cssUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.context.extensionUri, "webview", "panel.css")
    );
    const jsUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.context.extensionUri, "webview", "panel.js")
    );
    const logoUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.context.extensionUri, "media", "icons", "icon.svg")
    );

    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${webview.cspSource} blob: data:; media-src ${webview.cspSource}; connect-src ${webview.cspSource}; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}';">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<link href="${cssUri}" rel="stylesheet">
<title>Ridiculous Coding</title>
</head>
<body>
  <div class="container">
    <header class="header">
      <img class="logo" src="${logoUri}" alt="Ridiculous Coding" />
      <div class="title">
        <h1>Ridiculous Coding</h1>
        <p class="subtitle">Blips, booms, fireworks, XP and levels ✨</p>
      </div>
    </header>

    <section class="card">
      <h2 class="card-title">Effects</h2>
      <div class="notice" id="soundNotice" role="button" tabindex="0" title="Click to enable sound">🔊 Click anywhere in this panel to enable sound (webview mode)</div>
      <div class="toggles">
        <label class="toggle-pill"><input id="explosions" type="checkbox"><span>Explosions</span></label>
        <label class="toggle-pill"><input id="blips" type="checkbox"><span>Blips</span></label>
        <label class="toggle-pill"><input id="chars" type="checkbox"><span>Char labels</span></label>
        <label class="toggle-pill"><input id="shake" type="checkbox"><span>Shake</span></label>
        <label class="toggle-pill"><input id="sound" type="checkbox"><span>Sound</span></label>
        <label class="toggle-pill" title="Use native OS audio (instant, no click needed, uses pitch variants)"><input id="nativeSound" type="checkbox"><span>Native Sound</span></label>
        <label class="toggle-pill"><input id="fireworks" type="checkbox"><span>Fireworks</span></label>
        <label class="toggle-pill"><input id="reducedEffects" type="checkbox"><span>Reduced Effects</span></label>
      </div>
    </section>

    <section class="card xp">
      <h2 class="card-title">Progress</h2>
      <div class="labels">
        <div id="levelLabel" class="badge">Level: 1</div>
        <div id="xpLabel" class="muted">XP: 0 / 100</div>
      </div>
      <div class="bar"><div id="barInner"></div></div>
      <div class="row">
        <button id="resetBtn" class="btn">Reset</button>
        <button id="testFireworks" class="btn ghost" title="Test fireworks">🎆 Test Fireworks</button>
      </div>
      <canvas id="fwCanvas" class="hidden"></canvas>
    </section>
  </div>

  <script nonce="${nonce}" src="${jsUri}"></script>
</body>
</html>`;
  }
}