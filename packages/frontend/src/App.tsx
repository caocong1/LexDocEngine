import { Component } from 'solid-js';
import { Router, Route } from '@solidjs/router';
import Home from './pages/Home';
import DocumentList from './pages/DocumentList';
import DocumentEdit from './pages/DocumentEdit';
import Library from './pages/Library';

const App: Component = () => {
  return (
    <Router>
      <Route path="/" component={Home} />
      <Route path="/documents" component={DocumentList} />
      <Route path="/documents/:id" component={DocumentEdit} />
      <Route path="/library" component={Library} />
    </Router>
  );
};

export default App;
