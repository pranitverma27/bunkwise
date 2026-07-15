const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

// Parse .env.local manually
const envPath = path.join(__dirname, '..', '.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
const envVars = {};
envContent.split('\n').forEach(line => {
  const parts = line.split('=');
  if (parts.length >= 2) {
    const key = parts[0].trim();
    const val = parts.slice(1).join('=').trim();
    envVars[key] = val;
  }
});

const supabaseUrl = envVars.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = envVars.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Supabase credentials in .env.local", envVars);
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  try {
    console.log("Listing buckets...");
    const { data: buckets, error: listError } = await supabase.storage.listBuckets();
    if (listError) {
      console.error("Error listing buckets:", listError);
    } else {
      console.log("Existing Buckets:", buckets);
    }

    const bucketName = 'shared-cards';
    const exists = buckets && buckets.some(b => b.name === bucketName);
    if (!exists) {
      console.log(`Creating bucket '${bucketName}'...`);
      const { data: createData, error: createError } = await supabase.storage.createBucket(bucketName, {
        public: true,
        allowedMimeTypes: ['image/png', 'image/jpeg'],
        fileSizeLimit: 5242880 // 5MB
      });
      if (createError) {
        console.error("Error creating bucket:", createError);
      } else {
        console.log("Bucket created successfully:", createData);
      }
    } else {
      console.log(`Bucket '${bucketName}' already exists.`);
    }
  } catch (err) {
    console.error("Unexpected error:", err);
  }
}

run();
