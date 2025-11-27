import * as vscode from "vscode";
import * as path from "path";
import { spawn, ChildProcess } from "child_process";

/**
 * Native sound player using a persistent PowerShell process to avoid startup delays.
 *
 * Keeps a long-running PowerShell process and sends it commands via stdin.
 * This eliminates the ~100-200ms PowerShell startup overhead on each sound.
 *
 */
export class NativeSoundPlayer {
  private soundPaths: Map<string, string> = new Map();
  private enabled: boolean = true;
  private debugMode: boolean = false;
  private psProcess?: ChildProcess;
  private platform: NodeJS.Platform;
  private psReady: boolean = false;
  private initializationAttempted: boolean = false;

  constructor(private context: vscode.ExtensionContext) {
    this.platform = process.platform;
    this.initializeSoundPaths();
    if (this.platform === "win32") {
      this.initializePersistentProcess();
    }
  }

  private initializeSoundPaths(): void {
    const mediaPath = path.join(this.context.extensionPath, "media", "sound");
    // Base sounds
    this.soundPaths.set("blip", path.join(mediaPath, "blip.wav"));
    this.soundPaths.set("boom", path.join(mediaPath, "boom.wav"));
    this.soundPaths.set("fireworks", path.join(mediaPath, "fireworks.wav"));

    // Pitch variants for blip (20 variants: 1.05x to 2.0x in 0.05 increments)
    for (let i = 1; i <= 20; i++) {
      const paddedIndex = i.toString().padStart(2, '0');
      this.soundPaths.set(`blip_p${paddedIndex}`, path.join(mediaPath, `blip_p${paddedIndex}.wav`));
    }
  }

  /**
   * Initialize a persistent PowerShell process for Windows
   */
  private initializePersistentProcess(): void {
    if (this.initializationAttempted) {
      return; // Don't try to initialize multiple times
    }
    this.initializationAttempted = true;

    try {
      // Spawn PowerShell in interactive mode
      this.psProcess = spawn("powershell.exe", [
        "-NoProfile",
        "-NoLogo",
        "-NonInteractive",
        "-Command",
        "-"
      ], {
        stdio: ["pipe", "pipe", "pipe"],
        windowsHide: true
      });

      if (this.debugMode && this.psProcess.stderr) {
        this.psProcess.stderr.on("data", (data) => {
          console.error(`[NativeSoundPlayer] PS stderr: ${data}`);
        });
      }

      this.psProcess.on("error", (err) => {
        if (this.debugMode) {
          console.error(`[NativeSoundPlayer] PS process error:`, err);
        }
        this.psProcess = undefined;
        this.psReady = false;
        this.initializationAttempted = false; // Allow retry
      });

      this.psProcess.on("exit", (code) => {
        if (this.debugMode) {
          console.log(`[NativeSoundPlayer] PS process exited with code ${code}`);
        }
        this.psProcess = undefined;
        this.psReady = false;
        this.initializationAttempted = false; // Allow retry
      });

      if (this.debugMode) {
        console.log("[NativeSoundPlayer] Persistent PowerShell process initializing...");
      }

      // Wait for PowerShell to fully initialize before marking as ready
      // PowerShell takes time to start and stdin to become writable
      setTimeout(() => {
        if (this.psProcess && this.psProcess.stdin) {
          this.psReady = true;
          if (this.debugMode) {
            console.log("[NativeSoundPlayer] PowerShell process is ready");
          }
        }
      }, 300); // 300ms delay to ensure PowerShell is fully started
    } catch (error) {
      if (this.debugMode) {
        console.error(`[NativeSoundPlayer] Failed to initialize PS process:`, error);
      }
      this.initializationAttempted = false; // Allow retry
    }
  }

