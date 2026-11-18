import React from 'react';
import { createRoot } from 'react-dom/client';
import { view } from '@forge/bridge';
import App from './App.jsx';
import ProjectPage from './ProjectPage.jsx';

// One bundle serves both places the app appears in Jira. The context says which one
// opened it: the panel on a ticket, or the page in a project's sidebar.
view.theme.enable().catch(() => {});

view.getContext().then((ctx) => {
  const Screen = ctx?.extension?.type === 'jira:projectPage' ? ProjectPage : App;
  createRoot(document.getElementById('root')).render(<Screen />);
});
