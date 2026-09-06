import { GuideData } from '../types';

export const dashboardGuide: GuideData = {
  pageId: 'dashboard',
  pageTitle: 'Dashboard',
  pageDescription: 'Overview and summary of your inventory',
  route: '/',
  whatIsThis: 'The Dashboard is a summary of your entire inventory system. Here you can find all important metrics in one place - total stock, pending orders, recent transactions, and alerts. This page is for viewing only; no direct entries can be made from here.',
  whenToUse: 'Whenever you want to check the current status of inventory, or quickly understand what is happening - low stock alerts, pending approvals, recent movements - open the Dashboard.',
  prerequisites: [
    'Login is required',
    'Company and Financial Year must be selected',
  ],
  sections: [
    {
      title: 'Metrics Cards',
      icon: 'BarChart',
      content: 'The top cards show: Total Items, Total Stock Value, Low Stock Alerts, Pending Orders. Click on any card to view details.',
    },
    {
      title: 'Recent Activity',
      icon: 'History',
      content: 'Shows a list of recent transactions - which receipts came in, which issues were raised, which transfers were made. Click on any entry to view details.',
    },
    {
      title: 'Quick Actions',
      icon: 'FlashOn',
      content: 'You can create a new receipt challan, issue challan, or transfer challan directly from the Dashboard without navigating through the menu.',
    },
  ],
  steps: [
    {
      stepNumber: 1,
      title: 'View Metrics',
      description: 'Understand what is happening across the overall system using the top cards.',
    },
    {
      stepNumber: 2,
      title: 'Check Alerts',
      description: 'View alerts for low stock or pending orders and address them.',
      tip: 'Give priority to red alerts first',
    },
    {
      stepNumber: 3,
      title: 'Review Recent Activity',
      description: 'Check the last few transactions to see what entries were made recently.',
    },
  ],
  dos: [
    'Check the Dashboard daily for system health',
    'Take immediate action on low stock alerts',
    'Use quick actions for common tasks',
  ],
  donts: [
    'Do not edit stock directly from the Dashboard',
    'Do not ignore alerts - low stock is serious',
  ],
  validationRules: [],
  relatedPages: [
    { title: 'Reports', route: '/reports' },
    { title: 'Stock Ledger', route: '/inventory/stock-ledger' },
    { title: 'Store Stock', route: '/enterprise/stock' },
  ],
};
