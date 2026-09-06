import React, { useState, useRef } from 'react';
import {
  Box, Typography, Button, List, ListItem, ListItemIcon, ListItemText,
  IconButton, LinearProgress, Alert,
} from '@mui/material';
import { CloudUpload, Description, Delete, AttachFile } from '@mui/icons-material';

interface AttachedDocument {
  id: number;
  fileName: string;
  fileType: string;
  fileSize: number;
  uploadedAt: string;
}

interface Props {
  sourceType: string;
  sourceId: number;
  onUploaded?: (doc: AttachedDocument) => void;
  onDeleted?: (docId: number) => void;
}

export default function DocumentUploader({ sourceType, sourceId, onUploaded, onDeleted }: Props) {
  const [documents, setDocuments] = useState<AttachedDocument[]>([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError('');
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('sourceType', sourceType);
      formData.append('sourceId', String(sourceId));

      const result = await window.electronAPI.attachDocument({
        sourceType,
        sourceId,
        fileName: file.name,
        fileType: file.type,
        fileSize: file.size,
      });

      const newDoc: AttachedDocument = {
        id: result?.id || Date.now(),
        fileName: file.name,
        fileType: file.type,
        fileSize: file.size,
        uploadedAt: new Date().toISOString(),
      };
      setDocuments(prev => [...prev, newDoc]);
      onUploaded?.(newDoc);
    } catch (err: any) {
      setError(err.message || 'Failed to upload document');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDelete = async (doc: AttachedDocument) => {
    try {
      await window.electronAPI.deleteDocument?.(doc.id);
      setDocuments(prev => prev.filter(d => d.id !== doc.id));
      onDeleted?.(doc.id);
    } catch (err: any) {
      setError(err.message || 'Failed to delete document');
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <Box>
      {uploading && <LinearProgress sx={{ mb: 1 }} />}
      {error && <Alert severity="error" sx={{ mb: 1 }} onClose={() => setError('')}>{error}</Alert>}

      <input
        ref={fileInputRef}
        type="file"
        hidden
        accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
        onChange={handleFileSelect}
      />

      <Button
        variant="outlined"
        startIcon={<CloudUpload />}
        onClick={() => fileInputRef.current?.click()}
        disabled={uploading}
        fullWidth
        sx={{ mb: 2 }}
      >
        Select File to Upload
      </Button>

      {documents.length > 0 && (
        <List dense>
          {documents.map(doc => (
            <ListItem
              key={doc.id}
              secondaryAction={
                <IconButton edge="end" size="small" onClick={() => handleDelete(doc)}>
                  <Delete fontSize="small" />
                </IconButton>
              }
            >
              <ListItemIcon>
                <Description fontSize="small" />
              </ListItemIcon>
              <ListItemText
                primary={doc.fileName}
                secondary={`${doc.fileType} - ${formatFileSize(doc.fileSize)}`}
              />
            </ListItem>
          ))}
        </List>
      )}

      {documents.length === 0 && !uploading && (
        <Box sx={{ textAlign: 'center', py: 2, color: 'text.secondary' }}>
          <AttachFile sx={{ fontSize: 40, opacity: 0.3 }} />
          <Typography variant="body2">No documents attached yet</Typography>
        </Box>
      )}
    </Box>
  );
}
