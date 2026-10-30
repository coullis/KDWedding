import './style.css';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

const app = document.getElementById('app');
app.innerHTML = '<h1>Our Wedding Photos</h1><p>Loading...</p>';

async function load() {
  const { data, error } = await supabase.storage.from('photos').list('', { limit: 100 });

  if (error) {
    app.innerHTML = `<h1>Error</h1><p>${error.message}</p>`;
  } else {
    app.innerHTML = `<h1>Our Wedding Photos</h1><p>Found ${data.length} item(s):</p><pre>${data.map(f => f.name).join('\n')}</pre>`;
  }
}

load();