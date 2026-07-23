import { query } from './db';

export async function initDb() {
  try {
    console.log('Initializing database tables...');

    // Each statement must be its own query() call — pg does not support multi-statement strings
    await query(`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await query(`
      CREATE TABLE IF NOT EXISTS profiles (
        id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
        email TEXT,
        first_name TEXT,
        last_name TEXT,
        target_exam TEXT,
        exam_date TEXT,
        avatar_url TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await query(`
      CREATE TABLE IF NOT EXISTS settings (
        id TEXT PRIMARY KEY,
        value TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await query(`
      CREATE TABLE IF NOT EXISTS questions (
        id TEXT PRIMARY KEY,
        type TEXT,
        topic TEXT,
        data JSONB,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await query(`
      CREATE TABLE IF NOT EXISTS email_templates (
        id TEXT PRIMARY KEY,
        subject TEXT,
        html TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await query(`
      CREATE TABLE IF NOT EXISTS submissions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        email TEXT NOT NULL,
        exam_type TEXT,
        score TEXT,
        max_score TEXT,
        time_taken TEXT,
        answers JSONB,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await query(`
      CREATE TABLE IF NOT EXISTS curriculum_documents (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        topic TEXT NOT NULL,
        filename TEXT NOT NULL,
        year TEXT NOT NULL,
        text_content TEXT NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Column migrations — each ALTER TABLE is its own call
    await query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_token TEXT`);
    await query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_token_expires_at TIMESTAMP WITH TIME ZONE`);
    await query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS welcome_token TEXT`);
    await query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS welcome_token_expires_at TIMESTAMP WITH TIME ZONE`);
    await query(`ALTER TABLE questions ADD COLUMN IF NOT EXISTS paper TEXT`);
    await query(`ALTER TABLE questions ADD COLUMN IF NOT EXISTS year TEXT`);
    await query(`ALTER TABLE questions ADD COLUMN IF NOT EXISTS question_label TEXT`);
    await query(`ALTER TABLE questions ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP`);
    await query(`ALTER TABLE questions ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP`);

    // Normalize profiles columns (critical — these are what admin user list queries use)
    await query(`ALTER TABLE profiles ADD COLUMN IF NOT EXISTS first_name TEXT`);
    await query(`ALTER TABLE profiles ADD COLUMN IF NOT EXISTS last_name TEXT`);
    await query(`ALTER TABLE profiles ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'student'`);
    await query(`ALTER TABLE profiles ADD COLUMN IF NOT EXISTS tier TEXT DEFAULT 'free'`);
    await query(`ALTER TABLE profiles ADD COLUMN IF NOT EXISTS tier_expiry TIMESTAMP WITH TIME ZONE`);
    await query(`ALTER TABLE profiles ADD COLUMN IF NOT EXISTS joined TEXT`);
    await query(`ALTER TABLE profiles ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP`);

    // Migrate data from any old camelCase columns if they exist
    await query(`
      DO $$
      BEGIN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='firstName') THEN
          UPDATE profiles SET first_name = "firstName" WHERE first_name IS NULL;
        END IF;
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='lastName') THEN
          UPDATE profiles SET last_name = "lastName" WHERE last_name IS NULL;
        END IF;
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='tierExpiry') THEN
          UPDATE profiles SET tier_expiry = "tierExpiry"::timestamp with time zone WHERE tier_expiry IS NULL;
        END IF;
      END $$
    `);
    await query("UPDATE questions SET paper = 'OSCE' WHERE type = 'OSCE'");
    await query("UPDATE questions SET year = 'AI' WHERE type = 'OSCE' AND year = '2026'");
    await query("UPDATE questions SET paper = 'OSCE' WHERE paper LIKE 'OSCE Bank%'");

    // Standardize OSCE instructions
    const osceRes = await query("SELECT id, topic, data FROM questions WHERE type = 'OSCE'");
    const INSTRUCTIONS_BY_TOPIC = {
      "Cataract": "Examine the clinical presentation and slit-lamp findings. Identify the complications, discuss your differential diagnosis, and outline your immediate surgical and medical management plan.",
      "Cornea and External Eye": "Examine the slit-lamp findings and any corneal imaging provided. Describe the abnormalities, state the most likely diagnosis, and discuss your immediate treatment strategy.",
      "Glaucoma": "Examine the clinical presentation and imaging findings. Identify the pathology, discuss the mechanism, and outline your immediate and long-term management plan.",
      "Ocular Inflammation": "Examine the clinical presentation and fundus findings. Describe the inflammatory phenotype, state the diagnosis, and outline your investigation and treatment plan.",
      "Vitreoretinal": "Examine the fundus photographs and optical coherence tomography. Describe the clinical findings, discuss the mechanism of the pathology, and outline your management options.",
      "Neuro-ophthalmology": "Examine the clinical presentation and neuroimaging. Describe the abnormalities, localise the lesion, and outline your immediate investigation and management priorities.",
      "Ocular Motility": "Examine the motility photographs and any neuroimaging provided. Describe the abnormalities, identify the clinical syndrome, and outline your immediate and long-term management.",
      "Paediatrics": "Examine the clinical presentation and imaging findings. State the diagnosis, outline the key risks, and discuss your investigation and treatment plan.",
      "Oculoplastics and Orbit": "Examine the clinical presentation and orbital imaging. Describe the abnormalities, state the diagnosis, and discuss your immediate and long-term management plan."
    };

    for (const row of osceRes.rows) {
      const qData = row.data;
      if (qData && qData.scenario) {
        let demographics = "";
        let va = "";
        let iop = "";
        let images = "";
        
        const lines = qData.scenario.split('\n');
        for (const line of lines) {
          const lower = line.toLowerCase();
          if (lower.includes('demographics:')) {
            demographics = line.replace(/\*\*Demographics:\*\*/i, '').trim();
          } else if (lower.includes('visual acuity:')) {
            va = line.replace(/\*\*Visual Acuity:\*\*/i, '').trim();
          } else if (lower.includes('intraocular pressure:')) {
            iop = line.replace(/\*\*Intraocular Pressure:\*\*/i, '').trim();
          } else if (line.trim().startsWith('!') || line.trim().startsWith('[')) {
            images += line + '\n';
          }
        }
        
        const topic = row.topic || "Cataract";
        const instruction = INSTRUCTIONS_BY_TOPIC[topic] || INSTRUCTIONS_BY_TOPIC["Cataract"];
        
        let newScenario = "";
        if (demographics) newScenario += `**Demographics:** ${demographics}\n`;
        if (va) newScenario += `**Visual Acuity:** ${va}\n`;
        if (iop) newScenario += `**Intraocular Pressure:** ${iop}\n`;
        newScenario += `**Primary Instruction:** ${instruction}\n\n`;
        if (images) {
          newScenario += `**Clinical Images:**\n${images.trim()}`;
        }
        
        qData.scenario = newScenario.trim();
        await query("UPDATE questions SET data = $1 WHERE id = $2", [JSON.stringify(qData), row.id]);
      }
    }

    // Load and insert mock OSCE volumes automatically
    const seedVolume = async (num: number) => {
      try {
        const fs = require('fs');
        const path = require('path');
        let volPath = path.join(__dirname, `../../volume${num}_questions.json`);
        if (!fs.existsSync(volPath)) {
          volPath = path.join(__dirname, `../volume${num}_questions.json`);
        }
        if (fs.existsSync(volPath)) {
          const volData = JSON.parse(fs.readFileSync(volPath, 'utf-8'));
          for (const q of volData) {
            await query(
              `INSERT INTO questions (id, type, topic, paper, year, data)
               VALUES ($1, $2, $3, $4, $5, $6)
               ON CONFLICT (id) DO UPDATE 
               SET type = EXCLUDED.type, topic = EXCLUDED.topic, paper = EXCLUDED.paper, year = EXCLUDED.year, data = EXCLUDED.data`,
              [q.id, q.type, q.topic, q.paper, q.year, JSON.stringify(q.data)]
            );
          }
          console.log(`Auto-seeded ${volData.length} Volume ${num} OSCE questions.`);
        }
      } catch (e) {
        console.error(`Error auto-seeding Volume ${num} questions:`, e);
      }
    };

    const seedJsonFile = async (fileName: string) => {
      try {
        const fs = require('fs');
        const path = require('path');
        let jsonPath = path.join(__dirname, `../../${fileName}`);
        if (!fs.existsSync(jsonPath)) {
          jsonPath = path.join(__dirname, `../${fileName}`);
        }
        if (!fs.existsSync(jsonPath)) {
          jsonPath = path.join(process.cwd(), fileName);
        }
        if (fs.existsSync(jsonPath)) {
          const dataArr = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
          for (const q of dataArr) {
            await query(
              `INSERT INTO questions (id, type, topic, paper, year, data)
               VALUES ($1, $2, $3, $4, $5, $6)
               ON CONFLICT (id) DO UPDATE 
               SET type = EXCLUDED.type, topic = EXCLUDED.topic, paper = EXCLUDED.paper, year = EXCLUDED.year, data = EXCLUDED.data`,
              [q.id, q.type, q.topic, q.paper, q.year, JSON.stringify(q.data)]
            );
          }
          console.log(`Auto-seeded ${dataArr.length} questions from ${fileName}.`);
        }
      } catch (e) {
        console.error(`Error auto-seeding ${fileName}:`, e);
      }
    };

    await seedVolume(5);
    await seedVolume(6);
    await seedVolume(7);
    await seedJsonFile('test1_questions.json');
    await seedJsonFile('2026_s1_questions.json');

    console.log('Database tables initialized successfully.');
  } catch (err) {
    console.error('Error initializing database tables:', err);
  }
}
