"use strict";
/* ============================================================
   Vlot — Inburgering A1 content pack (Phase 5)
   Ready-made decks for the Basisexamen Inburgering (A1):
   Spreken (speaking), Lezen (reading vocab), KNM (civics).
   Loaded on demand into normal Vlot decks, so they run through
   the same study / FSRS / 🔊 / 🎤 as everything else.

   Dutch here is hand-checked; source doc typos are not copied.
   A2 pack comes later (DUO A2 rules to be verified first).
   ============================================================ */

/* Exam shape, for the overview panel. Two stages: A1 (Basisexamen, done
   abroad / for residency) and A2 (Wet inburgering 2021, for naturalisation).
   A2 structure verified against DUO/inburgering.org, Sept 2026. */
const EXAM = {
  a1: {
    title: "Stage 1 · Basisexamen Inburgering (A1)",
    note: "Pass mark is per part, not an average. A1 secures residency.",
    parts: [
      { name: "Spreken (speaking)", level: "A1", detail: "10 personal questions + 12 sentence completions", pass: "≥ 6 / 10" },
      { name: "Lezen (reading)",    level: "A1", detail: "24 short-text questions", pass: "≥ 6 / 24" },
      { name: "KNM (civics)",       level: "A1", detail: "30 image questions about Dutch society", pass: "≥ 18 / 30" },
    ],
  },
  a2: {
    title: "Stage 2 · Inburgering A2 (Wet 2021)",
    note: "Five parts. A2 adds writing and listening, and speaking/reading get longer. Needed for naturalisation. ~€250.",
    parts: [
      { name: "Lezen (reading)",     level: "A2", detail: "25 questions · 65 min", pass: "computer-graded" },
      { name: "Luisteren (listening)", level: "A2", detail: "25 questions · 45 min", pass: "computer-graded" },
      { name: "Schrijven (writing)", level: "A2", detail: "1 form + 3 short texts · 40 min (pen & paper)", pass: "assessor-graded" },
      { name: "Spreken (speaking)",  level: "A2", detail: "Describe photos + give opinions, timed", pass: "assessor-graded" },
      { name: "KNM (civics)",        level: "A2", detail: "40 questions · 45 min", pass: "computer-graded" },
    ],
  },
};

