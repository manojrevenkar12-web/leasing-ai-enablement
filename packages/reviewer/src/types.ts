import type { FileDiff } from './diff.js';

export type Severity = 'blocker' | 'major' | 'minor';

export interface ChangedFile {
  diff: FileDiff;
  /** full content after the change (null for deleted files) */
  after: string | null;
}

export interface ReviewInput {
  title: string;
  description: string;
  files: ChangedFile[];
  /** every path in the repository after the change, for rules that need to know siblings */
  repoFiles?: string[];
}

export interface Finding {
  file: string;
  line: number;
  category: string;
  severity: Severity;
  message: string;
  /** the code the comment is about, quoted from the line */
  evidence: string;
  confidence: number;
  source: 'rule' | 'model';
  rule?: string;
}

/** A note about the whole PR (no line), e.g. "no test changed". Never an inline comment. */
export interface Note {
  category: string;
  message: string;
  rule: string;
}

export interface Dropped {
  finding: Finding;
  reason: 'not-in-diff' | 'evidence-mismatch' | 'duplicate' | 'low-confidence' | 'over-limit';
}

export interface ReviewConfig {
  commentMustCiteChangedLine: boolean;
  maxComments: number;
  minConfidence: number;
}

export interface ReviewResult {
  comments: Finding[];
  notes: Note[];
  dropped: Dropped[];
  model: { provider: string; calls: number } | null;
}
