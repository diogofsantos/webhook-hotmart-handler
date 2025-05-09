import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const token = req.headers['x-hotmart-hottok'];
  if (token !== process.env.HOTMART_TOKEN) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  const payload = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  console.log('🔥 Payload recebido da Hotmart:', JSON.stringify(payload, null, 2));

  const email = payload.data?.buyer?.email;
  const name = payload.data?.buyer?.name;
  const purchaseStatus = payload.data?.purchase?.status;
  const event = payload.event;
  const plan = payload.data?.subscription?.plan?.name || 'Padrão'; // pegando plano ou valor padrão

  if (!email || !name) {
    return res.status(400).json({ message: 'Email or name not found' });
  }

  let newStatus = 'Aguardando';

  if (purchaseStatus === 'APPROVED' || event === 'PURCHASE_APPROVED') {
    newStatus = 'Comprou';
  } else if (purchaseStatus === 'BILLET_PRINTED') {
    newStatus = 'Boleto Gerado';
  } else if (event === 'PURCHASE_OUT_OF_SHOPPING_CART') {
    newStatus = 'Abandonou Checkout';
  }

  // 🔥 Atualizar status (e opcionalmente plan) no Supabase
  const { data, error } = await supabase
    .from('leads')
    .update({ status: newStatus, plan: plan })
    .eq('email', email);

  if (error) {
    console.error('❌ Erro ao atualizar Supabase:', error);
    return res.status(500).json({ message: 'Erro ao atualizar status no Supabase' });
  }

  if (data.length === 0) {
    console.warn('⚠️ Nenhum registro encontrado para este email:', email);
  }

  return res.status(200).json({
    message: `Status atualizado para: ${newStatus}`,
    name,
    email,
    plan
  });
}
