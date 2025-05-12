import { createClient } from '@supabase/supabase-js';

// Criando o cliente do Supabase com as variáveis de ambiente
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

export default async function handler(req, res) {
  // Verifica se a requisição é do tipo POST
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  // Verifica se a requisição possui o token correto da Hotmart
  const token = req.headers['x-hotmart-hottok'];
  if (token !== process.env.HOTMART_TOKEN) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  // Tenta fazer o parse do payload recebido, caso o corpo da requisição seja uma string
  let payload;
  try {
    payload = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  } catch (error) {
    console.error('❌ Erro ao parsear payload:', error);
    return res.status(400).json({ message: 'Erro ao processar dados do webhook' });
  }

  console.log('🔥 Payload recebido da Hotmart:', JSON.stringify(payload, null, 2));

  // Extração de dados do payload
  const email = payload.data?.buyer?.email;
  const name = payload.data?.buyer?.name;
  const purchaseStatus = payload.data?.purchase?.status;
  const event = payload.event;
  const plan = payload.data?.subscription?.plan?.name || 'Padrão'; // Pegando o plano ou valor padrão

  // Validação básica de dados obrigatórios
  if (!email || !name) {
    return res.status(400).json({ message: 'Email or name not found' });
  }

  // Lógica de status do lead
  let newStatus = 'Aguardando'; // Status padrão

  // Atualização do status com base nos dados do evento
  if (purchaseStatus === 'APPROVED' || event === 'PURCHASE_APPROVED') {
    newStatus = 'Comprou';
  } else if (purchaseStatus === 'BILLET_PRINTED') {
    newStatus = 'Boleto Gerado';
  } else if (event === 'PURCHASE_OUT_OF_SHOPPING_CART') {
    newStatus = 'Abandonou Checkout';
  }

  // Atualizando o status do lead no Supabase
  try {
    const { data, error } = await supabase
      .from('leads')
      .update({ status: newStatus, plan: plan })
      .eq('email', email);

    if (error) {
      console.error('❌ Erro ao atualizar status no Supabase:', error);
      return res.status(500).json({ message: 'Erro ao atualizar status no Supabase' });
    }

    // Caso não encontre o lead no banco, mostrar um alerta
    if (data.length === 0) {
      console.warn('⚠️ Nenhum registro encontrado para este email:', email);
    }

    return res.status(200).json({
      message: `Status atualizado para: ${newStatus}`,
      name,
      email,
      plan,
    });

  } catch (error) {
    console.error('❌ Erro ao processar dados do Supabase:', error);
    return res.status(500).json({ message: 'Erro ao processar atualização no banco' });
  }
}
