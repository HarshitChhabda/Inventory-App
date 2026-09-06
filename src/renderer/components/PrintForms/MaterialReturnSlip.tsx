import React from 'react';
import PrintableFormLayout from '../PrintableFormLayout';
import type { FormSection } from '../PrintableFormLayout';

interface Props {
  data: {
    returnNumber: string;
    date: string;
    workOrderNumber?: string;
    department: string;
    returnedBy: string;
    receivedBy: string;
    items: Array<{ itemName: string; itemCode?: string; unitName: string; quantityReturned: number; reason: string; condition: string; serialNumber?: string }>;
    remarks?: string;
  };
  showActions?: boolean;
}

export default function MaterialReturnSlip({ data, showActions = true }: Props) {
  const sections: FormSection[] = [
    {
      title: 'General Info',
      content: (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 16px' }}>
          <div><strong>Return No:</strong> {data.returnNumber}</div>
          <div><strong>Department:</strong> {data.department}</div>
          {data.workOrderNumber && <div><strong>Work Order Ref:</strong> {data.workOrderNumber}</div>}
          <div><strong>Returned By:</strong> {data.returnedBy}</div>
          <div><strong>Received By:</strong> {data.receivedBy}</div>
        </div>
      ),
    },
  ];

  return (
    <PrintableFormLayout
      documentNumber={data.returnNumber}
      documentTitle="Material Return Slip"
      date={data.date}
      sections={sections}
      itemTable={{
        columns: ['Item Name', 'Code', 'Unit', 'Qty Returned', 'Reason', 'Condition'],
        rows: data.items.map((item) => [
          item.itemName,
          item.itemCode || '-',
          item.unitName,
          item.quantityReturned,
          item.reason,
          item.condition,
        ]),
      }}
      signatures={[
        { label: 'Returned By', name: data.returnedBy },
        { label: 'Received By', name: data.receivedBy },
        { label: 'Store Incharge' },
      ]}
      remarks={data.remarks}
      showActions={showActions}
    />
  );
}
