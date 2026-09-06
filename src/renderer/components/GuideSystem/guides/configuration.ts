import { GuideData } from '../types';

export const configurationGuide: GuideData = {
  pageId: 'configuration',
  pageTitle: 'System Configuration',
  pageDescription: 'Configure business rules and system settings',
  route: '/enterprise/configuration',
  whatIsThis: 'On the Configuration page you can set all the business rules for your inventory system - stock rules, transfer rules, approval rules, serial number tracking, etc. All of this is configurable without code changes. Changes are applied immediately.',
  whenToUse: 'Whenever you need to change a business rule - require approval, allow negative stock, enable serial number tracking, etc. Configure the system before setting it up.',
  prerequisites: [
    'Must have Admin or Settings permission',
  ],
  sections: [
    {
      title: 'Stock Rules',
      icon: 'Inventory',
      content: '- ALLOW_NEGATIVE: Whether negative stock is allowed (default: false)\n- ALLOW_BACKDATED: Whether backdated transactions are allowed (default: true)\n- REQUIRE_CONDITION: Whether the condition field is required (default: true)\n- STOCKTAKE_ENABLED: Whether stocktaking is enabled (default: false)',
    },
    {
      title: 'Transfer Rules',
      icon: 'SwapHoriz',
      content: '- REQUIRE_APPROVAL: Whether transfers require approval (default: false)\n- ALLOW_CROSS_COMPANY: Whether cross-company transfers are allowed (default: false)\n- IN_TRANSIT_ENABLED: Whether in-transit status is enabled (default: false)',
    },
    {
      title: 'Approval Rules',
      icon: 'CheckCircle',
      content: '- RECEIPT_APPROVAL: Whether receipt challan requires approval\n- ISSUE_APPROVAL: Whether issue challan requires approval\n- TRANSFER_APPROVAL: Whether transfer challan requires approval',
    },
    {
      title: 'Report Settings',
      icon: 'Assessment',
      content: '- LOW_STOCK_THRESHOLD: Below what level triggers a low stock alert (default: 10)\n- DEAD_STOCK_DAYS: After how many days stock is considered dead (default: 90)',
    },
  ],
  steps: [
    {
      stepNumber: 1,
      title: 'Select Category',
      description: 'Select a category from the left side - Stock, Transfer, Approval, Report, General.',
    },
    {
      stepNumber: 2,
      title: 'Change Setting',
      description: 'Toggle the rule on/off or enter the value for the rule you want to change.',
      warning: 'Changes are applied immediately - change carefully',
    },
    {
      stepNumber: 3,
      title: 'Save',
      description: 'Click the Save button. The settings will be updated.',
    },
  ],
  dos: [
    'First understand what the rule does, then change it',
    'Make changes carefully in production',
    'Keep a backup of the configuration',
  ],
  donts: [
    'Do not change settings randomly',
    'Do not allow negative stock without a reason',
    'Do not remove the approval process without thinking',
  ],
  validationRules: [
    { field: 'ALLOW_NEGATIVE', rule: 'Boolean, default false' },
    { field: 'ALLOW_BACKDATED', rule: 'Boolean, default true' },
    { field: 'LOW_STOCK_THRESHOLD', rule: 'Number, default 10' },
    { field: 'DEAD_STOCK_DAYS', rule: 'Number, default 90' },
  ],
  relatedPages: [
    { title: 'Transfer Matrix', route: '/enterprise/configuration' },
    { title: 'Store Master', route: '/enterprise/stores' },
  ],
};
