import React from 'react';
import PrintableFormLayout from '../PrintableFormLayout';
import type { FormSection } from '../PrintableFormLayout';

interface Props {
  data: {
    demandNumber: string;
    date: string;
    department: string;
    location?: string;
    dharamshala?: string;
    room?: string;
    store?: string;
    storeName?: string;
    requestedBy: string;
    requestingPerson?: string;
    mobileNo?: string;
    technicianName: string;
    responsiblePerson?: string;
    workType?: string;
    purpose: string;
    items: Array<{ itemName: string; itemCode?: string; unitName: string; quantityRequested: number; serialNumber?: string; responsiblePerson?: string; workType?: string }>;
    remarks?: string;
  };
  showActions?: boolean;
}

export default function MaterialDemandSlip({ data, showActions = true }: Props) {
  const sections: FormSection[] = [
    {
      title: 'General Info',
      content: (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 16px' }}>
          <div><strong>मांग क्रमांक:</strong> {data.demandNumber}</div>
          <div><strong>Department:</strong> {data.department}</div>
          {data.location && <div><strong>Location:</strong> {data.location}</div>}
          {data.dharamshala && <div><strong>Dharamshala:</strong> {data.dharamshala}</div>}
          {data.room && <div><strong>Room:</strong> {data.room}</div>}
          {(data.store || data.storeName) && <div><strong>Store:</strong> {data.store || data.storeName}</div>}
          <div><strong>Requested By:</strong> {data.requestingPerson || data.requestedBy}</div>
          {data.mobileNo && <div><strong>Mobile No:</strong> {data.mobileNo}</div>}
          <div><strong>Technician:</strong> {data.technicianName}</div>
          {data.responsiblePerson && <div><strong>Responsible Person:</strong> {data.responsiblePerson}</div>}
          {data.workType && <div><strong>Work Type:</strong> {data.workType}</div>}
          <div style={{ gridColumn: '1 / -1' }}><strong>Purpose:</strong> {data.purpose}</div>
        </div>
      ),
    },
  ];

  return (
    <PrintableFormLayout
      documentNumber={data.demandNumber}
      documentTitle="Material Demand Slip"
      date={data.date}
      sections={sections}
      itemTable={{
        columns: ['Item Name', 'Code', 'Unit', 'Qty Requested', 'Serial No'],
        rows: data.items.map((item) => [
          item.itemName,
          item.itemCode || '-',
          item.unitName,
          item.quantityRequested,
          item.serialNumber || '-',
        ]),
      }}
      signatures={[
        { label: 'Requested By', name: data.requestedBy },
        { label: 'Store Incharge' },
      ]}
      remarks={data.remarks}
      showActions={showActions}
    />
  );
}
