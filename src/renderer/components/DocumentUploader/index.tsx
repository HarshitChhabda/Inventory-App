import React, { useState } from 'react';
import { Box, Button, Stack, Typography, IconButton, List, ListItem, ListItemText, ListItemSecondaryAction, Tooltip } from '@mui/material';
import { CloudUpload, Delete, Description, Image } from '@mui/icons-material';

interface UploadedFile {
  file: File;
  preview?: string;
  description?: string;
}

interface DocumentUploaderProps {
  onFilesChange: (files: UploadedFile[]) => void;
  accept?: string;
  multiple?: boolean;
  maxFiles?: number;
  label?: string;
}

export default function DocumentUploader({
  onFilesChange,
  accept = 'image/*,.pdf,.doc,.docx',
  multiple = true,
  maxFiles = 10,
  label = 'Upload scanned documents or photos',
}: DocumentUploaderProps) {
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const handleFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newFiles = Array.from(e.target.files || []);
    const limited = newFiles.slice(0, maxFiles - files.length);
    const uploaded: UploadedFile[] = limited.map(f => ({
      file: f,
      preview: f.type.startsWith('image/') ? URL.createObjectURL(f) : undefined,
    }));
    const updated = [...files, ...uploaded];
    setFiles(updated);
    onFilesChange(updated);
    if (inputRef.current) inputRef.current.value = '';
  };

  const removeFile = (index: number) => {
    const updated = files.filter((_, i) => i !== index);
    setFiles(updated);
    onFilesChange(updated);
  };

  return (
    <Box>
      <Typography variant="caption" sx={{ fontWeight: 600, mb: 0.5, display: 'block' }}>{label}</Typography>
      <Button
        variant="outlined"
        size="small"
        startIcon={<CloudUpload />}
        onClick={() => inputRef.current?.click()}
        sx={{ textTransform: 'none', mb: 1 }}
      >
        Select Files ({files.length}/{maxFiles})
      </Button>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        onChange={handleFiles}
        style={{ display: 'none' }}
      />
      {files.length > 0 && (
        <List dense>
          {files.map((f, i) => (
            <ListItem key={i} sx={{ border: '1px solid #eee', borderRadius: 1, mb: 0.5, py: 0.5 }}>
              {f.preview ? (
                <Image sx={{ fontSize: 20, mr: 1, color: 'primary.main' }} />
              ) : (
                <Description sx={{ fontSize: 20, mr: 1, color: 'text.secondary' }} />
              )}
              <ListItemText
                primary={f.file.name}
                secondary={`${(f.file.size / 1024).toFixed(1)} KB`}
                primaryTypographyProps={{ fontSize: '0.75rem', noWrap: true }}
                secondaryTypographyProps={{ fontSize: '0.65rem' }}
              />
              <ListItemSecondaryAction>
                <Tooltip title="Remove file">
                  <IconButton size="small" onClick={() => removeFile(i)} aria-label="Remove file">
                    <Delete fontSize="small" />
                  </IconButton>
                </Tooltip>
              </ListItemSecondaryAction>
            </ListItem>
          ))}
        </List>
      )}
    </Box>
  );
}
