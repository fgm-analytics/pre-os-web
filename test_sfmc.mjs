import dotenv from 'dotenv';
import { fetchSFMCPriceEntries } from './src/lib/sfmc.js';
import fs from 'fs';

dotenv.config({ path: '.env.local' });

async function run() {
  console.log("Fetching SFMC entries...");
  const entries = await fetchSFMCPriceEntries();
  if (!entries) {
    console.log("Failed to fetch entries.");
    return;
  }
  
  console.log(`Fetched ${entries.length} entries.`);
  if (entries.length > 0) {
    console.log("Sample entry:");
    console.log(entries[0]);
    console.log("Empty name entries:");
    console.log(entries.filter(e => !e.ProductName).slice(0, 5));
  }
}

run();
