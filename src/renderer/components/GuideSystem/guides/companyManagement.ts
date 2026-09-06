import { GuideData } from '../types';

export const companyManagementGuide: GuideData = {
  pageId: 'company-management',
  pageTitle: 'Company Management',
  pageDescription: 'Manage companies',
  route: '/companies',
  whatIsThis: 'In Company Management, you define your companies. Each company can have its own inventory, stores, financial years, and users. Multi-company support is available - you can manage more than one company.',
  whenToUse: 'Whenever you need to add a new company, edit an existing company, or set a company logo.',
  prerequisites: [
    'Must have Admin or Company Management permission',
  ],
  sections: [
    {
      title: 'Company Structure',
      icon: 'Business',
      content: 'Every company has:\n- Name: company name\n- Address: physical address\n- Phone: contact number\n- Logo: company logo (optional)\n- Active Status: active or inactive',
    },
  ],
  steps: [
    {
      stepNumber: 1,
      title: 'Click on New Company',
      description: 'Click the "Add Company" button.',
    },
    {
      stepNumber: 2,
      title: 'Enter Company Name',
      description: 'Enter the company name.',
    },
    {
      stepNumber: 3,
      title: 'Fill in Details',
      description: 'Enter address, phone, and other details.',
    },
    {
      stepNumber: 4,
      title: 'Upload Logo (Optional)',
      description: 'Upload a company logo for branding.',
    },
    {
      stepNumber: 5,
      title: 'Save',
      description: 'Click the Save button.',
    },
  ],
  dos: [
    'Enter the correct company name - it appears in receipts and reports',
    'Upload the logo in high quality',
  ],
  donts: [
    'Do not delete an active company - deactivate it',
    'Do not create a new company without careful thought - data will be split',
  ],
  validationRules: [
    { field: 'Name', rule: 'Required, min 1 character, unique' },
    { field: 'Address', rule: 'Optional, string' },
    { field: 'Phone', rule: 'Optional, string' },
  ],
  relatedPages: [
    { title: 'Financial Years', route: '/financial-year' },
    { title: 'Store Master', route: '/enterprise/stores' },
  ],
};
