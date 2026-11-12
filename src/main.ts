import { mount } from 'svelte';
import './app.css';
import App from './App.svelte';
import { expandCompactSearch } from './core/compactLink';
import { parseUrl } from './core/url';

// Compact links (d=…) are decompressed before the design is read.
expandCompactSearch(location.search).then((search) => {
  mount(App, { target: document.getElementById('app')!, props: { initial: parseUrl(search) } });
});