/* Each pack becomes one deck. Cards use the normal Vlot fields. */
const PACKS = [
  {
    id: "spreken-vragen",
    deck: "Inburgering · Spreken (vragen)",
    level: "A1",
    part: "spreken",
    icon: "🗣️",
    title: "Speaking — personal questions",
    blurb: "The examiner's personal questions. Study the question, then say a model answer out loud (🎤).",
    cards: [
      { word: "Wat is uw naam?", trans: "What is your name?", sentence: "Mijn naam is Cesar.", sentenceTrans: "My name is Cesar.", notes: "Answer with your own name.", category: "Spreken · vragen" },
      { word: "Waar komt u vandaan?", trans: "Where are you from?", sentence: "Ik kom uit Brazilië.", sentenceTrans: "I am from Brazil.", notes: "Use your own country.", category: "Spreken · vragen" },
      { word: "Wanneer bent u geboren?", trans: "When were you born?", sentence: "Ik ben geboren op 3 mei 1990.", sentenceTrans: "I was born on 3 May 1990.", notes: "Use your own date.", category: "Spreken · vragen" },
      { word: "Waar bent u geboren?", trans: "Where were you born?", sentence: "Ik ben geboren in São Paulo.", sentenceTrans: "I was born in São Paulo.", notes: "Use your own city.", category: "Spreken · vragen" },
      { word: "Hoeveel broers en zussen heeft u?", trans: "How many brothers and sisters do you have?", sentence: "Ik heb een broer en twee zussen.", sentenceTrans: "I have one brother and two sisters.", category: "Spreken · vragen" },
      { word: "Hoe laat staat u op?", trans: "What time do you get up?", sentence: "Ik sta om zeven uur op.", sentenceTrans: "I get up at seven o'clock.", notes: "Separable verb: opstaan → sta … op.", category: "Spreken · vragen" },
      { word: "Wat eet u graag?", trans: "What do you like to eat?", sentence: "Ik eet graag pasta.", sentenceTrans: "I like to eat pasta.", category: "Spreken · vragen" },
      { word: "Wat is uw beroep?", trans: "What is your profession?", sentence: "Ik ben verpleegkundige.", sentenceTrans: "I am a nurse.", notes: "No 'een' before a profession: 'Ik ben leraar.'", category: "Spreken · vragen" },
      { word: "Hoeveel uur werkt u per dag?", trans: "How many hours do you work per day?", sentence: "Ik werk acht uur per dag.", sentenceTrans: "I work eight hours per day.", notes: "'uur' stays singular after a number.", category: "Spreken · vragen" },
      { word: "Bent u getrouwd?", trans: "Are you married?", sentence: "Ja, ik ben getrouwd.", sentenceTrans: "Yes, I am married.", notes: "Or: 'Nee, ik ben niet getrouwd.'", category: "Spreken · vragen" },
      { word: "Hoeveel kinderen heeft u?", trans: "How many children do you have?", sentence: "Ik heb twee kinderen.", sentenceTrans: "I have two children.", notes: "One child: 'Ik heb één kind.'", category: "Spreken · vragen" },
      { word: "Wat doet u graag in uw vrije tijd?", trans: "What do you like to do in your free time?", sentence: "In mijn vrije tijd hou ik van fietsen.", sentenceTrans: "In my free time I like cycling.", category: "Spreken · vragen" },
      { word: "Houdt u van sport?", trans: "Do you like sport?", sentence: "Ja, ik hou van voetbal.", sentenceTrans: "Yes, I like football.", category: "Spreken · vragen" },
      { word: "Waar woont u?", trans: "Where do you live?", sentence: "Ik woon in Utrecht.", sentenceTrans: "I live in Utrecht.", notes: "Use your own city.", category: "Spreken · vragen" },
      { word: "Hoe lang woont u hier al?", trans: "How long have you lived here?", sentence: "Ik woon hier al drie jaar.", sentenceTrans: "I have lived here for three years.", notes: "'al' = already; keep present tense.", category: "Spreken · vragen" },
    ],
  },
  {
    id: "spreken-zinnen",
    deck: "Inburgering · Spreken (zin afmaken)",
    level: "A1",
    part: "spreken",
    icon: "✍️",
    title: "Speaking — complete the sentence",
    blurb: "Finish each opener with 1–2 words that fit. Study the model, then say your own version.",
    cards: [
      { word: "Ik eet 's ochtends…", trans: "In the morning I eat…", sentence: "Ik eet 's ochtends graag brood met kaas.", sentenceTrans: "In the morning I like to eat bread with cheese.", notes: "Add: …een boterham / …pap.", category: "Spreken · zinnen" },
      { word: "Ik ga naar…", trans: "I go to…", sentence: "Ik ga naar mijn werk.", sentenceTrans: "I go to my work.", notes: "Add: …de winkel / …school.", category: "Spreken · zinnen" },
      { word: "Ik spreek Nederlands…", trans: "I speak Dutch…", sentence: "Ik spreek een beetje Nederlands.", sentenceTrans: "I speak a little Dutch.", notes: "Add: …nog niet zo goed.", category: "Spreken · zinnen" },
      { word: "Op maandag ga ik…", trans: "On Monday I go…", sentence: "Op maandag ga ik werken.", sentenceTrans: "On Monday I go to work.", notes: "After a time word the verb comes before 'ik'.", category: "Spreken · zinnen" },
      { word: "Voor het ontbijt eet ik…", trans: "For breakfast I eat…", sentence: "Voor het ontbijt eet ik brood met jam.", sentenceTrans: "For breakfast I eat bread with jam.", category: "Spreken · zinnen" },
      { word: "In de winter…", trans: "In winter…", sentence: "In de winter is het koud.", sentenceTrans: "In winter it is cold.", notes: "Add: …sneeuwt het soms.", category: "Spreken · zinnen" },
      { word: "Ik woon in…", trans: "I live in…", sentence: "Ik woon in een appartement.", sentenceTrans: "I live in an apartment.", notes: "Add: …Nederland / …Amsterdam.", category: "Spreken · zinnen" },
      { word: "Ik hou van…", trans: "I like…", sentence: "Ik hou van lezen.", sentenceTrans: "I like reading.", notes: "Add: …fietsen / …koffie.", category: "Spreken · zinnen" },
      { word: "Na het werk ga ik…", trans: "After work I go…", sentence: "Na het werk ga ik naar huis.", sentenceTrans: "After work I go home.", notes: "Add: …sporten / …boodschappen doen.", category: "Spreken · zinnen" },
      { word: "Mijn kinderen gaan naar…", trans: "My children go to…", sentence: "Mijn kinderen gaan naar school.", sentenceTrans: "My children go to school.", notes: "Add: …de kinderopvang.", category: "Spreken · zinnen" },
      { word: "We gaan met de… naar Amsterdam.", trans: "We go to Amsterdam by…", sentence: "We gaan met de trein naar Amsterdam.", sentenceTrans: "We go to Amsterdam by train.", notes: "Add: …bus / …auto.", category: "Spreken · zinnen" },
      { word: "Vandaag ben ik…", trans: "Today I am…", sentence: "Vandaag ben ik een beetje moe.", sentenceTrans: "Today I am a bit tired.", notes: "Add: …blij / …ziek.", category: "Spreken · zinnen" },
    ],
  },
  {
    id: "lezen-woorden",
    deck: "Inburgering · Lezen (basiswoorden)",
    level: "A1",
    part: "lezen",
    icon: "📖",
    title: "Reading — core vocabulary",
    blurb: "The high-frequency words that carry the reading texts: numbers, time, family, work, food, places, verbs.",
    cards: [
      // numbers
      { word: "nul", trans: "zero", category: "Getallen" }, { word: "een", trans: "one", category: "Getallen" },
      { word: "twee", trans: "two", category: "Getallen" }, { word: "drie", trans: "three", category: "Getallen" },
      { word: "vier", trans: "four", category: "Getallen" }, { word: "vijf", trans: "five", category: "Getallen" },
      { word: "zes", trans: "six", category: "Getallen" }, { word: "zeven", trans: "seven", category: "Getallen" },
      { word: "acht", trans: "eight", category: "Getallen" }, { word: "negen", trans: "nine", category: "Getallen" },
      { word: "tien", trans: "ten", category: "Getallen" }, { word: "elf", trans: "eleven", category: "Getallen" },
      { word: "twaalf", trans: "twelve", category: "Getallen" }, { word: "twintig", trans: "twenty", category: "Getallen" },
      { word: "honderd", trans: "hundred", category: "Getallen" },
      // time
      { word: "dag", trans: "day", pos: "noun", article: "de", category: "Tijd" },
      { word: "week", trans: "week", pos: "noun", article: "de", category: "Tijd" },
      { word: "maand", trans: "month", pos: "noun", article: "de", category: "Tijd" },
      { word: "jaar", trans: "year", pos: "noun", article: "het", category: "Tijd" },
      { word: "ochtend", trans: "morning", pos: "noun", article: "de", category: "Tijd" },
      { word: "middag", trans: "afternoon", pos: "noun", article: "de", category: "Tijd" },
      { word: "avond", trans: "evening", pos: "noun", article: "de", category: "Tijd" },
      { word: "nacht", trans: "night", pos: "noun", article: "de", category: "Tijd" },
      // family
      { word: "man", trans: "man / husband", pos: "noun", article: "de", category: "Familie" },
      { word: "vrouw", trans: "woman / wife", pos: "noun", article: "de", category: "Familie" },
      { word: "kind", trans: "child", pos: "noun", article: "het", category: "Familie" },
      { word: "zoon", trans: "son", pos: "noun", article: "de", category: "Familie" },
      { word: "dochter", trans: "daughter", pos: "noun", article: "de", category: "Familie" },
      { word: "broer", trans: "brother", pos: "noun", article: "de", category: "Familie" },
      { word: "zus", trans: "sister", pos: "noun", article: "de", category: "Familie" },
      { word: "vader", trans: "father", pos: "noun", article: "de", category: "Familie" },
      { word: "moeder", trans: "mother", pos: "noun", article: "de", category: "Familie" },
      // work
      { word: "werk", trans: "work", pos: "noun", article: "het", category: "Werk" },
      { word: "kantoor", trans: "office", pos: "noun", article: "het", category: "Werk" },
      { word: "school", trans: "school", pos: "noun", article: "de", category: "Werk" },
      { word: "bedrijf", trans: "company", pos: "noun", article: "het", category: "Werk" },
      { word: "dokter", trans: "doctor", pos: "noun", article: "de", category: "Werk" },
      { word: "leraar", trans: "teacher", pos: "noun", article: "de", category: "Werk" },
      // food
      { word: "brood", trans: "bread", pos: "noun", article: "het", category: "Eten" },
      { word: "kaas", trans: "cheese", pos: "noun", article: "de", category: "Eten" },
      { word: "melk", trans: "milk", pos: "noun", article: "de", category: "Eten" },
      { word: "boter", trans: "butter", pos: "noun", article: "de", category: "Eten" },
      { word: "koffie", trans: "coffee", pos: "noun", article: "de", category: "Eten" },
      { word: "thee", trans: "tea", pos: "noun", article: "de", category: "Eten" },
      { word: "appel", trans: "apple", pos: "noun", article: "de", category: "Eten" },
      // places
      { word: "huis", trans: "house", pos: "noun", article: "het", category: "Plaatsen" },
      { word: "appartement", trans: "apartment", pos: "noun", article: "het", category: "Plaatsen" },
      { word: "supermarkt", trans: "supermarket", pos: "noun", article: "de", category: "Plaatsen" },
      { word: "winkel", trans: "shop", pos: "noun", article: "de", category: "Plaatsen" },
      { word: "straat", trans: "street", pos: "noun", article: "de", category: "Plaatsen" },
      { word: "stad", trans: "city", pos: "noun", article: "de", category: "Plaatsen" },
      { word: "land", trans: "country", pos: "noun", article: "het", category: "Plaatsen" },
      // verbs
      { word: "gaan", trans: "to go", pos: "verb", category: "Werkwoorden" },
      { word: "kopen", trans: "to buy", pos: "verb", category: "Werkwoorden" },
      { word: "eten", trans: "to eat", pos: "verb", category: "Werkwoorden" },
      { word: "drinken", trans: "to drink", pos: "verb", category: "Werkwoorden" },
      { word: "werken", trans: "to work", pos: "verb", category: "Werkwoorden" },
      { word: "wonen", trans: "to live (reside)", pos: "verb", category: "Werkwoorden" },
      { word: "lezen", trans: "to read", pos: "verb", category: "Werkwoorden" },
      { word: "spreken", trans: "to speak", pos: "verb", category: "Werkwoorden" },
    ],
  },
  {
    id: "knm-civics",
    deck: "Inburgering · KNM (maatschappij)",
    level: "A1",
    part: "knm",
    icon: "🏛️",
    title: "KNM — knowledge of Dutch society",
    blurb: "Civics facts across the 9 KNM modules. Study the question, reveal the answer.",
    cards: [
      // government
      { word: "How many seats does the Tweede Kamer have?", trans: "150", category: "KNM · Overheid" },
      { word: "The King's role in Dutch government?", trans: "Symbolic — national unity, not governing.", category: "KNM · Overheid" },
      { word: "How often are Tweede Kamer elections held?", trans: "Every 4 years.", category: "KNM · Overheid" },
      { word: "From what age can you vote in the Netherlands?", trans: "18.", category: "KNM · Overheid" },
      { word: "How are the 150 Tweede Kamer members chosen?", trans: "Directly elected by the people (proportional).", category: "KNM · Overheid" },
      { word: "A fundamental right in the Netherlands?", trans: "Freedom of expression (and religion).", category: "KNM · Overheid" },
      // education
      { word: "Dutch primary school is called…?", trans: "Basisschool (grades are 'groep').", category: "KNM · Onderwijs" },
      { word: "Education is free until what age?", trans: "18.", category: "KNM · Onderwijs" },
      { word: "The three secondary tracks after basisschool?", trans: "VMBO, HAVO, VWO.", category: "KNM · Onderwijs" },
      // health
      { word: "A Dutch general practitioner is called…?", trans: "Huisarts.", category: "KNM · Gezondheid" },
      { word: "Is health insurance mandatory?", trans: "Yes — everyone must have a basisverzekering.", category: "KNM · Gezondheid" },
      { word: "Can you see a specialist without a referral?", trans: "No — you need a referral from your huisarts.", category: "KNM · Gezondheid" },
      // work
      { word: "The Dutch state pension is called…?", trans: "AOW (from around age 67).", category: "KNM · Werk" },
      { word: "A permanent employment contract is a…?", trans: "Vast contract.", category: "KNM · Werk" },
      { word: "Someone self-employed is a…?", trans: "Zzp'er / zelfstandige.", category: "KNM · Werk" },
      // housing & society
      { word: "Dutch attitude to time?", trans: "Punctuality matters — be on time.", category: "KNM · Samenleving" },
      { word: "Typical rule about noise at home?", trans: "Keep it quiet after 10 p.m.", category: "KNM · Samenleving" },
      { word: "'Gezelligheid' means…?", trans: "A cosy, sociable, warm atmosphere.", category: "KNM · Samenleving" },
      // transport
      { word: "The main means of transport in the Netherlands?", trans: "The bicycle (de fiets).", category: "KNM · Vervoer" },
      { word: "The card for public transport is called…?", trans: "OV-chipkaart.", category: "KNM · Vervoer" },
      { word: "The national railway company is…?", trans: "NS (Nederlandse Spoorwegen).", category: "KNM · Vervoer" },
      // culture
      { word: "The biggest national celebration?", trans: "Koningsdag (King's Day, 27 April).", category: "KNM · Cultuur" },
      { word: "The Dutch tradition like Santa Claus?", trans: "Sinterklaas (early December).", category: "KNM · Cultuur" },
      { word: "Liberation Day (WWII) is on…?", trans: "5 May (Bevrijdingsdag).", category: "KNM · Cultuur" },
      // history
      { word: "The Dutch 'Golden Age' was in which century?", trans: "The 1600s (17th century).", category: "KNM · Geschiedenis" },
      { word: "The Netherlands was liberated from Nazi occupation in…?", trans: "1945.", category: "KNM · Geschiedenis" },
      { word: "Anne Frank is known for…?", trans: "Her diary written in hiding during WWII.", category: "KNM · Geschiedenis" },
      // geography
      { word: "The capital of the Netherlands?", trans: "Amsterdam (government sits in Den Haag).", category: "KNM · Geografie" },
      { word: "How many provinces does the Netherlands have?", trans: "12.", category: "KNM · Geografie" },
      { word: "Main natural risk, being partly below sea level?", trans: "Flooding — held back by dikes.", category: "KNM · Geografie" },
    ],
  },

  /* ---------- A2 (Wet inburgering 2021) ---------- */
  {
    id: "a2-spreken",
    deck: "Inburgering A2 · Spreken",
    level: "A2",
    part: "spreken",
    icon: "🗣️",
    title: "A2 Speaking — describe & give opinions",
    blurb: "Longer answers: describe a photo, say what you did, give an opinion. Study the model, then say your own (🎤).",
    cards: [
      { word: "Vertel iets over deze foto.", trans: "Tell me something about this photo.", sentence: "Op de foto zie ik een gezin in het park. Het is mooi weer en de kinderen spelen.", sentenceTrans: "In the photo I see a family in the park. The weather is nice and the children are playing.", notes: "Say what you see + one extra detail.", category: "A2 · Spreken" },
      { word: "Wat heeft u gisteren gedaan?", trans: "What did you do yesterday?", sentence: "Gisteren heb ik gewerkt en daarna heb ik boodschappen gedaan.", sentenceTrans: "Yesterday I worked and afterwards I did some shopping.", notes: "Perfect tense: heb + …gedaan/gewerkt.", category: "A2 · Spreken" },
      { word: "Wat gaat u dit weekend doen?", trans: "What are you going to do this weekend?", sentence: "Dit weekend ga ik mijn familie bezoeken en misschien naar de markt.", sentenceTrans: "This weekend I'm going to visit my family and maybe go to the market.", notes: "gaan + infinitive for the future.", category: "A2 · Spreken" },
      { word: "Wat vindt u van sporten?", trans: "What do you think of sport?", sentence: "Ik vind sporten belangrijk, want het is goed voor je gezondheid.", sentenceTrans: "I think sport is important, because it's good for your health.", notes: "Give an opinion + a reason with 'want'.", category: "A2 · Spreken" },
      { word: "Kunt u de weg naar het station uitleggen?", trans: "Can you explain the way to the station?", sentence: "U gaat rechtdoor en dan de tweede straat links. Het station is aan uw rechterhand.", sentenceTrans: "You go straight ahead and then the second street on the left. The station is on your right.", category: "A2 · Spreken" },
      { word: "Waarom leert u Nederlands?", trans: "Why are you learning Dutch?", sentence: "Ik leer Nederlands omdat ik in Nederland woon en wil inburgeren.", sentenceTrans: "I'm learning Dutch because I live in the Netherlands and want to integrate.", notes: "'omdat' sends the verb to the end.", category: "A2 · Spreken" },
      { word: "Beschrijf een gewone dag.", trans: "Describe an ordinary day.", sentence: "'s Ochtends breng ik de kinderen naar school. Daarna werk ik en 's avonds kook ik.", sentenceTrans: "In the morning I take the children to school. Then I work and in the evening I cook.", category: "A2 · Spreken" },
      { word: "Wat voor werk zou u graag willen doen?", trans: "What kind of work would you like to do?", sentence: "Ik zou graag in de zorg willen werken, omdat ik mensen graag help.", sentenceTrans: "I would like to work in healthcare, because I like helping people.", notes: "'zou … willen' = would like to.", category: "A2 · Spreken" },
    ],
  },
  {
    id: "a2-schrijven",
    deck: "Inburgering A2 · Schrijven",
    level: "A2",
    part: "schrijven",
    icon: "✉️",
    title: "A2 Writing — email & message building blocks",
    blurb: "Fixed phrases for the writing exam: forms, short messages and emails. Learn the Dutch for each function.",
    cards: [
      { word: "Start a formal email", trans: "Geachte heer/mevrouw,", notes: "Use when you don't know the name.", category: "A2 · Schrijven" },
      { word: "Start an informal message", trans: "Hoi [naam],", category: "A2 · Schrijven" },
      { word: "Say why you're writing", trans: "Ik schrijf u omdat…", category: "A2 · Schrijven" },
      { word: "Make an appointment", trans: "Ik wil graag een afspraak maken.", category: "A2 · Schrijven" },
      { word: "Cancel / move an appointment", trans: "Helaas kan ik niet komen. Kan de afspraak worden verzet?", category: "A2 · Schrijven" },
      { word: "Ask something politely", trans: "Zou u mij kunnen laten weten…?", category: "A2 · Schrijven" },
      { word: "Report you're sick (to work)", trans: "Ik ben ziek en kan vandaag niet werken.", category: "A2 · Schrijven" },
      { word: "Apologise", trans: "Sorry voor het ongemak.", category: "A2 · Schrijven" },
      { word: "Thank someone", trans: "Bedankt voor uw reactie.", category: "A2 · Schrijven" },
      { word: "Close a formal email", trans: "Met vriendelijke groet, [naam]", category: "A2 · Schrijven" },
      { word: "Close an informal message", trans: "Groetjes, [naam]", category: "A2 · Schrijven" },
      { word: "Form field: date of birth", trans: "Geboortedatum: [dd-mm-jjjj]", category: "A2 · Schrijven" },
    ],
  },
  {
    id: "a2-woorden",
    deck: "Inburgering A2 · Woorden",
    level: "A2",
    part: "lezen",
    icon: "📘",
    title: "A2 vocabulary — connectors, past tense & daily life",
    blurb: "The A2 step up: linking words, common past participles, and everyday admin vocabulary.",
    cards: [
      // connectors
      { word: "omdat", trans: "because", notes: "sends verb to the end", category: "A2 · Verbindingswoorden" },
      { word: "want", trans: "because / for", category: "A2 · Verbindingswoorden" },
      { word: "maar", trans: "but", category: "A2 · Verbindingswoorden" },
      { word: "dus", trans: "so", category: "A2 · Verbindingswoorden" },
      { word: "daarna", trans: "after that", category: "A2 · Verbindingswoorden" },
      { word: "terwijl", trans: "while", category: "A2 · Verbindingswoorden" },
      { word: "hoewel", trans: "although", category: "A2 · Verbindingswoorden" },
      { word: "toen", trans: "when (in the past)", category: "A2 · Verbindingswoorden" },
      // past participles
      { word: "gedaan", trans: "done", notes: "van 'doen'", category: "A2 · Voltooid deelwoord" },
      { word: "geweest", trans: "been", notes: "van 'zijn'", category: "A2 · Voltooid deelwoord" },
      { word: "gegaan", trans: "gone", notes: "van 'gaan'", category: "A2 · Voltooid deelwoord" },
      { word: "gehad", trans: "had", notes: "van 'hebben'", category: "A2 · Voltooid deelwoord" },
      { word: "gezien", trans: "seen", notes: "van 'zien'", category: "A2 · Voltooid deelwoord" },
      { word: "gekocht", trans: "bought", notes: "van 'kopen'", category: "A2 · Voltooid deelwoord" },
      { word: "gebracht", trans: "brought", notes: "van 'brengen'", category: "A2 · Voltooid deelwoord" },
      { word: "gesproken", trans: "spoken", notes: "van 'spreken'", category: "A2 · Voltooid deelwoord" },
      // daily-life / admin
      { word: "afspraak", trans: "appointment", pos: "noun", article: "de", category: "A2 · Dagelijks leven" },
      { word: "rekening", trans: "bill / account", pos: "noun", article: "de", category: "A2 · Dagelijks leven" },
      { word: "verzekering", trans: "insurance", pos: "noun", article: "de", category: "A2 · Dagelijks leven" },
      { word: "gemeente", trans: "municipality", pos: "noun", article: "de", category: "A2 · Dagelijks leven" },
      { word: "buurt", trans: "neighbourhood", pos: "noun", article: "de", category: "A2 · Dagelijks leven" },
      { word: "vergadering", trans: "meeting", pos: "noun", article: "de", category: "A2 · Dagelijks leven" },
      { word: "formulier", trans: "form", pos: "noun", article: "het", category: "A2 · Dagelijks leven" },
      { word: "huur", trans: "rent", pos: "noun", article: "de", category: "A2 · Dagelijks leven" },
      { word: "solliciteren", trans: "to apply for a job", pos: "verb", category: "A2 · Dagelijks leven" },
      { word: "afspreken", trans: "to arrange / agree", pos: "verb", category: "A2 · Dagelijks leven" },
    ],
  },
  {
    id: "a2-knm",
    deck: "Inburgering A2 · KNM",
    level: "A2",
    part: "knm",
    icon: "🏛️",
    title: "A2 KNM — deeper civics & admin",
    blurb: "The bigger 40-question KNM: how Dutch admin, benefits and daily systems actually work.",
    cards: [
      { word: "What is your BSN?", trans: "Burgerservicenummer — your citizen service number.", category: "A2 · KNM" },
      { word: "What is DigiD used for?", trans: "Logging in to Dutch government websites.", category: "A2 · KNM" },
      { word: "Where do you register a new address?", trans: "At the gemeente (municipality).", category: "A2 · KNM" },
      { word: "What is 'zorgtoeslag'?", trans: "Healthcare allowance — help paying your insurance.", category: "A2 · KNM" },
      { word: "What is 'huurtoeslag'?", trans: "Rent benefit for lower incomes.", category: "A2 · KNM" },
      { word: "Who leads the government (not the King)?", trans: "The minister-president (Prime Minister).", category: "A2 · KNM" },
      { word: "What is the 'Belastingdienst'?", trans: "The Dutch tax authority.", category: "A2 · KNM" },
      { word: "What is a 'sollicitatiegesprek'?", trans: "A job interview.", category: "A2 · KNM" },
      { word: "Where does glass waste go?", trans: "In the glasbak (glass container).", category: "A2 · KNM" },
      { word: "What does a 'huisarts' do first?", trans: "Acts as gatekeeper — refers you to specialists.", category: "A2 · KNM" },
      { word: "What is the 'eigen risico' in healthcare?", trans: "The excess you pay yourself before insurance covers costs.", category: "A2 · KNM" },
      { word: "How many questions are in the A2 KNM exam?", trans: "40, in 45 minutes.", category: "A2 · KNM" },
    ],
  },
];

window.VlotInburgering = { EXAM, PACKS };
