import { RELEASE_FEED } from "@apx/protocol";

/** Only explicit local adoption hands a release feed to the running desktop. */
export function adoptionData(argv: readonly string[], env: NodeJS.ProcessEnv) {
  const feed = releaseFeed({ releaseFeed: env.APX_RELEASES || RELEASE_FEED || "off" });
  return argv.includes("--apx-adopt-local") && feed !== undefined ? { releaseFeed: feed } : {};
}

function releaseFeed(data: unknown): string | undefined {
  if (!data || typeof data !== "object" || !("releaseFeed" in data)) return;
  const feed = data.releaseFeed;
  if (typeof feed !== "string" || !feed || feed.length > 4096 || /[\s\p{Cc}]/u.test(feed)) return;
  if (feed === "off" || /^[\w.-]+\/[\w.-]+$/.test(feed)) return feed;
  try {
    const url = new URL(feed);
    if (url.protocol === "https:" || url.protocol === "http:") return feed;
  } catch {
    return;
  }
}

export function secondInstance(opts: {
  env: NodeJS.ProcessEnv;
  openedConnection: string;
  connection(): string;
  relaunch(): void;
  openFiles(argv: string[]): void;
  focus(): void;
}) {
  let restarting = false;
  return (_event: unknown, argv: string[], _cwd: string, data: unknown) => {
    if (restarting) return;
    const adopt = argv.includes("--apx-adopt-local");
    const feed = adopt ? releaseFeed(data) : undefined;
    const feedChanged = feed !== undefined && feed !== (opts.env.APX_RELEASES || RELEASE_FEED || "off");
    const connectionChanged = adopt && opts.connection() !== opts.openedConnection;
    if (feedChanged || connectionChanged) {
      restarting = true;
      if (feed !== undefined) opts.env.APX_RELEASES = feed;
      if (connectionChanged) {
        delete opts.env.APX_HOME;
        delete opts.env.APX_PORT;
        delete opts.env.APX_URL;
        delete opts.env.APX_TOKEN;
      }
      opts.relaunch();
      return;
    }
    opts.openFiles(argv);
    opts.focus();
  };
}
