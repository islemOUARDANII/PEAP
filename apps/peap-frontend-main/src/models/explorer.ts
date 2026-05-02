export interface ExplorerRow {
  id: string;
  label: string;
  sub: string;
  score: string;
}

export interface DataExplorerDataset {
  candidates: ExplorerRow[];
  jobs: ExplorerRow[];
  pipeline: ExplorerRow[];
  matches: ExplorerRow[];
  taxonomy: ExplorerRow[];
}
