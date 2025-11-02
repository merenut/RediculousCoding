# 🚀 Ridiculous Coding - Level Up Your VS Code! 

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![VS Code](https://img.shields.io/badge/VS%20Code-1.84.0+-blue.svg)](https://code.visualstudio.com/)

**Transform your coding into an epic adventure!** Turn every keystroke into a celebration with explosive visual effects, satisfying sound feedback, and an addictive XP leveling system. 

## ✨ Why You'll Love This Extension

🎮 **Gamify Your Coding** - Earn XP for every character you type and level up with spectacular fireworks!  
💥 **Explosive Feedback** - Visual blips, booms, and screen shake make coding feel like an action game  
🔊 **Satisfying Sounds** - Delightful audio feedback that makes typing addictive  
⚡ **Instant Gratification** - See your progress in real-time with a beautiful status bar  
🎯 **Stay Motivated** - Turn mundane coding tasks into engaging challenges  
♿ **Accessibility First** - Reduced effects mode for users who prefer minimal distractions  

## 🎬 Features That Make Coding Ridiculous

### 🎨 **Visual Effects**
- **Blips** - Colorful animations when typing with optional character labels
- **Booms** - Dramatic explosions when deleting
- **Screen Shake** - Gentle editor jitter that responds to your typing intensity
- **Newline Animations** - Special effects for line breaks
- **Fireworks** - Celebration animations when you level up!

### 🎵 **Audio Experience** 
- **Typing Sounds** - Satisfying blips with pitch variation based on typing speed
- **Deletion Booms** - Powerful sound effects for backspace/delete
- **Level-up Fanfare** - Triumphant audio when reaching new levels
- **Web Audio Synthesis** - No external files needed, all sounds generated in-browser

### 📊 **Progression System**
- **XP Tracking** - Gain experience points for every character typed
- **Level System** - Progressive leveling with increasing XP requirements  
- **Status Bar Display** - Always see your current level and progress
- **Persistent Progress** - Your XP and level are saved between sessions
- **Reset Option** - Start fresh anytime with the reset command

### ⚙️ **Customization**
- **Toggle Everything** - Enable/disable any effect independently
- **Accessibility Mode** - Reduced effects for distraction-free coding
- **Configurable Settings** - Adjust shake intensity, sound volume, XP rates
- **Panel Controls** - Easy-to-use sidebar panel for real-time adjustments

## 🚀 Quick Start

### Installation
1. **From VS Code Marketplace** (Coming Soon!)
   - Search "Ridiculous Coding" in Extensions
   - Click Install

2. **Manual Installation**
   ```bash
   git clone https://github.com/merenut/RediculousCoding
   cd RediculousCoding
   npm install
   npm run compile
   # Press F5 in VS Code to launch Extension Development Host
   ```

### First Steps
1. Open VS Code and look for the 🚀 rocket icon in your status bar
2. Find "Ridiculous Coding" panel in the Explorer sidebar  
3. **Start typing and watch the magic happen!**
4. Customize effects in the panel or VS Code settings

## 🎯 Perfect For

- **New Developers** - Make learning to code more engaging and fun
- **Streamers & Content Creators** - Add visual flair to coding streams  
- **Team Building** - Gamify coding sessions and challenges
- **Anyone Who Loves Fun** - Because coding should be enjoyable!

## ⚙️ Settings & Commands

### Available Settings
All settings can be found in VS Code Settings → Extensions → Ridiculous Coding:

| Setting | Default | Description |
|---------|---------|-------------|
| `ridiculousCoding.explosions` | `true` | Show 'boom' effects when deleting |
| `ridiculousCoding.blips` | `true` | Show 'blip' effects when typing |
| `ridiculousCoding.chars` | `true` | Display character labels with effects |
| `ridiculousCoding.shake` | `true` | Enable screen shake effects |
| `ridiculousCoding.sound` | `true` | Play audio feedback |
| `ridiculousCoding.fireworks` | `true` | Celebrate level-ups with fireworks |
| `ridiculousCoding.enableStatusBar` | `true` | Show XP/Level in status bar |
| `ridiculousCoding.leveling.baseXp` | `50` | Base XP for leveling calculations |
| `ridiculousCoding.reducedEffects` | `false` | **Accessibility mode** - Disable effects for distraction-free coding |

### Quick Commands
- **Ridiculous Coding: Show Panel** - Open the control panel
- **Ridiculous Coding: Reset XP** - Start your progression over
- **Ridiculous Coding: Toggle [Effect]** - Quickly enable/disable specific effects

## ♿ Accessibility

We believe coding should be fun for everyone! Enable **Reduced Effects Mode** via:
- The settings panel toggle
- VS Code Settings: `ridiculousCoding.reducedEffects: true`

When enabled, this mode:
- ✅ Keeps XP progression working normally
- ❌ Disables all visual decorations and animations  
- ❌ Mutes all sound effects
- ❌ Removes screen shake

## 🛠️ Development & Contributing

Want to contribute or run this locally?

### Setup
```bash
# Clone the repository
git clone https://github.com/merenut/RediculousCoding
cd RediculousCoding

# Install dependencies
npm install

# Compile TypeScript
npm run compile

# Open in VS Code and press F5 to launch Extension Development Host
code .
```

### Architecture
- **Extension Host** (`src/extension.ts`) - Main extension logic
- **XP Service** (`src/xp/XPService.ts`) - Handles leveling and progression
- **Effect Manager** (`src/effects/EffectManager.ts`) - Visual effects and animations
- **Panel Provider** (`src/view/PanelViewProvider.ts`) - Webview control panel
- **Webview** (`webview/`) - HTML/CSS/JS for the settings panel

## 🎊 Credits & Inspiration

This VS Code extension lovingly recreates and expands upon the original concept:

- **Original Godot Plugin** - "ridiculous_coding" by [John Watson](https://github.com/jotson/ridiculous_coding)
- **Game Inspiration** - [Textreme2](https://ash-k.itch.io/textreme-2) by Ash K
- **VS Code Adaptation** - Enhanced with modern web technologies and VS Code integration

## 📝 Technical Notes

- **Performance Optimized** - Effects are rate-limited and memory-managed
- **Multi-Editor Support** - Works independently across multiple open editors  
- **No Dependencies** - All sounds generated via Web Audio API (no external files)
- **Cross-Platform** - Works on Windows, macOS, and Linux
- **VS Code API** - Uses official VS Code decoration and webview APIs

## 📄 License

MIT License - feel free to fork, modify, and share! See [LICENSE](LICENSE) for details.

---

**Ready to make your coding ridiculous?** Install now and transform every keystroke into an adventure! 🎮✨