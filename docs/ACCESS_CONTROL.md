# Access Control and CEO/ADMIN Role Policy

## Role intent

The platform uses role-based access control and tracks security-relevant changes through the audit log. CEO and ADMIN roles are intentionally powerful because they are used for executive oversight and platform administration.

These roles must be limited to a very small group of trusted administrators. They should not be assigned broadly to regular staff, and every holder should have a strong unique password and enforced MFA where available.

## Required control policy

- CEO and ADMIN can bypass granular permission checks by implementation design, but they must be treated as controlled break-glass accounts.
- Only a small number of accounts should hold these roles.
- Passwords must be unique, strong, and rotated according to the environment policy.
- Any administrative changes made by these roles must be reviewed in the audit log.
- If a CEO or ADMIN account is used for business changes, the audit log should show the actor, the action, the entity, and the before/after values where available.

## Audit logging

The platform writes audit records via the backend audit service for system actions, including user creation, user updates, branch changes, inventory adjustments, sales creation, and stock transfers. This service records the actor ID and change data in the application audit log.

## Review rhythm

- Review CEO and ADMIN accounts at least monthly.
- Remove inactive or unnecessary elevated access immediately.
- Reconfirm password strength and rotation on every major release.
- Require an approval trail for role assignment or permission changes.
