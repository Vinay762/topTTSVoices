/* ---------------------------------------------------------------
   synthToS3.js – generate 1 greeting, upload, print public URL
   ------------------------------------------------------------- */
   require('dotenv').config();
   const sdk  = require('microsoft-cognitiveservices-speech-sdk');
   const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
   
   /* 1️⃣  Greeting builder */
   const greet = (lang, name, gender) =>
     lang === 'hi'
       ? `नमस्ते, मेरा नाम ${name} है। मैं आज आपकी कैसे मदद ${
           gender === 'male' ? 'कर सकता' : 'कर सकती'
         } हूँ?`
       : `Hi, I am ${name}. How can I help you today?`;
   
   /* 2️⃣  Main */
   (async () => {
     const voiceName = process.argv[2];
     if (!voiceName) {
       console.error('Usage: node synthToS3.js <AzureVoiceName>');
       process.exit(1);
     }
   
     /* 2.a  Parse pieces */
     const [lang] = voiceName.split('-');
     const name   = voiceName.replace(/.*-([A-Za-z]+)Neural$/, '$1');
     const gender = /(Guy|Ryan|Prabhat|Conrad|Antonio|Madhur)$/i.test(voiceName)
                    ? 'male' : 'female';
   
     /* 2.b  Synthesise greeting */
     const speechConfig = sdk.SpeechConfig.fromSubscription(
       process.env.AZURE_SPEECH_KEY,
       process.env.AZURE_SPEECH_REGION
     );
     speechConfig.speechSynthesisVoiceName   = voiceName;
     speechConfig.speechSynthesisOutputFormat =
       sdk.SpeechSynthesisOutputFormat.Audio24Khz160KBitRateMonoMp3;
   
     const synthesizer = new sdk.SpeechSynthesizer(speechConfig);
     const audioData   = await new Promise((resolve, reject) => {
       synthesizer.speakTextAsync(
         greet(lang, name, gender),
         r => r.audioData ? resolve(r.audioData) : reject(r.errorDetails),
         err => reject(err)
       );
     });
     synthesizer.close();
   
     /* 2.c  Upload to S3 (no ACL) */
     const s3  = new S3Client({ region: process.env.AWS_REGION });
     const key = `azure/${voiceName}.mp3`;
   
     await s3.send(new PutObjectCommand({
       Bucket: process.env.S3_BUCKET_NAME,
       Key:    key,
       Body:   new Uint8Array(audioData),
       ContentType: 'audio/mpeg'
     }));
     console.log('✅  Uploaded:', key);
   
     /* 2.d  Public URL (works because bucket policy allows it) */
     const url =
       `https://${process.env.S3_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`;
     console.log('Permanent URL:', url);
   })();
   