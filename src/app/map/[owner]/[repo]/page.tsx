import { GitHubGraphLoader } from "@/components/map/GitHubGraphLoader";

interface PageProps {
  params: Promise<{ owner: string; repo: string }>;
}

export default async function MapPage({ params }: PageProps) {
  const { owner, repo } = await params;
  return <GitHubGraphLoader owner={owner} repo={repo} />;
}
