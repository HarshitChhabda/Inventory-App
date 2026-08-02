import React from 'react';
import { Routes, Route } from 'react-router-dom';
import TransferChallanList from './TransferChallanList';
import TransferChallanForm from './TransferChallanForm';

export default function TransfersPage() {
  return (
    <Routes>
      <Route index element={<TransferChallanList />} />
      <Route path="new" element={<TransferChallanForm />} />
      <Route path=":id" element={<TransferChallanForm />} />
    </Routes>
  );
}
