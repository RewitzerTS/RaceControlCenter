// Local component harness. Not an application entry point or production route.
import React from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { I18nProvider } from '../src/i18n/I18nProvider';
import { InstagramEditor } from '../src/graphics/InstagramStudioPage';
import '../src/styles.css';
createRoot(document.getElementById('root')!).render(<React.StrictMode><I18nProvider><MemoryRouter><InstagramEditor /></MemoryRouter></I18nProvider></React.StrictMode>);
