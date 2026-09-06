import { GuideData } from '../types';

export const locationsGuide: GuideData = {
  pageId: 'locations',
  pageTitle: 'Locations',
  pageDescription: 'Define physical locations and rooms',
  route: '/masters/locations',
  whatIsThis: 'In Locations, you define physical locations - such as Room, Dharamshala, Store, Department. A location is a physical place while the Store holds ownership. Locations only hold installed assets, not stock.',
  whenToUse: 'Whenever you need to add a new physical location - a new room, a new dharamshala, a new department space. Locations are needed for asset installations.',
  prerequisites: [
    'A store must be created in the Store Master',
  ],
  sections: [
    {
      title: 'Location Types',
      icon: 'Place',
      content: 'There are four types:\n1. Room - a specific room\n2. Dharamshala - dharamshala location\n3. Store - physical store location\n4. Department - physical space of a department',
    },
    {
      title: 'Parent-Child',
      icon: 'AccountTree',
      content: 'Locations can have a hierarchy - a Room can be under a parent. The parent is generally a Store or Department.',
    },
  ],
  steps: [
    {
      stepNumber: 1,
      title: 'Click on New Location',
      description: 'Click the "Add Location" button.',
    },
    {
      stepNumber: 2,
      title: 'Select Location Type',
      description: 'Select from the dropdown - Room, Dharamshala, Store, Department.',
    },
    {
      stepNumber: 3,
      title: 'Enter Location Name',
      description: 'Enter the location name (e.g., Room 101, Ground Floor Store).',
    },
    {
      stepNumber: 4,
      title: 'Select Parent Location (Optional)',
      description: 'If the location is under a parent, select it.',
    },
    {
      stepNumber: 5,
      title: 'Save',
      description: 'Click the Save button.',
    },
  ],
  dos: [
    'Keep location names descriptive',
    'Set the correct parent-child relationship',
  ],
  donts: [
    'Do not put stock directly on a location - stock is at the Store',
    'Do not delete a location if assets are installed there',
  ],
  validationRules: [
    { field: 'Location Type', rule: 'Required - Room / Dharamshala / Store / Department' },
    { field: 'Name', rule: 'Required, min 1 character' },
    { field: 'Parent', rule: 'Optional, positive integer' },
  ],
  relatedPages: [
    { title: 'Store Master', route: '/enterprise/stores' },
    { title: 'Asset Installations', route: '/assets/installations' },
    { title: 'Room Details', route: '/facilities/room-details' },
  ],
};
