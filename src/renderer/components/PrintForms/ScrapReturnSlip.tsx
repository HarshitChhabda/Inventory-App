import React from 'react';
import PrintableFormLayout from '../PrintableFormLayout';
import type { FormSection } from '../PrintableFormLayout';

interface Props {
  data: {
    scrapNumber: string;
    date: string;
    workOrderNumber?: string;
    department: string;
    collectedBy: string;
    receivedBy: string;
    items: Array<{ itemName: string; itemCode?: string; unitName: string; quantityScrap: number; condition: string; serialNumber?: string; disposalNotes?: string }>;
    remarks?: string;
  };
  showActions?: boolean;
}

export default function ScrapReturnSlip({ data, showActions = true }: Props) {
  const sections: FormSection[] = [
    {
      title: 'General Info',
      content: (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 16px' }}>
          <div><strong>Scrap No:</strong> {data.scrapNumber}</div>
          <div><strong>Department:</strong> {data.department}</div>
          {data.workOrderNumber && <div><strong>Work Order Ref:</strong> {data.workOrderNumber}</div>}
          <div><strong>Collected By:</strong> {data.collectedBy}</div>
          <div><strong>Received By:</strong> {data.receivedBy}</div>
        </div>
      ),
    },
  ];

  return (
    <PrintableFormLayout
      documentNumber={data.scrapNumber}
      documentTitle="Scrap Return Slip"
      date={data.date}
      sections={sections}
      itemTable={{
        columns: ['Item Name', 'Code', 'Unit', 'Qty Scrap', 'Condition', 'Serial No', 'Disposal Notes'],
        rows: data.items.map((item) => [
          item.itemName,
          item.itemCode || '-',
          item.unitName,
          item.quantityScrap,
          item.condition,
          item.serialNumber || '-',
          item.disposalNotes || '-',
        ]),
      }}
      signatures={[
        { label: 'Collected By', name: data.collectedBy },
        { label: 'Received By', name: data.receivedBy },
        { label: 'Store Incharge' },
      ]}
      remarks={data.remarks}
      showActions={showActions}
    />
  );
}
