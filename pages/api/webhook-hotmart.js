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

  try {
    // Verifica se o lead já existe no banco de dados
    const { data: leadData, error: selectError } = await supabase
      .from('leads')
      .select('*')
      .eq('email', email)
      .single();

    if (selectError && selectError.code !== 'PGRST116') {
      console.error('❌ Erro ao buscar o lead:', selectError.message);
      return res.status(500).json({ message: 'Erro ao buscar o lead no Supabase' });
    }

    // Se o lead não existir, insere um novo registro
    if (!leadData) {
      console.log('⚠️ Lead não encontrado. Inserindo novo lead.');

      const { data: newLead, error: insertError } = await supabase
        .from('leads')
        .insert([{ email, name, status: newStatus, plan }]);

      if (insertError) {
        console.error('❌ Erro ao inserir o novo lead:', insertError.message);
        return res.status(500).json({ message: 'Erro ao inserir novo lead no Supabase' });
      }

      return res.status(200).json({
        message: `Novo lead inserido e status atualizado para: ${newStatus}`,
        name,
        email,
        plan,
      });
    }

    // Se o lead já existir, atualiza apenas as informações diferentes
    console.log('✅ Lead encontrado, atualizando status e plano.');

    const { data: updateData, error: updateError } = await supabase
      .from('leads')
      .update({ status: newStatus, plan })
      .eq('email', email);

    if (updateError) {
      console.error('❌ Erro ao atualizar status no Supabase:', updateError.message);
      return res.status(500).json({ message: 'Erro ao atualizar status no Supabase' });
    }

    return res.status(200).json({
      message: `Status do lead atualizado para: ${newStatus}`,
      name,
      email,
      plan,
    });

  } catch (error) {
    console.error('❌ Erro ao processar dados do Supabase:', error);
    return res.status(500).json({ message: 'Erro ao processar atualização no banco' });
  }
}
