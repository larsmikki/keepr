import React, { useState, useRef } from 'react';
import { useTheme } from '@/contexts/ThemeContext';
import { Button, Input, Modal, Textarea, useToast } from '@/components/ui';
import { api } from '@/api';
import type { MetadataSuggestion } from '@/types';

interface UploadFormProps {
  onClose: () => void;
  onSuccess: () => void | Promise<void>;
  initialFiles?: File[];
}

export const UploadModal: React.FC<UploadFormProps> = ({ onClose, onSuccess, initialFiles }) => {
  const { theme } = useTheme();
  const { addToast } = useToast();
  const [files, setFiles] = useState<File[]>(initialFiles ?? []);
  const [uploading, setUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [formData, setFormData] = useState({
    title: initialFiles?.length === 1 ? initialFiles[0].name.replace(/\.[^/.]+$/, '') : '',
    description: '',
    documentDate: new Date().toISOString().split('T')[0],
  });

  const fetchSuggestions = async (filename: string) => {
    setLoadingSuggestions(true);
    try {
      const suggestions = await api.getMetadataSuggestions(filename) as MetadataSuggestion;
      const titleWithoutExt = filename.replace(/\.[^/.]+$/, '');
      setFormData(prev => ({
        ...prev,
        title: suggestions.title || titleWithoutExt,
        documentDate: suggestions.documentDate || prev.documentDate,
      }));
    } catch {
    } finally {
      setLoadingSuggestions(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(true); };
  const handleDragLeave = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(false); };
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const droppedFiles = Array.from(e.dataTransfer.files);
    if (droppedFiles.length > 0) handleFilesSelect(droppedFiles);
  };

  const handleFilesSelect = (selectedFiles: File[]) => {
    if (selectedFiles.length > 0) {
      setFiles(prev => [...prev, ...selectedFiles]);
      if (files.length === 0) {
        fetchSuggestions(selectedFiles[0].name);
      }
    }
    if (files.length + selectedFiles.length > 1) {
      setFormData(prev => ({ ...prev, title: '' }));
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);
    if (selectedFiles.length > 0) handleFilesSelect(selectedFiles);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeFile = (index: number) => {
    const remaining = files.filter((_, i) => i !== index);
    setFiles(remaining);
    if (remaining.length === 1) fetchSuggestions(remaining[0].name);
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (files.length === 0) return;

    setUploading(true);
    let succeeded = false;
    try {
      const metadata = files.length === 1 ? formData : { ...formData, title: '' };
      const result = await api.uploadDocuments(files, metadata);
      const successCount = result.results.filter(r => r.documentId && !r.error).length;
      const duplicateCount = result.results.filter(r => r.duplicate).length;

      if (duplicateCount > 0) {
        addToast(`${successCount} uploaded, ${duplicateCount} duplicates skipped`, 'success');
      } else {
        addToast(`${successCount} document${successCount !== 1 ? 's' : ''} uploaded`, 'success');
      }
      succeeded = true;
    } catch (err) {
      addToast('Upload failed: ' + err, 'error');
    } finally {
      setUploading(false);
    }

    if (succeeded) {
      onClose();
      try {
        await onSuccess();
      } catch {}
    }
  };

  return (
    <Modal open onClose={onClose} title="Upload documents" maxWidth="640px">
      <form onSubmit={handleSubmit} className="space-y-4" data-upload-modal>
        <div>
          <label className="block text-xs uppercase tracking-wider font-semibold text-text2 mb-1">Files</label>
          {files.length > 0 ? (
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {files.map((file, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-3 rounded-lg border"
                  style={{ borderColor: theme.border, backgroundColor: theme.surface2 }}
                >
                  <div className="overflow-hidden">
                    <div className="text-sm font-medium truncate text-text">{file.name}</div>
                    <div className="text-xs text-text2">{formatFileSize(file.size)}</div>
                  </div>
                  <Button type="button" variant="ghost" size="sm" onClick={() => removeFile(index)}>
                    Remove
                  </Button>
                </div>
              ))}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-full p-3 rounded-lg border-2 border-dashed text-sm font-medium hover:opacity-70 transition-all text-text2"
                style={{ borderColor: theme.border }}
              >
                + Add more files
              </button>
            </div>
          ) : (
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all"
              style={{
                borderColor: isDragging ? theme.accent : theme.border,
                backgroundColor: isDragging ? `${theme.accent}08` : 'transparent',
              }}
            >
              <div className="text-sm font-medium mb-1 text-text">
                {isDragging ? 'Drop files here' : loadingSuggestions ? 'Analyzing filename…' : 'Drag and drop files'}
              </div>
              <div className="text-xs text-text2">or click to browse</div>
            </div>
          )}
          <input ref={fileInputRef} type="file" multiple className="hidden" onChange={handleFileInputChange} />
        </div>

        <div className="grid grid-cols-2 gap-4">
          {files.length === 1 && (
            <div className="col-span-2 md:col-span-1">
              <label className="block text-xs uppercase tracking-wider font-semibold text-text2 mb-1">Title</label>
              <Input required value={formData.title} onChange={e => setFormData({ ...formData, title: e.target.value })} />
            </div>
          )}
          <div className={files.length === 1 ? 'col-span-2 md:col-span-1' : 'col-span-2'}>
            <label className="block text-xs uppercase tracking-wider font-semibold text-text2 mb-1">Document date</label>
            <Input type="date" value={formData.documentDate} onChange={e => setFormData({ ...formData, documentDate: e.target.value })} />
          </div>
        </div>

        <div>
          <label className="block text-xs uppercase tracking-wider font-semibold text-text2 mb-1">Description</label>
          <Textarea
            rows={3}
            value={formData.description}
            onChange={e => setFormData({ ...formData, description: e.target.value })}
          />
        </div>

        <div className="flex justify-end gap-2 mt-6">
          <Button type="button" onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="primary" size="lg" disabled={uploading || files.length === 0}>
            {uploading ? 'Uploading…' : `Upload ${files.length > 1 ? `${files.length} documents` : 'document'}`}
          </Button>
        </div>
      </form>
    </Modal>
  );
};
