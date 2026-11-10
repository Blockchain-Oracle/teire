import { RunCancelledError } from "../cancel";
import {
  type CacheRecord,
  CloudflareSandbox,
  type EgressEvent,
  type InstanceType,
  type JobResult,
  sandboxConfigFromEnv,
} from "./cloudflare";

/**
 * Where checks run (card C5, D41/D49): Teire's own sandbox on Cloudflare Containers, one image per
 * toolchain set; the run names its backend.
 */
export interface VerifySession {
  readonly id: string;
  setPhase(phase: "install" | "check"): Promise<void>;
  run(
    jobId: string,
    argv: string[],
    options: {
      cwd?: string;
      env?: Record<string, string>;
      timeoutSec?: number;
      /** The command's output as it is written, where the backend streams it. */
      onLog?: (chunk: string) => void;
    },
  ): Promise<JobResult>;
  readFile(path: string): Promise<Uint8Array | null>;
  writeFile(path: string, content: Uint8Array): Promise<void>;
  egress(): Promise<EgressEvent[]>;
  close(): Promise<void>;
  /** Cloudflare only (R21.11): the download cache saved to and restored from R2. */
  depCache?: {
    save(dir: string, name: string): Promise<{ record: CacheRecord; ms: number }>;
    restore(record: CacheRecord): Promise<{ ms: number }>;
    remove(record: CacheRecord): Promise<void>;
  };
}

export interface VerifyBackend {
  readonly name: "cloudflare";
  open(
    id: string,
    options: {
      tarball: { url: string; token?: string };
      instance?: InstanceType;
      image?: string;
      /** Private registries' hosts and the header their credential sends, added at egress (S18.7). */
      registries?: { host: string; authorization: string }[];
    },
  ): Promise<VerifySession>;
}

/**
 * The backend with this repo's private registries on every session it opens (S18.7): the sandbox
 * adds each credential's header to install-phase requests for its host, outside the container, so
 * the repository's code and its scripts never see it.
 */
export function withRegistries(
  backend: VerifyBackend,
  registries: { host: string; authorization: string }[],
): VerifyBackend {
  if (!registries.length) return backend;
  return { ...backend, open: (id, options) => backend.open(id, { ...options, registries }) };
}

/**
 * A backend whose sessions stop when the run is cancelled (U1, "Cancel is honest"): every open
 * session is closed at once (a Cloudflare sandbox is
 * destroyed), and any later call on it, or a new session, throws `RunCancelledError`.
 */
export function cancellableBackend(backend: VerifyBackend, signal: AbortSignal): VerifyBackend {
  const sessions = new Set<VerifySession>();
  signal.addEventListener(
    "abort",
    () => {
      for (const s of sessions) void s.close().catch(() => undefined);
      sessions.clear();
    },
    { once: true },
  );
  const check = () => {
    if (signal.aborted) throw new RunCancelledError();
  };
  return {
    name: backend.name,
    async open(id, options) {
      check();
      const session = await backend.open(id, options);
      if (signal.aborted) {
        await session.close().catch(() => undefined);
        throw new RunCancelledError();
      }
      sessions.add(session);
      const guarded = async <T>(work: () => Promise<T>) => {
        check();
        const result = await work();
        check();
        return result;
      };
      return {
        id: session.id,
        setPhase: (phase) => guarded(() => session.setPhase(phase)),
        run: (jobId, argv, opts) => guarded(() => session.run(jobId, argv, opts)),
        readFile: (path) => guarded(() => session.readFile(path)),
        writeFile: (path, content) => guarded(() => session.writeFile(path, content)),
        egress: () => session.egress(),
        ...(session.depCache
          ? {
              depCache: {
                save: (dir: string, name: string) =>
                  guarded(() => (session.depCache as NonNullable<VerifySession["depCache"]>).save(dir, name)),
                restore: (record: CacheRecord) =>
                  guarded(() => (session.depCache as NonNullable<VerifySession["depCache"]>).restore(record)),
                remove: (record: CacheRecord) =>
                  guarded(() => (session.depCache as NonNullable<VerifySession["depCache"]>).remove(record)),
              },
            }
          : {}),
        close: async () => {
          sessions.delete(session);
          await session.close();
        },
      };
    },
  };
}

export function cloudflareBackend(config = sandboxConfigFromEnv()): VerifyBackend {
  return {
    name: "cloudflare",
    async open(id, options) {
      const sandbox = new CloudflareSandbox(config, id);
      await sandbox.start({
        instance: options.instance ?? "standard-2",
        tarball: options.tarball,
        ...(options.image ? { image: options.image } : {}),
        ...(options.registries?.length ? { registries: options.registries } : {}),
      });
      return {
        id,
        setPhase: async (phase) => {
          await sandbox.setPhase(phase);
        },
        run: (jobId, argv, opts) => sandbox.runJob(jobId, argv, opts),
        readFile: async (path) => {
          try {
            return await sandbox.readFile(path);
          } catch {
            return null;
          }
        },
        writeFile: async (path, content) => {
          await sandbox.writeFile(path, content);
        },
        egress: () => sandbox.egress(),
        depCache: {
          save: (dir, name) => sandbox.saveCache(name, dir),
          restore: (record) => sandbox.restoreCache(record),
          remove: async (record) => {
            await sandbox.deleteCache(record);
          },
        },
        close: async () => {
          await sandbox.destroy().catch(() => undefined);
        },
      };
    },
  };
}

/** The backend a run uses, and why: Teire's own Cloudflare sandbox, for every repository. */
export async function selectBackend(env: NodeJS.ProcessEnv = process.env) {
  return {
    backend: cloudflareBackend(sandboxConfigFromEnv(env)),
    note: "Cloudflare Containers (Teire's sandbox)",
  };
}
