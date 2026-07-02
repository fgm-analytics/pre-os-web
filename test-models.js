const fs = require('fs');
const dotenv = require('dotenv');

// Load env vars
dotenv.config({ path: './.env.local' });
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

async function listModels() {
  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${GEMINI_API_KEY}`);
    const data = await res.json();
    console.log(JSON.stringify(data.models.map(m => m.name), null, 2));
  } catch (e) {
    console.error(e);
  }
}

listModels();
