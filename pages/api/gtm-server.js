import { createClient } from '@supabase/supabase-js';
import fetch from 'node-fetch';

// Configurações do Supabase
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

// Configurações do Facebook CAPI
const FB_PIXEL_ID = process.env.FB_PIXEL_ID;
const FB_ACCESS_TOKEN = process.env.FB_ACCESS_TOKEN;
const FB_API_URL = `https://graph.facebook.com/v18.0/${FB_PIXEL_ID}/events?access_token=${FB_ACCESS_TOKEN}`;

// Decodifique o código do Tag Manager se necessário (aWQ9R1RNLVdRSFpTR0tIJmVudj0xJmF1dGg9NWRteW0ySEc3RzB1TmYxQzZRNGl3dw==)

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const { event, email, name, plan, status } = req.body;

  // Monta o payload para o Facebook CAPI
  const fbPayload = {
    data: [
      {
        event_name: event === 'PURCHASE_APPROVED' ? 'Purchase' : 'AbandonCheckout',
        event_time: Math.floor(Date.now() / 1000),
        user_data: {
          em: email ? [email] : [],
        },
        custom_data: {
          name,
          plan,
          status,
        },
        action_source: 'website',
      },
    ],
  };

  try {
    const fbRes = await fetch(FB_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(fbPayload),
    });
    const fbData = await fbRes.json();
    if (!fbRes.ok) {
      throw new Error(fbData.error?.message || 'Erro ao enviar para Facebook CAPI');
    }
    return res.status(200).json({ message: 'Evento enviado para Facebook CAPI', fbData });
  } catch (error) {
    console.error('Erro ao enviar evento para Facebook CAPI:', error);
    return res.status(500).json({ message: 'Erro ao enviar evento para Facebook CAPI', error: error.message });
  }
} 