  /**
   * Play a sound by name with optional pitch variation.
   * @param soundName - "blip", "boom", or "fireworks"
   * @param pitch - Pitch multiplier (1.0 = normal, 1.05-1.20 for variants)
   */
  public play(soundName: string, pitch: number = 1.0): void {
    if (!this.enabled) {
      return;
    }

    // Select appropriate sound file based on pitch
    // Pitch formula: 1.0 + Math.min(20, pitchIncrease) * 0.05
    // Range: 1.0 (first key) to 2.0 (20th+ key) in 0.05 increments
    // Matches webview exactly!
    let selectedSound = soundName;
    if (soundName === "blip") {
      // Calculate which variant to use based on pitch
      // Round to nearest 0.05 increment
      const variantIndex = Math.round((pitch - 1.0) / 0.05);

      if (variantIndex === 0) {
        selectedSound = "blip"; // 1.0x (original)
      } else if (variantIndex >= 20) {
        selectedSound = "blip_p20"; // 2.0x (max)
      } else {
        // blip_p01 through blip_p19
        const paddedIndex = variantIndex.toString().padStart(2, '0');
        selectedSound = `blip_p${paddedIndex}`;
      }
    }

    const soundPath = this.soundPaths.get(selectedSound);
    if (!soundPath) {
      console.warn(`[NativeSoundPlayer] Unknown sound: ${selectedSound}`);
      return;
    }

    if (this.platform === "win32") {
      this.playWindows(soundPath);
    } else if (this.platform === "darwin") {
      this.playMacOS(soundPath);
    } else if (this.platform === "linux") {
      this.playLinux(soundPath);
    }
  }

  /**
   * Play sound on Windows using persistent PowerShell process
   */
  private playWindows(filePath: string): void {
    try {
      // If persistent process is not ready, try to initialize it
      if (!this.psReady || !this.psProcess || !this.psProcess.stdin) {
        // Try to initialize if not attempted yet
        if (!this.initializationAttempted && !this.psProcess) {
          this.initializePersistentProcess();
        }

        // Use fallback for immediate playback while process initializes
        this.playWindowsFallback(filePath);
        return;
      }

      // Send command to persistent process via stdin
      // Using a simple one-liner that doesn't need to store variables
      const command = `(New-Object System.Media.SoundPlayer '${filePath}').Play()\n`;
      this.psProcess.stdin.write(command);
    } catch (error) {
      if (this.debugMode) {
        console.error(`[NativeSoundPlayer] Error in playWindows:`, error);
      }
      // Fallback to one-off process
      this.playWindowsFallback(filePath);
    }
  }

  /**
   * Fallback method for Windows when persistent process is unavailable
   */
  private playWindowsFallback(filePath: string): void {
    try {
      const child = spawn("powershell.exe", [
        "-NoProfile",
        "-NonInteractive",
        "-WindowStyle", "Hidden",
        "-ExecutionPolicy", "Bypass",
        "-Command",
        `(New-Object System.Media.SoundPlayer '${filePath}').Play(); Start-Sleep -Milliseconds 200`
      ], {
        stdio: "ignore",
        windowsHide: true,
        detached: false
      });

      child.on("error", () => {
        // Ignore errors in fallback
      });
    } catch (error) {
      // Silent fail
    }
  }

  /**
   * Play sound on macOS using afplay
   */
  private playMacOS(filePath: string): void {
    try {
      const child = spawn("afplay", [filePath], {
        detached: true,
        stdio: "ignore"
      });
      child.unref();
    } catch (error) {
      // Silent fail
    }
  }

  /**
   * Play sound on Linux using paplay
   */
  private playLinux(filePath: string): void {
    try {
      const child = spawn("paplay", [filePath], {
        detached: true,
        stdio: "ignore"
      });
      child.unref();
    } catch (error) {
      // Silent fail
    }
  }

  /**
   * Set whether sound playback is enabled
   */
  public setEnabled(enabled: boolean): void {
    this.enabled = enabled;

    // When re-enabling native sound, reinitialize PowerShell process if needed
    if (enabled && this.platform === "win32" && !this.psReady) {
      this.initializePersistentProcess();
    }
  }

  /**
   * Dispose resources and stop all sounds
   */
  public dispose(): void {
    // Kill persistent PowerShell process
    if (this.psProcess) {
      try {
        this.psProcess.kill();
      } catch (error) {
        // Ignore
      }
      this.psProcess = undefined;
    }
  }
}
