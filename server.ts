import express from "express";
import cors from "cors";
import { initDb } from "./src/server/init_db";
import fs from "fs";
import path from "path";
import { createServer as createViteServer } from "vite";
import Stripe from "stripe";
import nodemailer from "nodemailer";
import apiRouter from "./src/server/api";

async function startServer() {
  const app = express();

  app.use(cors());

  if (process.env.DATABASE_URL) {
    initDb().catch(e => console.warn("DB Init Error:", e));
  }

  const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3000;

  app.use(express.json());

  // Helper to initialize Stripe safely
  let stripeClient: Stripe | null = null;
  function getStripe(): Stripe {
    if (!stripeClient) {
      const key = process.env.STRIPE_SECRET_KEY;
      if (!key) {
        throw new Error('STRIPE_SECRET_KEY environment variable is missing.');
      }
      stripeClient = new Stripe(key);
    }
    return stripeClient;
  }

  // API Routes
  app.use("/api", apiRouter);
  app.use("/uploads", express.static(path.join(process.cwd(), 'uploads')));
  app.post("/api/send-email", async (req, res) => {
    try {
      const { to, subject, text, html } = req.body;
      const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM } = process.env;

      if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) {
        // Fallback or warning if missing SMTP configuration
        console.warn('Simulated email dispatch (SMTP not fully configured):', { to, subject });
        return res.json({ success: true, simulated: true });
      }

      const transporter = nodemailer.createTransport({
        host: SMTP_HOST,
        port: parseInt(SMTP_PORT || '465'),
        secure: parseInt(SMTP_PORT || '465') === 465, // true for 465, false for other ports
        connectionTimeout: 5000,
        greetingTimeout: 5000,
        socketTimeout: 5000,
        auth: {
          user: SMTP_USER,
          pass: SMTP_PASS,
        },
      });

      const info = await transporter.sendMail({
        from: `"${SMTP_FROM || SMTP_USER}" <${SMTP_USER}>`,
        to,
        subject,
        text,
        html,
      });

      res.json({ success: true, messageId: info.messageId });
    } catch (e: any) {
      console.error('SMTP Error:', e.message);
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/create-checkout-session", async (req, res) => {
    try {
      const { userEmail } = req.body;
      const domainURL = req.headers.origin || 'http://localhost:3000';

      let stripe;
      try {
        stripe = getStripe();
      } catch (e) {
         console.warn('Simulated checkout session (Stripe not configured).');
         return res.json({ id: 'simulated_session', url: `${domainURL}/dashboard?payment=success&simulated=true` });
      }

      const session = await stripe.checkout.sessions.create({
        mode: "subscription",
        payment_method_types: ["card"],
        customer_email: userEmail, // useful to tie it to the mock user 
        line_items: [
          {
            price_data: {
              currency: "usd",
              product_data: {
                name: "Pro Subscription",
                description: "Infinite practice questions and AI grading.",
              },
              unit_amount: 2900, // $29.00
              recurring: {
                interval: "month",
              },
            },
            quantity: 1,
          },
        ],
        success_url: `${domainURL}/dashboard?payment=success`,
        cancel_url: `${domainURL}/pricing?payment=cancel`,
      });

      res.json({ id: session.id, url: session.url });
    } catch (e: any) {
      console.error(e);
      res.status(400).json({ error: e.message });
    }
  });

  app.post("/api/create-portal-session", async (req, res) => {
    try {
      const { userEmail } = req.body;
      const domainURL = req.headers.origin || 'http://localhost:3000';

      let stripe;
      try {
        stripe = getStripe();
      } catch (e) {
         console.warn('Simulated portal session (Stripe not configured).');
         return res.json({ url: `${domainURL}/profile?simulated_billing=true` });
      }

      // Find the customer by email
      const customers = await stripe.customers.list({
        email: userEmail,
        limit: 1,
      });

      let customerId;
      if (customers.data.length === 0) {
        // Create customer if not found
        const newCustomer = await stripe.customers.create({ email: userEmail });
        customerId = newCustomer.id;
      } else {
        customerId = customers.data[0].id;
      }

      const portalSession = await stripe.billingPortal.sessions.create({
        customer: customerId,
        return_url: `${domainURL}/profile`,
      });

      res.json({ url: portalSession.url });
    } catch (e: any) {
      console.error(e);
      res.status(400).json({ error: e.message });
    }
  });

  
  // Force serve ai_batch.json to avoid PWA/Vite routing bugs
  
  // Proxy for wikimedia images
  
  app.get('/api/image-proxy', async (req, res) => {
    try {
        let url = req.query.url;
        if (!url || typeof url !== 'string') return res.status(400).send('No url');

        const universalReplacements: Record<string, string> = {
          'Basal-cell_carcinoma': 'https://upload.wikimedia.org/wikipedia/commons/1/1a/Superficial_basal_cell_carcinoma.jpg',
          'glaucomatous_cupping': 'https://upload.wikimedia.org/wikipedia/commons/0/07/Acute_angle_closure_glaucoma.JPG',
          'Leukocoria': 'https://upload.wikimedia.org/wikipedia/commons/d/d8/Rb_whiteeye.PNG',
          'hypopyon': 'https://upload.wikimedia.org/wikipedia/commons/a/ab/Keratic_precipitate2.jpg',
          'Herpes_simplex_keratitis': 'https://upload.wikimedia.org/wikipedia/commons/9/95/Dendritic_corneal_ulcer.jpg',
          'Proliferative_diabetic_retinopathy': 'https://upload.wikimedia.org/wikipedia/commons/0/07/Fundus_-_diabetic_retinopathy.png',
          'Abducens_Nerve_Palsy': 'https://upload.wikimedia.org/wikipedia/commons/2/29/Abducens_nerve1.png',
          'Abducens_nerve': 'https://upload.wikimedia.org/wikipedia/commons/2/29/Abducens_nerve1.png',
          'Horner': 'https://upload.wikimedia.org/wikipedia/commons/3/37/Miosis.jpg',
          'Cataract_in_human_eye.png': 'https://upload.wikimedia.org/wikipedia/commons/b/ba/Cataract_in_human_eye.png',
          'Papilledema.jpg': 'https://upload.wikimedia.org/wikipedia/commons/1/1a/Papilledema.jpg',
          'Superficial_basal_cell_carcinoma.jpg': 'https://upload.wikimedia.org/wikipedia/commons/1/1a/Superficial_basal_cell_carcinoma.jpg',
          'Acute_angle_closure_glaucoma.JPG': 'https://upload.wikimedia.org/wikipedia/commons/0/07/Acute_angle_closure_glaucoma.JPG',
          'Rb_whiteeye.PNG': 'https://upload.wikimedia.org/wikipedia/commons/d/d8/Rb_whiteeye.PNG',
          'Keratic_precipitate2.jpg': 'https://upload.wikimedia.org/wikipedia/commons/a/ab/Keratic_precipitate2.jpg',
          'Dendritic_corneal_ulcer.jpg': 'https://upload.wikimedia.org/wikipedia/commons/9/95/Dendritic_corneal_ulcer.jpg',
          'Fundus_-_diabetic_retinopathy.png': 'https://upload.wikimedia.org/wikipedia/commons/0/07/Fundus_-_diabetic_retinopathy.png',
          'Abducens_nerve1.png': 'https://upload.wikimedia.org/wikipedia/commons/2/29/Abducens_nerve1.png',
          'Miosis.jpg': 'https://upload.wikimedia.org/wikipedia/commons/3/37/Miosis.jpg'
        };

        for (const [bad, good] of Object.entries(universalReplacements)) {
            if (url.includes(bad)) {
                url = good;
                break;
            }
        }

        const response = await fetch(url, { 
           headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36', 'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8', 'Accept-Language': 'en-US,en;q=0.9', 'Referer': 'https://commons.wikimedia.org/' } 
        });
        if (!response.ok) throw new Error('Proxy failed ' + response.status);
        const buffer = await response.arrayBuffer();
        res.set('Content-Type', response.headers.get('content-type') || 'image/jpeg');
        res.set('Cache-Control', 'public, max-age=86400');
        res.send(Buffer.from(buffer));
    } catch(e) {
        // Silently let it redirect to placehold without spamming console
        res.redirect('https://placehold.co/600x400/png?text=Image+Not+Available');
    }
  });

  
  app.get('/api/image-search-proxy', async (req, res) => {
    let query = req.query.q;
    if (!query || typeof query !== 'string') return res.status(400).send('No query');
    query = decodeURIComponent(query);
    
    // Clean up query if needed
    query = query.replace('Clinical Photograph:', '').replace(/\+/g, ' ');

    try {
        const trySearch = async (qStr: string): Promise<string | null> => {
            try {
                const searchUrl = 'https://commons.wikimedia.org/w/api.php?action=query&list=search&srsearch=' + encodeURIComponent(qStr + ' filetype:bitmap') + '&utf8=&format=json&srnamespace=6';
                const searchRes = await fetch(searchUrl);
                const searchData = await searchRes.json();
                
                if (searchData.query && searchData.query.search && searchData.query.search.length > 0) {
                   const title = searchData.query.search[0].title;
                   const imageReqUrl = 'https://commons.wikimedia.org/w/api.php?action=query&titles=' + encodeURIComponent(title) + '&prop=imageinfo&iiprop=url&format=json';
                   const imageRes = await fetch(imageReqUrl);
                   const imageData = await imageRes.json();
                   const pages = imageData.query.pages;
                   const pageId = Object.keys(pages)[0];
                   if (pageId && pageId !== '-1' && pages[pageId].imageinfo && pages[pageId].imageinfo.length > 0) {
                       return pages[pageId].imageinfo[0].url;
                   }
                }
            } catch(e) { }
            return null;
        };

        let img = await trySearch(query);
        if (!img) {
            const words = query.split(' ');
            if (words.length > 2) {
                img = await trySearch(words.slice(0, 2).join(' '));
            }
        }
        if (!img) {
            const words = query.split(' ');
            if (words.length > 1) {
                img = await trySearch(words[0]);
            }
        }

        if (img) {
            // We found an image, let's proxy IT!
            // Redirect to the regular image proxy to handle the wikimedia headers
            return res.redirect('/api/image-proxy?url=' + encodeURIComponent(img));
        }
    } catch(e) {}
    
    // If all fails, fallback to standard placeholder
    res.redirect('https://placehold.co/600x400/png?text=Image+Not+Available');
  });


  app.get('/api/source-code', (req, res) => {
    let target = path.join(process.cwd(), 'public', 'race-exam-source.zip');
    if (!fs.existsSync(target)) {
      target = path.join(process.cwd(), 'dist', 'race-exam-source.zip');
    }
    if (fs.existsSync(target)) {
      res.download(target, 'race-exam-source.zip');
    } else {
      res.status(404).send('Source code zip not found.');
    }
  });

  app.get('/api/ai_batch', (req, res) => {
    let target = path.join(process.cwd(), 'dist', 'ai_batch.json');
    if (!fs.existsSync(target)) {
       target = path.join(process.cwd(), 'public', 'ai_batch.json');
    }
    res.sendFile(target);
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // Production static serving
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
