import { GuideData } from '../types';

export const securityGuide: GuideData = {
  pageId: 'security',
  pageTitle: 'Security & Access Control',
  pageDescription: 'Password policy, active sessions, and account management',
  route: '/admin/security',
  whatIsThis: 'From the Security page you can set password rules, view active sessions, and lock/unlock user accounts. This is important for system security.',
  whenToUse: 'When you need to update the password policy, view a user\'s session, or lock/unlock an account. Also useful for security incidents.',
  prerequisites: ['Login is required', 'Settings:edit permission is required'],
  sections: [
    { title: 'Password Policy', icon: 'Lock', content: 'Set password rules - minimum length, uppercase/lowercase/numbers/special characters, expiry days, max failed attempts, lockout duration, session timeout, and password history.' },
    { title: 'Active Sessions', icon: 'People', content: 'Shows all active login sessions. Who is logged in, from where, when they logged in, and when they were last active. You can also force logout.' },
    { title: 'Account Management', icon: 'Shield', content: 'You can lock or unlock user accounts. You can also force logout - if there is a suspicious login.' },
  ],
  steps: [
    { stepNumber: 1, title: 'Update Password Policy', description: 'Go to the Password Policy tab and set the rules. Click the "Save Policy" button.', tip: 'Keep minimum 8 characters and always include special characters.' },
    { stepNumber: 2, title: 'View Active Sessions', description: 'In the Active Sessions tab, all logged-in users will be displayed. Click the red button for force logout.' },
    { stepNumber: 3, title: 'Account Lock/Unlock', description: 'In the Account Management tab, enter the User ID and click the Lock/Unlock button.' },
  ],
  dos: ['Maintain a strong password policy', 'Check active sessions regularly', 'Lock suspicious accounts immediately'],
  donts: ['Do not make the password policy too strict - users will be frustrated', 'Do not lock accounts without reason'],
  validationRules: [
    { field: 'minPasswordLength', rule: 'Minimum 8 characters', example: '8' },
    { field: 'maxFailedAttempts', rule: 'Between 3 and 10', example: '5' },
    { field: 'lockoutDurationMinutes', rule: '5 to 60 minutes', example: '30' },
  ],
  relatedPages: [
    { title: 'Roles & Permissions', route: '/admin/roles' },
    { title: 'Audit Logs', route: '/admin/audit' },
  ],
};
