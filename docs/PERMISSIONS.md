# Route-level permission matrix

A role assignment is `(membership, factory, department, role)`. Departments never combine across factories. Main Admin can access all factories within the tenant, but cannot bypass business invariants. Platform support identities and their time-limited grants are not implemented.

## Implemented routes

| Resource/action      | Actor                                               | Scope / fields                                                                      | Denial                                                                     |
| -------------------- | --------------------------------------------------- | ----------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| Login                | Credentials verified against selected business slug | Email/password; opaque HttpOnly session; no password hash returned                  | Invalid, disabled or wrong-tenant credentials: 401; repeated attempts: 429 |
| Session/me           | Active membership and unexpired stored session      | Current actor and CSRF token                                                        | Disabled/forged/expired: 401                                               |
| Factories/list       | Active member                                       | Main Admin: tenant factories; employee: factories with exact assignments; first 100 | Unauthenticated: 401; unassigned: empty list                               |
| Notes/view or create | Main Admin or assigned staff/head                   | Exact tenant + factory + department; body max 1000, latest 50 notes                 | Other tenant: 404; wrong factory/department combination: 403               |
| Membership/disable   | Main Admin                                          | Same tenant; last active Main Admin protected                                       | Employee: 403; foreign target: 404; last admin: 409                        |
| Logout               | Active session + CSRF                               | Revoke current stored session and audit                                             | Missing CSRF/origin: 403                                                   |

All state-changing routes enforce exact Origin and CSRF (login uses Origin + JSON body). Session and factory reads use no-store. Query cache is cleared on logout/re-login and note scope change. Notes are development coordination text, not stock/production postings. Role templates have identical note-only rights at this foundation stage; approval/posting permissions are not implemented.

## Planned business permission vocabulary

`view`, `create`, `edit_draft`, `submit`, `approve`, `post`, `receive`, `reverse`, `export` must remain distinct. Department heads approve only where configured. Cross-department approved-data views, maker/checker separation, attachments, exports, jobs and imports need their own allow/deny tests before exposure.

Invitations, account recovery, Main Admin MFA and UI management of scoped role assignments are still pending. Existing accounts/assignments for tests are synthetic and created only through controlled database fixtures. Initial customer Main Admin is provisioned via a migration-owner CLI; employees will set their own passwords through the future invitation flow.
