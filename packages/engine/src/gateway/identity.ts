import { END_USERS } from "../constants";

/**
 * Who an Otari call is billed to: an end user of the service key, sent as `user`, with the dashboard
 * budget it starts on (by name; resolved to Otari's id once per process). Ids are stable per person
 * and installation, never per request: every new id creates an end user on Otari.
 */
export interface EndUser {
  id: string;
  budget: string;
}

export const endUsers = {
  /** A signed-in person, by GitHub account id (Better Auth's `account.account_id`): Ask Teire, public scans, dry runs. */
  person: (githubAccountId: string | number): EndUser => ({
    id: `${END_USERS.person.prefix}${githubAccountId}`,
    budget: END_USERS.person.budget,
  }),
  /** An installation of the GitHub App: its scans, fix runs, CI repairs and re-verifies. */
  installation: (installationId: string | number): EndUser => ({
    id: `${END_USERS.installation.prefix}${installationId}`,
    budget: END_USERS.installation.budget,
  }),
  /** The operator's scripted walk on production. */
  operator: { id: END_USERS.operator.id, budget: END_USERS.operator.budget } as EndUser,
  /** Shared catalog reading (release notes, provider pages): cached once for everyone, owned by nobody. */
  catalog: { id: END_USERS.catalog.id, budget: END_USERS.catalog.budget } as EndUser,
};

/** How a receipt names who paid: a person, an installation, Teire's shared reading, or the service itself. */
export function billedTo(id: string | null): string {
  if (!id) return "service";
  if (id.startsWith(END_USERS.person.prefix)) return "person";
  if (id.startsWith(END_USERS.installation.prefix)) return "installation";
  return id;
}
