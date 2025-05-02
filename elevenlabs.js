/* -------------------------------------------------------------------
   exportElevenVoices.js
   ------------------------------------------------------------------- */
   require('dotenv').config();
   const axios = require('axios');
   const fs    = require('fs');
   
   /* 1️⃣  Always-include custom IDs */
   const EXTRA_IDS = [
     'H6QPv2pQZDcGqLwDTIJQ',
     'nfOkCwBuM5JnMhO6QvTj'
   ];
   
   /* 2️⃣  Helpers ----------------------------------------------------*/
   const friendlyAccent = raw => {
     if (!raw) return 'Unknown';
     const [code] = raw.split('-');
     const map = {
       us: 'American', gb: 'British', au: 'Australian', ca: 'Canadian',
       in: 'Indian',   hi: 'Indian',  de: 'German',     fr: 'French',
       es: 'Spanish',  pt: 'Brazilian', it: 'Italian',
       ja: 'Japanese', zh: 'Chinese'
     };
     return map[code.toLowerCase()] || raw;
   };
   const genderLabel = l => (l?.gender ?? 'unknown').toLowerCase();
   const ageLabel    = l => (l?.age    ?? 'unknown').toLowerCase();
   const greet       = n => `Hi, I am ${n}. How can I help you today?`;
   
   /* 3️⃣  Main -------------------------------------------------------*/
   (async () => {
     /* 3.a  Get the public-library catalogue */
     const { data: catalogue } = await axios.get(
       'https://api.elevenlabs.io/v1/voices',
       { headers: { 'xi-api-key': process.env.ELEVEN_API_KEY } }
     );
   
     /* 3.b  Pick the first 18 public IDs, then add the two customs */
     const publicIds = catalogue.voices.slice(0, 18).map(v => v.voice_id);
     const ids = [...new Set([...publicIds, ...EXTRA_IDS])];   // dedupe → 20 total
   
     /* 3.c  Fetch full metadata for each ID */
     const voices = await Promise.all(
       ids.map(id =>
         axios.get(`https://api.elevenlabs.io/v1/voices/${id}`, {
           headers: { 'xi-api-key': process.env.ELEVEN_API_KEY }
         }).then(r => r.data)
       )
     );
   
     /* 3.d  Map into your schema */
     const mapped = voices.map(v => ({
       voice_id:            `11labs-${v.voice_id}`,
       voice_type:          'standard',
       standard_voice_type: 'preset',
       voice_name:          v.name,
       provider:            'elevenlabs',
       accent:              friendlyAccent(v.labels?.accent),
       gender:              genderLabel(v.labels),
       age:                 ageLabel(v.labels),
       avatar_url:          null,
       preview_audio_url:   v.preview_url || v.samples?.[0]?.url || null,
       greeting_message:    greet(v.name)
     }));
   
     /* 3.e  Output */
     console.log(JSON.stringify(mapped, null, 2));
     fs.writeFileSync('elevenlabsVoices.json', JSON.stringify(mapped, null, 2));
     console.log('✅  elevenlabsVoices.json written with', mapped.length, 'voices');
   })();
   