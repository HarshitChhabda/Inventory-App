import React from 'react';
import PrintableFormLayout from '../PrintableFormLayout';
import type { FormSection } from '../PrintableFormLayout';

interface Props {
  data: {
    issueNumber: string;
    date: string;
    demandNumber?: string;
    department: string;
    dharamshala?: string;
    room?: string;
    issuedBy: string;
    receivedBy: string;
    technicianName: string;
    items: Array<{ itemName: string; itemCode?: string; unitName: string; quantityIssued: number; serialNumber?: string; condition?: string }>;
    remarks?: string;
  };
  showActions?: boolean;
}

export default function MaterialIssueSlip({ data, showActions = true }: Props) {
  const sections: FormSection[] = [
    {
      title: 'General Info',
      content: (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 16px' }}>
          <div><strong>Issue No:</strong> {data.issueNumber}</div>
          <div><strong>Department:</strong> {data.department}</div>
          {data.demandNumber && <div><strong>Demand Ref:</strong> {data.demandNumber}</div>}
          {data.dharamshala && <div><strong>Dharamshala:</strong> {data.dharamshala}</div>}
          {data.room && <div><strong>Room:</strong> {data.room}</div>}
          <div><strong>Issued By:</strong> {data.issuedBy}</div>
          <div><strong>Received By:</strong> {data.receivedBy}</div>
          <div><strong>Technician:</strong> {data.technicianName}</div>
        </div>
      ),
    },
  ];

  return (
    <PrintableFormLayout
      documentNumber={data.issueNumber}
      documentTitle="Material Issue Slip"
      date={data.date}
      sections={sections}
      itemTable={{
        columns: ['Item Name', 'Code', 'Unit', 'Qty Issued', 'Serial No', 'Condition'],
        rows: data.items.map((item) => [
          item.itemName,
          item.itemCode || '-',
          item.unitName,
          item.quantityIssued,
          item.serialNumber || '-',
          item.condition || '-',
        ]),
      }}
      signatures={[
        { label: 'Issued By', name: data.issuedBy },
        { label: 'Received By', name: data.receivedBy },
        { label: 'Store Incharge' },
      ]}
      remarks={data.remarks}
      showActions={showActions}
    />
  );
}
