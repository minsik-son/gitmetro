import type { BranchLine, CommitNode, GitMetroGraph } from "@/types/gitmetro";

const BRANCHES: BranchLine[] = [
  { id: "main", name: "main", category: "main", lane: 0, color: "#ff5b5b", isDefault: true },
  { id: "hotfix", name: "hotfix/login", category: "hotfix", lane: -1, color: "#ff9f43" },
  { id: "develop", name: "develop", category: "develop", lane: -2, color: "#f3d54e" },
  { id: "featureB", name: "feature/wallet", category: "feature", lane: -3, color: "#3dd68c" },
  { id: "featureA", name: "feature/auth", category: "feature", lane: -4, color: "#3ddbd9" },
  { id: "release", name: "release/2.4", category: "release", lane: -5, color: "#4aa3ff" },
];

interface CommitOpts {
  parents?: string[];
  message?: string;
  author?: string;
  avatar?: string;
  date?: string;
  files?: number;
  isMerge?: boolean;
  isHead?: boolean;
  isTag?: boolean;
  tag?: string;
  pr?: string;
}

function commit(sha: string, branch: string, t: number, opts: CommitOpts = {}): CommitNode {
  return {
    sha,
    shortSha: sha.slice(0, 7),
    branch,
    t,
    parents: opts.parents ?? [],
    message: opts.message ?? "",
    author: opts.author ?? "sora.lim",
    avatar: opts.avatar ?? "SL",
    date: opts.date ?? "2026-04-12 09:14",
    files: opts.files ?? 3,
    isMerge: !!opts.isMerge,
    isHead: !!opts.isHead,
    isTag: !!opts.isTag,
    tag: opts.tag,
    pr: opts.pr,
  };
}

const COMMITS: CommitNode[] = [
  commit("a1b2c30", "main", 0, {
    message: "chore: bootstrap monorepo",
    author: "sora.lim",
    avatar: "SL",
    date: "2026-02-04 11:02",
    files: 142,
  }),
  commit("55cd431", "main", 1, {
    message: "feat: scaffold payments service",
    parents: ["a1b2c30"],
    author: "haru.kang",
    avatar: "HK",
    date: "2026-02-09 14:33",
    files: 27,
  }),
  commit("17086c2", "develop", 2, {
    message: "chore: enable strict TS",
    parents: ["55cd431"],
    author: "jin.park",
    avatar: "JP",
    date: "2026-02-11 09:48",
    files: 6,
  }),
  commit("e5c1860", "featureA", 3, {
    message: "feat(auth): WebAuthn scaffolding",
    parents: ["17086c2"],
    author: "mira.cho",
    avatar: "MC",
    date: "2026-02-15 16:21",
    files: 9,
    pr: "#412",
  }),
  commit("4c18d65", "hotfix", 2, {
    message: "fix(login): session token refresh",
    parents: ["55cd431"],
    author: "haru.kang",
    avatar: "HK",
    date: "2026-02-12 23:11",
    files: 2,
    pr: "#418",
  }),
  commit("6014c24", "featureB", 4, {
    message: "feat(wallet): balance API stub",
    parents: ["17086c2"],
    author: "sora.lim",
    avatar: "SL",
    date: "2026-02-22 10:05",
    files: 5,
  }),
  commit("a8d29f1", "hotfix", 4, {
    message: "fix(login): clamp retry backoff",
    parents: ["4c18d65"],
    author: "haru.kang",
    avatar: "HK",
    date: "2026-02-24 18:40",
    files: 1,
  }),
  commit("0245109", "featureA", 6, {
    message: "feat(auth): passkey enrollment UI",
    parents: ["e5c1860"],
    author: "mira.cho",
    avatar: "MC",
    date: "2026-03-02 13:20",
    files: 14,
  }),
  commit("m1abc01", "main", 5, {
    message: "Merge branch 'hotfix/login'",
    parents: ["55cd431", "a8d29f1"],
    author: "sora.lim",
    avatar: "SL",
    date: "2026-02-26 09:00",
    files: 3,
    isMerge: true,
  }),
  commit("df30b6c", "featureB", 7, {
    message: "feat(wallet): ledger entry model",
    parents: ["6014c24"],
    author: "sora.lim",
    avatar: "SL",
    date: "2026-03-08 17:11",
    files: 11,
    pr: "#447",
  }),
  commit("b40fa1d", "featureA", 8, {
    message: "test(auth): passkey e2e",
    parents: ["0245109"],
    author: "mira.cho",
    avatar: "MC",
    date: "2026-03-12 11:55",
    files: 4,
  }),
  commit("e4f5ad1", "featureB", 9, {
    message: "feat(wallet): list view",
    parents: ["df30b6c"],
    author: "sora.lim",
    avatar: "SL",
    date: "2026-03-16 14:42",
    files: 8,
  }),
  commit("m2def02", "develop", 10, {
    message: "Merge feature/auth into develop",
    parents: ["17086c2", "b40fa1d"],
    author: "jin.park",
    avatar: "JP",
    date: "2026-03-19 10:30",
    files: 18,
    isMerge: true,
    pr: "#451",
  }),
  commit("m3ef0a3", "develop", 11, {
    message: "Merge feature/wallet into develop",
    parents: ["m2def02", "e4f5ad1"],
    author: "jin.park",
    avatar: "JP",
    date: "2026-03-23 16:08",
    files: 22,
    isMerge: true,
    pr: "#458",
  }),
  commit("17dffb5", "release", 12, {
    message: "chore(release): cut 2.4.0-rc.1",
    parents: ["m3ef0a3"],
    author: "jin.park",
    avatar: "JP",
    date: "2026-03-26 09:00",
    files: 3,
    isTag: true,
    tag: "v2.4.0-rc.1",
  }),
  commit("c8b09a4", "develop", 13, {
    message: "docs: contributing guide",
    parents: ["m3ef0a3"],
    author: "mira.cho",
    avatar: "MC",
    date: "2026-03-28 11:20",
    files: 1,
  }),
  commit("38b75cb", "release", 14, {
    message: "fix(release): currency formatter",
    parents: ["17dffb5"],
    author: "haru.kang",
    avatar: "HK",
    date: "2026-04-02 15:42",
    files: 2,
  }),
  commit("fa9cdef", "main", 15, {
    message: "Merge branch 'release/2.4' into main",
    parents: ["m1abc01", "38b75cb"],
    author: "sora.lim",
    avatar: "SL",
    date: "2026-04-08 10:00",
    files: 24,
    isMerge: true,
    isTag: true,
    tag: "v2.4.0",
    isHead: true,
  }),
  commit("d99aa12", "develop", 15, {
    message: "feat(api): pagination cursors",
    parents: ["c8b09a4"],
    author: "jin.park",
    avatar: "JP",
    date: "2026-04-10 09:14",
    files: 7,
    isHead: true,
  }),
];

export const MOCK_GRAPH: GitMetroGraph = {
  repo: {
    owner: "lumen-labs",
    name: "lumen-pay",
    fullName: "lumen-labs/lumen-pay",
    description: "Payments + wallet platform for Lumen Labs.",
    stars: 2841,
    forks: 184,
    defaultBranch: "main",
    lastSync: "2026-05-01 09:42",
    commitsTotal: 1284,
    branchesTotal: 23,
    contributors: 14,
  },
  branches: BRANCHES,
  commits: COMMITS,
};
