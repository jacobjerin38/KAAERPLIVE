import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export default defineConfig(({ mode }) => {
  // Load env file based on `mode` in the current working directory.
  // Set the third parameter to '' to load all env regardless of the `VITE_` prefix.
  const env = loadEnv(mode, resolve('.'), '');
  
  return {
    plugins: [react()],
    resolve: {
      alias: {
        '@': resolve(__dirname, './'),
      },
    },
    define: {
      // Define specific replacement to avoid clobbering the whole process.env object
      // and ensure the key is injected as a string literal.
      'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY)
    },
    server: {
      host: true
    }
  };
});