import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { DocumentsProvider } from '@/contexts/DocumentsContext';
import { ToastProvider } from '@/components/ui';
import Layout from '@/components/Layout';
import { FrontPage } from '@/pages/FrontPage';
import { DocumentsPage } from '@/pages/DocumentsPage';
import { DocumentDetailPage } from '@/pages/DocumentDetailPage';
import { InboxPage } from '@/pages/InboxPage';
import { SettingsPage } from '@/pages/SettingsPage';
import { DonatePage } from '@/pages/DonatePage';

const App: React.FC = () => {
  return (
    <ThemeProvider>
      <DocumentsProvider>
        <ToastProvider>
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<Layout />}>
                <Route index element={<FrontPage />} />
                <Route path="documents" element={<DocumentsPage />} />
                <Route path="documents/:id" element={<DocumentDetailPage />} />
                <Route path="inbox" element={<InboxPage />} />
                <Route path="settings" element={<SettingsPage />} />
                <Route path="donate" element={<DonatePage />} />
              </Route>
            </Routes>
          </BrowserRouter>
        </ToastProvider>
      </DocumentsProvider>
    </ThemeProvider>
  );
};

export default App;
