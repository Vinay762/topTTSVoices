/* --------------------------------------------------------------
   bulkSynthToS3.js – batch‑create preview clips + update JSON
   ------------------------------------------------------------*/
   import fs from 'fs/promises';
   import path from 'path';
   import dotenv from 'dotenv';
   import pLimit from 'p-limit';
   import sdk from 'microsoft-cognitiveservices-speech-sdk';
   import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
   
   dotenv.config();                 // pulls AZURE_* , AWS_REGION, S3_BUCKET_NAME
   
   /** CLI: node bulkSynthToS3.js input.json [output.json] */
   const [,, inFile = 'topAzureVoices.json', outFile = inFile] = process.argv;
   
   /* ---------- helpers ------------------------------------------------------ */
   const s3      = new S3Client({ region: process.env.AWS_REGION });
   const limit   = pLimit(4);       // Azure free tier = 20 req/s; keep it polite
   const synth   = (voiceId, text) => new Promise((resolve, reject) => {
     const speechConfig = sdk.SpeechConfig.fromSubscription(
       process.env.AZURE_SPEECH_KEY,
       process.env.AZURE_SPEECH_REGION
     );
     speechConfig.speechSynthesisVoiceName    = voiceId;
     speechConfig.speechSynthesisOutputFormat =
       sdk.SpeechSynthesisOutputFormat.Audio24Khz160KBitRateMonoMp3;
   
     const ss = new sdk.SpeechSynthesizer(speechConfig);
     ss.speakTextAsync(
       text,
       r => r.audioData ? (ss.close(), resolve(r.audioData))
                        : (ss.close(), reject(r.errorDetails)),
       err => (ss.close(), reject(err))
     );
   });
   
   const upload = async (voiceId, audio) => {
     const key = `azure/${voiceId}.mp3`;
     await s3.send(new PutObjectCommand({
       Bucket: process.env.S3_BUCKET_NAME,
       Key:    key,
       Body:   new Uint8Array(audio),
       ContentType: 'audio/mpeg'
     }));
     return `https://${process.env.S3_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`;
   };
   
   /* ---------- main --------------------------------------------------------- */
   const voices = JSON.parse(await fs.readFile(inFile, 'utf8'));
   
   await Promise.all(voices.map(v => limit(async () => {
     /* skip if already present */
     if (v.preview_audio_url) return;
   
     const audio = await synth(v.voice_id, v.greeting_message);
     v.preview_audio_url = await upload(v.voice_id, audio);
   
     console.log(`✅ ${v.voice_id} → ${v.preview_audio_url}`);
   })));
   
   await fs.writeFile(outFile, JSON.stringify(voices, null, 2) + '\n');
   console.log(`\n🎉  Done. Updated file: ${path.resolve(outFile)}`);
   