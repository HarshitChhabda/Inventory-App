import { GuideData } from '../types';

export const rolesGuide: GuideData = {
  pageId: 'roles',
  pageTitle: 'Roles & Permissions',
  pageDescription: 'Configure user roles and their permissions',
  route: '/admin/roles',
  whatIsThis: 'On the Roles & Permissions page you define what each user can do. Each role has different permissions - which pages can be accessed, which tasks can be performed. This is essential for system security.',
  whenToUse: 'Whenever you need to create a new role, change permissions of an existing role, or assign a role to a user.',
  prerequisites: [
    'Admin role is required',
    'User create permission (user:create) is required',
  ],
  sections: [
    {
      title: 'Default Roles',
      icon: 'Shield',
      content: 'There are three default roles:\n1. Admin - can do everything\n2. StoreManager - can manage inventory\n3. Viewer - can only view',
    },
    {
      title: 'Permissions',
      icon: 'Lock',
      content: 'Each permission is a specific task:\n- manage_masters: edit items, categories, etc.\n- manage_users: create and manage users\n- manage_settings: change configuration\n- audit:view: view audit logs\n- transaction:create: create new transactions',
    },
  ],
  steps: [
    {
      stepNumber: 1,
      title: 'Select Role',
      description: 'Select an existing role or create a new one.',
    },
    {
      stepNumber: 2,
      title: 'Toggle Permissions',
      description: 'Toggle on the permissions you want to grant.',
      warning: 'Only grant necessary permissions - least privilege principle',
    },
    {
      stepNumber: 3,
      title: 'Save',
      description: 'Click the Save button. Permissions will be updated.',
    },
  ],
  dos: [
    'Follow the least privilege principle',
    'Grant Admin role to limited users only',
    'Audit permissions regularly',
  ],
  donts: [
    'Do not give Admin role to everyone - it is a security risk',
    'Do not grant unused permissions',
    'Do not change permissions without careful consideration',
  ],
  validationRules: [
    { field: 'Role Name', rule: 'Required, min 1 character, unique' },
    { field: 'Description', rule: 'Optional, string' },
    { field: 'Permissions', rule: 'Array of permission strings' },
  ],
  relatedPages: [
    { title: 'Users', route: '/masters/users' },
    { title: 'Security', route: '/admin/security' },
    { title: 'Audit Logs', route: '/admin/audit' },
  ],
};
