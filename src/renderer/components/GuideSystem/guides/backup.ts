import { GuideData } from '../types';

export const backupGuide: GuideData = {
  pageId: 'backup',
  pageTitle: 'Backup & Restore',
  pageDescription: 'Data backup, restore, and stock import',
  route: '/backup',
  whatIsThis: 'On the Backup page you can take a backup of your inventory, restore it, and import opening stock. There are 3 tabs: Database Backups, Import Templates, and Room Stock Import.',
  whenToUse: 'Take regular backups (weekly recommended). Take a backup before major changes. Use Room Stock Import to fill opening stock.',
  prerequisites: [
    'Admin or Backup permission is required',
    'For opening stock import, items must already be created in Item Master',
  ],
  sections: [
    {
      title: 'Tab 1: Database Backups',
      icon: 'Backup',
      content: 'From here you can take manual backups and restore previous backups.\n- "Create Backup" will create a new backup\n- "Complete Excel Backup" will export all data to Excel\n- The list shows all backups with type (hourly/daily/weekly/monthly/yearly)\n- Use the Restore button to restore any backup',
    },
    {
      title: 'Tab 2: Import Templates',
      icon: 'Description',
      content: 'From here you can download Excel templates for any table.\n- Each table has its own template (Items, Units, Vendors, etc.)\n- Download the template, fill it in Excel, then upload it\n- The system will automatically create new records and update existing ones',
    },
    {
      title: 'Tab 3: Room Stock Import',
      icon: 'HomeWork',
      content: 'This is the best way to fill opening stock.\n- Download the template with all stores/units as reference\n- Fill in Store, Room, Item Code, Qty, Rate in Excel\n- Upload it - stock will be imported\n- You can also undo (within last 10 minutes)\n- Import history is also shown with per-row delete',
    },
  ],
  steps: [
    {
      stepNumber: 1,
      title: 'Take a Backup First',
      description: 'Take a backup before importing - use the "Create Backup" button.',
      tip: 'Save the backup in a safe location',
    },
    {
      stepNumber: 2,
      title: 'Go to Room Stock Import Tab',
      description: 'Select the "Room Stock Import" tab.',
    },
    {
      stepNumber: 3,
      title: 'Download Template',
      description: 'Click the "Download Template" button to download the Excel file. It will contain lists of all stores and units.',
    },
    {
      stepNumber: 4,
      title: 'Fill Data in Excel',
      description: 'In the Excel file, fill in each row: Store/Department, Room/Location, Item Code, Unit, Qty, Rate, Date, Status.',
      warning: 'Items must already exist in Item Master - import will only fill stock qty and rate',
    },
    {
      stepNumber: 5,
      title: 'Upload',
      description: 'Upload the filled Excel file. The system will automatically match items and create stock entries.',
    },
    {
      stepNumber: 6,
      title: 'Verify',
      description: 'After import, check the Stock Ledger to verify that stock was imported correctly.',
    },
  ],
  dos: [
    'Take weekly backups - make it a habit',
    'Always take a backup before importing',
    'Create items in Item Master before filling opening stock',
    'Use the correct store name in the template',
    'Enter the correct rate - it will be difficult to change later',
  ],
  donts: [
    'Do not ignore backups - data loss is serious',
    'Do not import without a backup',
    'Do not import if items are not created - create them in Item Master first',
    'Do not create duplicate items - matching is done by item code',
  ],
  validationRules: [
    { field: 'Store/Department', rule: 'Required, existing store name' },
    { field: 'Item Code', rule: 'Required, must exist in Item Master' },
    { field: 'Qty', rule: 'Required, positive number' },
    { field: 'Rate', rule: 'Optional, per-unit purchase rate' },
  ],
  relatedPages: [
    { title: 'Items', route: '/masters/items' },
    { title: 'Units', route: '/masters/units' },
    { title: 'Store Stock', route: '/enterprise/stock' },
  ],
};
