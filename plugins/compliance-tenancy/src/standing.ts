/**
 * Which composition a user's backend should have, by their newest login.
 *
 * Administrative standing is decided per gateway session, at login. A user can
 * hold several sessions at once (two browsers, or a tab that predates a role
 * change), each carrying the standing of its own login. Letting every request
 * pick the composition would restart the backend each time two such sessions
 * alternated. The newest login wins instead: a role granted or revoked takes
 * effect at the user's next login, and older sessions follow it.
 */
export class RoleStanding {
  private readonly newest = new Map<string, { readonly admin: boolean; readonly at: number }>()

  /**
   * Record one request's standing, and say what the user's backend should be.
   * @param subject - the user's stable key.
   * @param admin - whether this request's session is administrative.
   * @param authenticatedAt - when this session's login completed; absent counts as the oldest.
   * @returns whether the backend should run the administrative composition.
   */
  resolve(subject: string, admin: boolean, authenticatedAt: number | undefined): boolean {
    const at = authenticatedAt ?? 0
    const known = this.newest.get(subject)
    if (known === undefined || at >= known.at) {
      this.newest.set(subject, { admin, at })
      return admin
    }
    return known.admin
  }
}
