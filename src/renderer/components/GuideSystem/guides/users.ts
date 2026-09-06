import { GuideData } from '../types';

export const usersGuide: GuideData = {
  pageId: 'users',
  pageTitle: 'Users',
  pageDescription: 'Manage system users',
  route: '/masters/users',
  whatIsThis: 'In Users Master you manage all the system users - create new users, reset passwords, assign roles, deactivate users. Each user has a role (Admin, StoreManager, Viewer) that determines their permissions.',
  whenToUse: 'Whenever you need to add a new user, reset a password, change a role, or deactivate a user.',
  prerequisites: [
    'Must have Admin role',
  ],
  sections: [
    {
      title: 'User Roles',
      icon: 'Shield',
      content: 'There are three roles:\n1. Admin - can do everything, has all permissions\n2. StoreManager - can manage inventory, edit masters\n3. Viewer - can only view, cannot edit anything',
    },
    {
      title: 'Password Policy',
      icon: 'Lock',
      content: 'Default password policy:\n- Minimum 8 characters\n- Uppercase, lowercase, numbers required\n- Expires in 90 days\n- 30 minute lockout after 5 failed attempts',
    },
  ],
  steps: [
    {
      stepNumber: 1,
      title: 'Click on New User',
      description: 'Click the "Add User" button.',
    },
    {
      stepNumber: 2,
      title: 'Enter Username',
      description: 'Enter a unique username (3-50 characters).',
      warning: 'Duplicate usernames are not allowed',
    },
    {
      stepNumber: 3,
      title: 'Enter Full Name',
      description: 'Enter the user full name.',
    },
    {
      stepNumber: 4,
      title: 'Enter Password',
      description: 'Enter a strong password (min 6 characters).',
      tip: 'Use a strong password - include special characters',
    },
    {
      stepNumber: 5,
      title: 'Select Role',
      description: 'Select the role from the dropdown - Admin, StoreManager, or Viewer.',
      warning: 'Select the correct role - permissions are determined by it',
    },
    {
      stepNumber: 6,
      title: 'Save',
      description: 'Click the Save button. The user will be created.',
    },
  ],
  dos: [
    'Enforce strong passwords',
    'Follow the principle of least privilege',
    'Deactivate inactive users immediately',
    'Follow the password expiry policy',
  ],
  donts: [
    'Do not change default Admin credentials without thinking',
    'Do not give Admin role to everyone - it is a risk',
    'Do not create shared accounts - each user should have a separate account',
  ],
  validationRules: [
    { field: 'Username', rule: 'Required, 3-50 characters, unique' },
    { field: 'Password', rule: 'Required, min 6 characters' },
    { field: 'Full Name', rule: 'Required, min 1 character' },
    { field: 'Role', rule: 'Required - Admin / StoreManager / Viewer' },
  ],
  relatedPages: [
    { title: 'Roles & Permissions', route: '/admin/roles' },
    { title: 'Security', route: '/admin/security' },
  ],
};
