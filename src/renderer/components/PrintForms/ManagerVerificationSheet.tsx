import React from 'react';
import PrintableFormLayout from '../PrintableFormLayout';
import type { FormSection } from '../PrintableFormLayout';

interface Props {
  data: {
    sheetNumber: string;
    date: string;
    workOrderNumber?: string;
    department: string;
    dharamshala?: string;
    verifiedBy: string;
    verificationRole: string;
    items: Array<{
      itemName: string;
      unitName: string;
      quantityIssued: number;
      quantityInstalled: number;
      quantityReturned: number;
      installationCorrect: boolean;
      workSatisfactory: boolean;
      remarks?: string;
    }>;
    overallRemarks?: string;
  };
  showActions?: boolean;
}

export default function ManagerVerificationSheet({ data, showActions = true }: Props) {
  const sections: FormSection[] = [
    {
      title: 'General Info',
      content: (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 16px' }}>
          <div><strong>Sheet No:</strong> {data.sheetNumber}</div>
          <div><strong>Department:</strong> {data.department}</div>
          {data.workOrderNumber && <div><strong>Work Order Ref:</strong> {data.workOrderNumber}</div>}
          {data.dharamshala && <div><strong>Dharamshala:</strong> {data.dharamshala}</div>}
          <div><strong>Verified By:</strong> {data.verifiedBy}</div>
          <div><strong>Role:</strong> {data.verificationRole}</div>
        </div>
      ),
    },
  ];

  return (
    <PrintableFormLayout
      documentNumber={data.sheetNumber}
      documentTitle="Manager Verification Sheet"
      date={data.date}
      sections={sections}
      itemTable={{
        columns: ['Item', 'Unit', 'Qty Issued', 'Installed', 'Returned', 'Correct?', 'Satisfactory?', 'Remarks'],
        rows: data.items.map((item) => [
          item.itemName,
          item.unitName,
          item.quantityIssued,
          item.quantityInstalled,
          item.quantityReturned,
          item.installationCorrect ? '✓' : '✗',
          item.workSatisfactory ? '✓' : '✗',
          item.remarks || '-',
        ]),
      }}
      signatures={[
        { label: 'Verification Officer', name: data.verifiedBy, role: data.verificationRole },
        { label: 'Maintenance Supervisor' },
      ]}
      remarks={data.overallRemarks}
      showActions={showActions}
    />
  );
}
