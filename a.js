/* -------------------------------------------------------------------
   exportAzureVoices.js
   ------------------------------------------------------------------- */
   require('dotenv').config();
   const sdk = require('microsoft-cognitiveservices-speech-sdk');
   const fs  = require('fs');
   
   /* 1️⃣  Voices you want to keep */
   const TOP_VOICES = [
     'en-US-AriaNeural',  'en-US-GuyNeural',   'en-US-JennyNeural',
     'en-GB-SoniaNeural', 'en-GB-RyanNeural',  'en-AU-NatashaNeural',
     'en-CA-ClaraNeural', 'en-IN-NeerjaNeural','en-IN-PrabhatNeural',
     'es-ES-ElviraNeural','es-MX-DaliaNeural', 'fr-FR-DeniseNeural',
     'fr-FR-HenriNeural', 'pt-BR-AntonioNeural','it-IT-ElsaNeural',
     'de-DE-KatjaNeural', 'de-DE-ConradNeural','ja-JP-NanamiNeural',
     'zh-CN-XiaoyiNeural','hi-IN-MadhurNeural','hi-IN-SwaraNeural',
     'hi-IN-AartiNeural'
   ];
   
   /* 2️⃣  Region → accent label */
   const regionToAccentLabel = region => {
     const map = {
       US:'American', GB:'British', AU:'Australian', CA:'Canadian', IN:'Indian',
       DE:'German',   ES:'Spanish',  FR:'French',     IT:'Italian',  PT:'Brazilian'
     };
     if (map[region]) return map[region];
     const name = new Intl.DisplayNames(['en'], { type: 'region' }).of(region);
     return name ?? region;
   };
   
   /* 3️⃣  Enum helpers */
   const enumToLower = (enumObj, value, fallback='unknown') =>
     enumObj?.[value] ? enumObj[value].toLowerCase() : fallback;
   
   /* gender mapping: 1→female, 2→male (SDK enum: 1 Female, 2 Male) */
   const genderStr = num =>
     ({ 1:'female', 2:'male', 0:'unknown', 3:'neutral' }[num] ?? 'unknown');
   
   /* 4️⃣  Greeting builder */
   const greetings = {
     en: n => `Hi, I am ${n}. How can I help you today?`,
     es: n => `Hola, soy ${n}. ¿En qué puedo ayudarte hoy?`,
     fr: n => `Bonjour, je m'appelle ${n}. Comment puis-je vous aider aujourd'hui ?`,
     pt: n => `Olá, eu sou ${n}. Como posso ajudá-lo hoje?`,
     it: n => `Ciao, sono ${n}. Come posso aiutarti oggi?`,
     de: n => `Hallo, ich bin ${n}. Wie kann ich Ihnen heute helfen?`,
     ja: n => `こんにちは、${n} です。本日どのようにお手伝いできますか？`,
     zh: n => `你好，我是${n}，今天我可以帮您做什么？`,
     hi: (n, g) =>
       `नमस्ते, मेरा नाम ${n} है। मैं आज आपकी कैसे मदद ${
         g === 'male' ? 'कर सकता' : 'कर सकती'
       } हूँ?`
   };
   const buildGreeting = (lang, name, gender) =>
     (greetings[lang] ?? greetings.en)(name, gender);
   
   /* -------------------------------------------------------------------
    * 5️⃣  Main
    * ------------------------------------------------------------------*/
   (async () => {
     const speechConfig = sdk.SpeechConfig.fromSubscription(
       process.env.AZURE_SPEECH_KEY,
       process.env.AZURE_SPEECH_REGION
     );
     const synthesizer = new sdk.SpeechSynthesizer(speechConfig);
   
     const res = await synthesizer.getVoicesAsync();
     if (res.reason !== sdk.ResultReason.VoicesListRetrieved) {
       throw new Error(`Azure voice list failed: ${res.errorDetails}`);
     }
   
     const voices = res.voices
       .filter(v => TOP_VOICES.includes(v.shortName))
       .map(v => {
         const [lang, region] = v.locale.split('-');
         const name           = v.displayName.split(',')[0];
         const genderText     = genderStr(v.gender);
         const typeText       = enumToLower(sdk.VoiceType, v.voiceType, 'neural');
   
         console.log(`${v.shortName.padEnd(24)} → gender: ${genderText}`);
   
         return {
           voice_id:            v.shortName,
           voice_type:          typeText,
           standard_voice_type: typeText,
           voice_name:          name,
           provider:            'azure',
           accent:              regionToAccentLabel(region),
           gender:              genderText,
           age:                 'Adult',
           avatar_url:          null,
           preview_audio_url:   null,
           greeting_message:    buildGreeting(lang, name, genderText)
         };
       });
   
     fs.writeFileSync('topAzureVoices.json', JSON.stringify(voices, null, 2));
     console.log('\n✅  topAzureVoices.json written with', voices.length, 'voices');
   
     synthesizer.close();
   })();
   