import React from 'react';
import PrintableFormLayout from '../PrintableFormLayout';
import type { FormSection } from '../PrintableFormLayout';

interface Props {
  data: {
    certificateNumber: string;
    date: string;
    workOrderNumber?: string;
    department: string;
    dharamshala?: string;
    room?: string;
    location: string;
    assetName: string;
    assetCode?: string;
    itemName: string;
    quantity: number;
    serialNumber?: string;
    installedBy: string;
    installationDate: string;
    workDescription: string;
    verifiedBy?: string;
    remarks?: string;
  };
  showActions?: boolean;
}

export default function InstallationCertificate({ data, showActions = true }: Props) {
  const sections: FormSection[] = [
    {
      title: 'General Info',
      content: (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 16px' }}>
          <div><strong>Certificate No:</strong> {data.certificateNumber}</div>
          {data.workOrderNumber && <div><strong>Work Order Ref:</strong> {data.workOrderNumber}</div>}
        </div>
      ),
    },
    {
      title: 'Installation Details',
      content: (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 16px' }}>
          <div><strong>Department:</strong> {data.department}</div>
          {data.dharamshala && <div><strong>Dharamshala:</strong> {data.dharamshala}</div>}
          {data.room && <div><strong>Room:</strong> {data.room}</div>}
          <div><strong>Location:</strong> {data.location}</div>
          <div><strong>Asset Name:</strong> {data.assetName}</div>
          {data.assetCode && <div><strong>Asset Code:</strong> {data.assetCode}</div>}
          <div><strong>Item Name:</strong> {data.itemName}</div>
          <div><strong>Quantity:</strong> {data.quantity}</div>
          {data.serialNumber && <div><strong>Serial Number:</strong> {data.serialNumber}</div>}
          <div><strong>Installed By:</strong> {data.installedBy}</div>
          <div><strong>Installation Date:</strong> {data.installationDate}</div>
        </div>
      ),
    },
    {
      title: 'Work Description',
      content: (
        <div style={{ fontSize: '0.8rem', whiteSpace: 'pre-wrap' }}>
          {data.workDescription}
        </div>
      ),
    },
  ];

  return (
    <PrintableFormLayout
      documentNumber={data.certificateNumber}
      documentTitle="Installation Certificate"
      date={data.date}
      sections={sections}
      signatures={[
        { label: 'Installed By', name: data.installedBy },
        { label: 'Verified By', name: data.verifiedBy },
        { label: 'Department Incharge' },
      ]}
      remarks={data.remarks}
      showActions={showActions}
    />
  );
}
