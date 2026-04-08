// Stub — original deleted during orphan cleanup
export interface ChangelogEntry {
  version: string;
  date: string;
  title: string;
  highlights: string[];
  changes: { type: 'added' | 'improved' | 'fixed' | 'security'; description: string }[];
}
export const CHANGELOG: ChangelogEntry[] = [];
