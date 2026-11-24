export interface ShortcutItem {
  id: string;
  keys: string[];
  label: string;
  description: string;
  category: 'capture' | 'window' | 'reading' | 'remote';
  featured?: boolean;
}

export const KEYBOARD_SHORTCUTS: ShortcutItem[] = [
  {
    id: 'screen-capture',
    keys: ['Alt', 'S'],
    label: 'Screen capture',
    description: 'Capture active coding prompt, whiteboard, or slide for instant structured guidance.',
    category: 'capture',
    featured: true,
  },
  {
    id: 'video-scan',
    keys: ['Alt', 'V'],
    label: 'Video scan',
    description: 'Scan shared screen frames continuously during live code walkthroughs.',
    category: 'capture',
    featured: true,
  },
  {
    id: 'instant-answer',
    keys: ['Alt', 'X'],
    label: 'Instant answer',
    description: 'Trigger an immediate response from the latest spoken interviewer question.',
    category: 'capture',
    featured: true,
  },
  {
    id: 'hide-show',
    keys: ['Alt', 'H'],
    label: 'Hide / show window',
    description: 'Toggle the teleprompter window visibility instantly without breaking focus.',
    category: 'window',
    featured: true,
  },
  {
    id: 'toggle-layer',
    keys: ['Alt', 'U'],
    label: 'Toggle layer',
    description: 'Switch between compact bullet-cue mode and full detailed answer layout.',
    category: 'window',
    featured: true,
  },
  {
    id: 'lock-reading',
    keys: ['Alt', 'J'],
    label: 'Lock reading',
    description: 'Pause incoming updates so you can finish reading the current talking points.',
    category: 'reading',
    featured: true,
  },
  {
    id: 'reconnect-audio',
    keys: ['Alt', 'R'],
    label: 'Reconnect audio stream',
    description: 'Re-bind system loopback audio if you switch headphones or meeting devices.',
    category: 'reading',
  },
  {
    id: 'auto-scroll',
    keys: ['Alt', 'T'],
    label: 'Teleprompter auto-scroll',
    description: 'Start or pause smooth eye-level pacing for multi-paragraph walkthroughs.',
    category: 'reading',
    featured: true,
  },
  {
    id: 'window-opacity',
    keys: ['Alt', 'Up', '/', 'Alt', 'Down'],
    label: 'Window opacity',
    description: 'Adjust window translucency in 10% increments to match your lighting.',
    category: 'window',
    featured: true,
  },
  {
    id: 'click-through',
    keys: ['Alt', 'M'],
    label: 'Click-through mode',
    description: 'Let mouse clicks pass straight through to your IDE or browser beneath.',
    category: 'window',
  },
  {
    id: 'quit-app',
    keys: ['Alt', 'Q'],
    label: 'Quit app',
    description: 'Cleanly end the active session, save remaining credits, and close Crackpilot.',
    category: 'window',
  },
  {
    id: 'move-window',
    keys: ['Alt', 'Shift', 'Arrows'],
    label: 'Move window',
    description: 'Nudge the floating panel near your webcam lens without touching the mouse.',
    category: 'window',
  },
  {
    id: 'mobile-remote',
    keys: ['Mobile Remote'],
    label: 'QR pairing',
    description: 'Scan the desktop QR code to trigger captures and read answers silently from your phone.',
    category: 'remote',
  },
];
