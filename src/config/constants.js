// ============================================================================
// MYSTIC VAULT CONFIGURATION FILE
// ============================================================================
// Edit the values below to customize the game experience, including Supabase
// credentials, puzzle configuration, maze sizes, difficulty settings, etc.
// ============================================================================

/** 
 * SUPABASE CREDENTIALS 
 * Ensure these match your actual Supabase project. 
 */
export const SUPABASE_URL  = 'https://xwyyquoetdtrifodtoqj.supabase.co';
export const SUPABASE_ANON = 'sb_publishable_XR6q16NFXEhKV8TZMTUjFw_tu9s8wlS';

/**
 * DIFFICULTY MAPPING
 * Used to translate difficulty levels stored in the DB (1, 2, 3) to strings.
 */
export const DIFFICULTY_MAP         = { 1: 'easy', 2: 'medium', 3: 'hard' };
export const DIFFICULTY_REVERSE_MAP = { easy: 1, medium: 2, hard: 3 };

/**
 * DEFAULT VAULT FRAGMENTS
 * Used as a fallback if the team does not have them set in the database.
 */
export const DEFAULT_FRAGMENTS = ['ORION', 'X17', 'OMEGA'];

/**
 * GAME CONFIGURATION AND PUZZLES
 * Settings for riddles, cipher tests, maze properties, and system recovery.
 */
export const DEFAULT_CONFIG = {
  difficulty: 'medium', // Default difficulty
  fragments: ['ORION', 'X17', 'OMEGA'],

  // Round 1 — Cipher Gate
  r1Puzzles: [
    { id: 0, label: 'Cipher 1',       encrypted: 'YDXOW',        hint: 'Caesar Cipher (shift 3)',                answer: 'VAULT'    },
    { id: 1, label: 'Cipher 2',       encrypted: 'FRGH',         hint: 'Caesar Cipher (shift 3)',                answer: 'CODE'     },
    { id: 2, label: 'Scrambled Word', encrypted: 'C-I-P-H-E-R',  hint: 'Unscramble: RPIEHC',                    answer: 'CIPHER'   },
    { id: 3, label: 'Hidden Message', encrypted: 'T_K_ TH_ K_Y', hint: 'Fill in the vowels (E, A, E)',          answer: 'TAKE THE KEY' },
    { id: 4, label: 'Pattern',        encrypted: '1-4-9-16-?',   hint: 'Square numbers. What comes next?',      answer: '25'       },
    { id: 5, label: 'Riddle',         encrypted: 'I have keys but no locks. I have space but no room. You can enter but cannot go inside. What am I?', hint: 'Think about a computer peripheral', answer: 'KEYBOARD' },
    { id: 6, label: 'Logic',          encrypted: 'If HACK = 8-1-3-11, what does LOCK equal?', hint: 'A=1, B=2, C=3...', answer: '12-15-3-11' },
    { id: 7, label: 'CTF — Source Code', encrypted: '<!-- FLAG: SHADOW -->', hint: 'Check the HTML source code (F12 → Elements → head tag)', answer: 'SHADOW' },
    { id: 8, label: 'CTF — Image Metadata', encrypted: '[[IMAGE_CTF]]', hint: 'Download the image and inspect its metadata using an online tool', answer: 'NEXUS' },
  ],

  // Round 2 settings (Maze Dimensions - Columns x Rows)
  r2Level1MazeSize: [15, 11],
  r2Level2MazeSize: [13, 9],

  // Round 3 — System Reconstruction
  r3Scrambled: ['EDEXCRPYT', 'VOERDRI', 'ETXECU', 'TINI'],
  r3Correct:   ['DECRYPT',   'OVERRIDE', 'EXECUTE', 'INIT'],
  r3Decoys:    ['DELETE'],                          // commands to identify & remove
  r3Sequence:  ['INIT', 'DECRYPT', 'OVERRIDE', 'EXECUTE'],
  r3Clue: '"The system must begin with initialization and end with execution."',
  r3DecoyCue: '"Not all commands belong to the recovery protocol."',

  // Final Vault — transformation rule
  finalInstruction: 'Shift the first fragment by +1 letter, reverse the numeric code, and keep the last fragment unchanged.',
  finalAnswer: 'PSJPO-71X-OMEGA',   // pre-computed; admin can override
};

/**
 * DIFFICULTY PRESETS
 * Control the length of tasks, visibility inside mazes, and total puzzles shown per difficulty class.
 */
export const DIFFICULTY_SETTINGS = {
  easy:   { r1Count: 6, r3SeqLen: 3, bossSeqLen: 3, mazeSize: [13, 9],  visibility: 4, label: 'Easy'   },
  medium: { r1Count: 8, r3SeqLen: 4, bossSeqLen: 4, mazeSize: [19, 15], visibility: 3, label: 'Medium' },
  hard:   { r1Count: 9, r3SeqLen: 4, bossSeqLen: 5, mazeSize: [25, 19], visibility: 2, label: 'Hard'   },
};
