import { GuideData } from '../types';

export const unitsGuide: GuideData = {
  pageId: 'units',
  pageTitle: 'Units',
  pageDescription: 'Define measurement units',
  route: '/masters/units',
  whatIsThis: 'In Units, you define the measurement units for items - such as Kilogram, Piece, Meter, Liter, Box, etc. Each item is assigned one unit. The unit table also shows how many items are using each unit.',
  whenToUse: 'Whenever you need to create a new unit - such as when a new measurement type is introduced. Create units first, then assign them to items.',
  prerequisites: [],
  sections: [
    {
      title: 'Unit Symbol',
      icon: 'Straighten',
      content: 'Each unit has a symbol (e.g., KG for Kilogram, PC for Piece, M for Meter). The symbol appears in reports.',
    },
    {
      title: 'Item Count',
      icon: 'Inventory2',
      content: 'The "Items" column in the unit table shows how many items are using that unit. If you want to delete a unit, first change the unit of those items.',
    },
  ],
  steps: [
    {
      stepNumber: 1,
      title: 'Click on New Unit',
      description: 'Click the "Add Unit" button.',
    },
    {
      stepNumber: 2,
      title: 'Enter Unit Name',
      description: 'Enter the unit name (e.g., Kilogram, Piece, Meter).',
    },
    {
      stepNumber: 3,
      title: 'Enter Symbol',
      description: 'Enter a short symbol (e.g., KG, PC, M).',
      tip: 'Use standard symbols (KG, GM, LTR, M, PC)',
    },
    {
      stepNumber: 4,
      title: 'Save',
      description: 'Click the Save button.',
    },
  ],
  dos: [
    'Use standard symbols',
    'Keep commonly used units',
    'Check item count before deleting',
  ],
  donts: [
    'Do not create very similar units (e.g., Kg and Kilogram)',
    'Do not keep symbols too long',
    'Do not delete a unit that has items using it',
  ],
  validationRules: [
    { field: 'Name', rule: 'Required, min 1 character' },
    { field: 'Symbol', rule: 'Optional, string' },
  ],
  relatedPages: [
    { title: 'Items', route: '/masters/items' },
  ],
};
