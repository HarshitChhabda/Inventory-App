import { GuideData } from '../types';

export const departmentsGuide: GuideData = {
  pageId: 'departments',
  pageTitle: 'Departments',
  pageDescription: 'Define organization departments',
  route: '/masters/departments',
  whatIsThis: 'In Departments, you define the departments of your organization - such as Kitchen, Housekeeping, Maintenance, Office, etc. When an Issue Challan is created, a department is selected to indicate which department the stock is being given to.',
  whenToUse: 'Whenever you need to add a new department. Create departments first, then select them in Issue Challans.',
  prerequisites: [],
  sections: [
    {
      title: 'Department Code',
      icon: 'Code',
      content: 'Each department has an optional code. A code makes it easy to identify the department.',
    },
  ],
  steps: [
    {
      stepNumber: 1,
      title: 'Click on New Department',
      description: 'Click the "Add Department" button.',
    },
    {
      stepNumber: 2,
      title: 'Enter Department Name',
      description: 'Enter the department name (e.g., Kitchen, Housekeeping).',
    },
    {
      stepNumber: 3,
      title: 'Enter Code (Optional)',
      description: 'Enter a short code (e.g., KTC, HSK).',
    },
    {
      stepNumber: 4,
      title: 'Save',
      description: 'Click the Save button.',
    },
  ],
  dos: [
    'Keep department names descriptive',
    'Maintain a consistent code system',
  ],
  donts: [
    'Do not create very similar departments',
    'Do not delete inactive departments',
  ],
  validationRules: [
    { field: 'Name', rule: 'Required, min 1 character' },
    { field: 'Code', rule: 'Optional, string' },
  ],
  relatedPages: [
    { title: 'Issue Challan', route: '/inventory/issue-challan' },
    { title: 'Store Master', route: '/enterprise/stores' },
  ],
};
