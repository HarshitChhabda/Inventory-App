import { GuideData } from '../types';

export const storeMasterGuide: GuideData = {
  pageId: 'store-master',
  pageTitle: 'Store Master',
  pageDescription: 'Manage warehouses and stores',
  route: '/enterprise/stores',
  whatIsThis: 'In Store Master, you manage your warehouses, department stores, and dharamshala stores. This is the most important master data in the system because the Store holds all ownership. Stock is always at the Store level - Rooms and Department Locations only hold installed assets.',
  whenToUse: 'Whenever you need to create a new store, edit an existing store, or view the store hierarchy. Create the Main Store first, then department and dharamshala stores.',
  prerequisites: [
    'Company setup must be done',
    'Financial Year must be active',
    'Must have Admin or StoreManager role',
  ],
  sections: [
    {
      title: 'Store Types',
      icon: 'Warehouse',
      content: 'There are three types of stores:\n1. MAIN_STORE - Main Warehouse where all stock is held\n2. DEPARTMENT_STORE - Small department-wise store\n3. DHARMSHALA_STORE - Separate store for dharamshala',
    },
    {
      title: 'Ownership Model',
      icon: 'AccountBalance',
      content: 'Rule: Stores own all inventory. Rooms and Department Locations only hold installed assets. Ownership always remains with the Store. Stock entries are made only at the Store level.',
    },
    {
      title: 'Parent Store System',
      icon: 'AccountTree',
      content: 'A store can have a parent store (hierarchy). The Main Store is generally the parent of all. The Department Store has the Main Store as its parent. The Dharamshala Store can also be under the Main Store.',
    },
  ],
  steps: [
    {
      stepNumber: 1,
      title: 'Choose Store Type',
      description: 'First decide what type of store it is - Main, Department, or Dharamshala.',
      tip: 'Every company has one Main Store',
    },
    {
      stepNumber: 2,
      title: 'Enter Store Name',
      description: 'Enter a unique store name. Duplicate names are not allowed in the same company.',
      warning: 'Avoid special characters in the name',
    },
    {
      stepNumber: 3,
      title: 'Assign Code',
      description: 'Enter a short code for the store (e.g., MS01, DS01). This is optional but helpful.',
      tip: 'A code makes it easy to identify the store',
    },
    {
      stepNumber: 4,
      title: 'Select Parent Store',
      description: 'If the store is under another store, select the parent. Leave blank for the Main Store.',
    },
    {
      stepNumber: 5,
      title: 'Save',
      description: 'Click the Save button. The store will be successfully created.',
    },
  ],
  dos: [
    'Create the Main Store first, then Department/Dharamshala stores',
    'Keep the store name descriptive (e.g., "Jaipur Main Warehouse")',
    'Maintain a consistent code system (e.g., MS01, MS02, DS01)',
    'Properly assign the parent store for hierarchy',
  ],
  donts: [
    'Do not create duplicate store names in the same company',
    'Do not make a store its own parent',
    'Do not delete stores that have locations or assets',
    'Do not delete stores that have child stores',
    'Do not put stock directly on a store - it goes through the ledger',
  ],
  validationRules: [
    { field: 'Store Name', rule: 'Required, unique per company' },
    { field: 'Store Type', rule: 'Required - MAIN_STORE / DEPARTMENT_STORE / DHARMSHALA_STORE' },
    { field: 'Parent Store', rule: 'Optional, must belong to same company, cannot be self' },
    { field: 'Code', rule: 'Optional, string' },
  ],
  relatedPages: [
    { title: 'Store Stock', route: '/enterprise/stock' },
    { title: 'Locations', route: '/masters/locations' },
    { title: 'Configuration', route: '/enterprise/configuration' },
  ],
};
