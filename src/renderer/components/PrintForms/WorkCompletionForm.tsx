import React from 'react';
import PrintableFormLayout from '../PrintableFormLayout';
import type { FormSection } from '../PrintableFormLayout';

interface Props {
  data: {
    completionNumber: string;
    date: string;
    workOrderNumber?: string;
    demandNumber?: string;
    department: string;
    dharamshala?: string;
    room?: string;
    technicianName: string;
    workDescription: string;
    items: Array<{
      itemName: string;
      itemCode?: string;
      unitName: string;
      quantityIssued: number;
      quantityInstalled: number;
      quantityReturned: number;
      quantityDamaged: number;
      quantityScrap: number;
      isReplacement?: boolean;
      oldItemDescription?: string;
      installationLocation?: string;
      serialNumber?: string;
      remarks?: string;
    }>;
    overallRemarks?: string;
  };
  showActions?: boolean;
}

export default function WorkCompletionForm({ data, showActions = true }: Props) {
  const sections: FormSection[] = [
    {
      title: 'General Info',
      content: (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 16px' }}>
          <div><strong>Completion No:</strong> {data.completionNumber}</div>
          <div><strong>Department:</strong> {data.department}</div>
          {data.workOrderNumber && <div><strong>Work Order Ref:</strong> {data.workOrderNumber}</div>}
          {data.demandNumber && <div><strong>Demand Ref:</strong> {data.demandNumber}</div>}
          {data.dharamshala && <div><strong>Dharamshala:</strong> {data.dharamshala}</div>}
          {data.room && <div><strong>Room:</strong> {data.room}</div>}
          <div><strong>Technician:</strong> {data.technicianName}</div>
          <div style={{ gridColumn: '1 / -1' }}><strong>Work Description:</strong> {data.workDescription}</div>
        </div>
      ),
    },
  ];

  const verificationContent = (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 16px', fontSize: '0.8rem' }}>
      <div>☐ Work completed satisfactorily</div>
      <div>☐ Material installed as per specification</div>
      <div>☐ Damaged items received back</div>
    </div>
  );

  sections.push({
    title: 'Verification',
    content: verificationContent,
  });

  return (
    <PrintableFormLayout
      documentNumber={data.completionNumber}
      documentTitle="Work Completion Form"
      date={data.date}
      sections={sections}
      itemTable={{
        columns: ['Item', 'Code', 'Unit', 'Issued', 'Installed', 'Returned', 'Damaged', 'Scrap', 'Location', 'Remarks'],
        rows: data.items.map((item) => [
          item.itemName + (item.isReplacement ? ' (Replacement)' : ''),
          item.itemCode || '-',
          item.unitName,
          item.quantityIssued,
          item.quantityInstalled,
          item.quantityReturned,
          item.quantityDamaged,
          item.quantityScrap,
          item.installationLocation || '-',
          item.remarks || '-',
        ]),
      }}
      signatures={[
        { label: 'Technician', name: data.technicianName },
        { label: 'Store Incharge' },
        { label: 'Site Verification Officer' },
        { label: 'Maintenance Supervisor' },
      ]}
      remarks={data.overallRemarks}
      showActions={showActions}
    />
  );
}
