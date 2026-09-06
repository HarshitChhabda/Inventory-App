import { GuideData } from '../types';

export const vendorsGuide: GuideData = {
  pageId: 'vendors',
  pageTitle: 'Vendors',
  pageDescription: 'Manage suppliers and vendors',
  route: '/masters/vendors',
  whatIsThis: 'In the Vendors master, you define your suppliers - their name, contact person, phone, address, and GST number. When stock comes from a vendor (Receipt Challan), there is a vendor reference.',
  whenToUse: 'Whenever you need to add a new vendor, edit an existing vendor, or deactivate a vendor. Before the first transaction with a new vendor, create an entry in the master.',
  prerequisites: [],
  sections: [
    {
      title: 'Vendor Information',
      icon: 'Storefront',
      content: 'Every vendor has:\n- Vendor Name: company or supplier name\n- Contact Person: who is the point of contact\n- Phone: contact number\n- Address: physical address\n- GST Number: for taxation (optional)',
    },
  ],
  steps: [
    {
      stepNumber: 1,
      title: 'Click on New Vendor',
      description: 'Click the "Add Vendor" button.',
    },
    {
      stepNumber: 2,
      title: 'Enter Vendor Name',
      description: 'Enter the vendor name.',
      warning: 'Enter the correct name - it will be referenced in receipts',
    },
    {
      stepNumber: 3,
      title: 'Fill in Contact Details',
      description: 'Enter contact person, phone, address.',
      tip: 'Enter the correct phone number - it is important for urgent communication',
    },
    {
      stepNumber: 4,
      title: 'Enter GST Number (Optional)',
      description: 'If GST is applicable, enter the GST number.',
    },
    {
      stepNumber: 5,
      title: 'Save',
      description: 'Click the Save button.',
    },
  ],
  dos: [
    'Keep the vendor name correct and complete',
    'Keep contact details updated',
    'Verify the GST number if applicable',
  ],
  donts: [
    'Do not delete inactive vendors - deactivate them',
    'Do not create a vendor without contact information',
  ],
  validationRules: [
    { field: 'Vendor Name', rule: 'Required, min 1 character' },
    { field: 'Contact Person', rule: 'Optional, string' },
    { field: 'Phone', rule: 'Optional, string' },
    { field: 'Address', rule: 'Optional, string' },
    { field: 'GST Number', rule: 'Optional, string' },
  ],
  relatedPages: [
    { title: 'Receipt Challan', route: '/inventory/receipt-challan' },
    { title: 'Vendor Return', route: '/inventory/vendor-return' },
  ],
};
