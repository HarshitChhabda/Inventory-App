import { GuideData } from '../types';

export const itemsGuide: GuideData = {
  pageId: 'items',
  pageTitle: 'Items',
  pageDescription: 'Manage all inventory items',
  route: '/masters/items',
  whatIsThis: 'In the Items master, you define all your inventory items - each item has a name, code, unit, and minimum stock level. This is the most basic master data. Without items, no challan can be created.',
  whenToUse: 'Whenever you need to add a new item, edit an existing item, or deactivate an item. Before creating a new item, make an entry in the item master first.',
  prerequisites: [
    'Units must be created in the unit master',
  ],
  sections: [
    {
      title: 'Item Fields',
      icon: 'Info',
      content: 'Every item has:\n- Item Code: unique identifier (e.g., ITM-001) - enter manually\n- Item Name: descriptive name\n- Unit: the unit of measurement (kg, piece, meter) - type or select\n- Minimum Stock Level: minimum stock to maintain',
    },
    {
      title: 'Item Code',
      icon: 'Code',
      content: 'The item code must be unique. This code is used as a reference in challans. Enter the code manually - the system does not generate it automatically.',
    },
  ],
  steps: [
    {
      stepNumber: 1,
      title: 'Click on New Item',
      description: 'Click the "Add Item" button.',
    },
    {
      stepNumber: 2,
      title: 'Enter Item Code',
      description: 'Enter a unique item code (e.g., ITM-001, EL-001). This must be entered manually.',
      warning: 'Duplicate codes are not allowed',
    },
    {
      stepNumber: 3,
      title: 'Enter Item Name',
      description: 'Enter a descriptive name for the item.',
      tip: 'Keep the name descriptive so it can be easily identified',
    },
    {
      stepNumber: 4,
      title: 'Select Unit',
      description: 'Select from the dropdown or type and create a new unit (e.g., Kg, Meter, Box).',
    },
    {
      stepNumber: 5,
      title: 'Enter Minimum Stock Level',
      description: 'Enter the minimum stock to maintain. You will get an alert when stock falls below this.',
      tip: 'Start with 0 and adjust later',
    },
    {
      stepNumber: 6,
      title: 'Save',
      description: 'Click the Save button. The item will be created.',
    },
  ],
  dos: [
    'Maintain a consistent item code system (e.g., ITM-001, ITM-002)',
    'Keep item names descriptive',
    'Set the correct minimum stock level for alerts',
    'Select the correct unit',
  ],
  donts: [
    'Do not create duplicate item codes',
    'Do not keep item names too short or vague',
    'Do not set minimum stock level to 0 for important items',
    'Do not delete inactive items - deactivate them',
  ],
  validationRules: [
    { field: 'Item Code', rule: 'Required, unique, min 1 character' },
    { field: 'Item Name', rule: 'Required, min 1 character' },
    { field: 'Unit', rule: 'Required, positive integer' },
    { field: 'Minimum Stock Level', rule: 'Optional, min 0, default 0' },
  ],
  relatedPages: [
    { title: 'Units', route: '/masters/units' },
    { title: 'Store Stock', route: '/enterprise/stock' },
  ],
};
