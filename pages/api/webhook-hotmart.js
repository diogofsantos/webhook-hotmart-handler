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
  const email = payload.data?.buyer?.email?.toLowerCase().trim();
  const name = payload.data?.buyer?.name?.trim();
  const purchaseStatus = payload.data?.purchase?.status;
  const event = payload.event;
  const plan = payload.data?.subscription?.plan?.name || 'Padrão';
  const xcod = payload.data?.xcod?.toString().trim() || null; // Extração e normalização do código do afiliado
  
  // Extração dos parâmetros UTM (opcionais)
  const utmParams = {
    utm_campaign: payload.data?.utm?.campaign || null,
    utm_source: payload.data?.utm?.source || null,
    utm_medium: payload.data?.utm?.medium || null,
    utm_term: payload.data?.utm?.term || null,
    utm_content: payload.data?.utm?.content || null
  };

  // Validação básica de dados obrigatórios
  if (!email || !name) {
    return res.status(400).json({ message: 'Email or name not found' });
  }

  // Lógica de status do lead
  let newStatus = 'Aguardando';

  // Atualização do status com base nos dados do evento
  if (purchaseStatus === 'APPROVED' || event === 'PURCHASE_APPROVED') {
    newStatus = 'Comprou';
  } else if (purchaseStatus === 'BILLET_PRINTED') {
    newStatus = 'Boleto Gerado';
  } else if (event === 'PURCHASE_OUT_OF_SHOPPING_CART') {
    newStatus = 'Abandonou Checkout';
  }

  try {
    // Verifica se o lead já existe no banco de dados por email ou xcod
    const { data: leadData, error: selectError } = await supabase
      .from('leads')
      .select('*')
      .or(`email.eq.${email},xcod.eq.${xcod}`)
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
        .insert([{ 
          email, 
          name, 
          status: newStatus, 
          plan,
          xcod,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          ...utmParams
        }]);

      if (insertError) {
        console.error('❌ Erro ao inserir o novo lead:', insertError.message);
        return res.status(500).json({ message: 'Erro ao inserir novo lead no Supabase' });
      }

      // Caso não encontre o lead no banco, mostrar um alerta
      if (!newLead || newLead.length === 0) {
        console.warn('⚠️ Nenhum registro encontrado para este email:', email);
      }

      // Enviar evento para o GTM Server-Side (Facebook CAPI)
      try {
        const gtmPayload = {
          event: 'Lead',
          email,
          name,
          plan,
          status: newStatus,
          xcod,
          ...utmParams
        };
        await fetch('https://gtm.newauralife.com/collect', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(gtmPayload),
        });
      } catch (err) {
        console.error('Erro ao enviar evento para GTM Server-Side:', err);
      }

      return res.status(200).json({
        message: `Novo lead inserido e status atualizado para: ${newStatus}`,
        name,
        email,
        plan,
        xcod,
      });
    }

    // Se o lead já existir, atualiza apenas as informações diferentes
    console.log('✅ Lead encontrado, atualizando informações.');

    // Prepara os dados para atualização
    const updateData = {
      status: newStatus,
      plan,
      updated_at: new Date().toISOString(),
    };

    // Adiciona o email se for diferente do atual
    if (email && (!leadData.email || leadData.email !== email)) {
      updateData.email = email;
    }

    // Adiciona o código do afiliado se for diferente do atual
    if (xcod && (!leadData.xcod || leadData.xcod !== xcod)) {
      updateData.xcod = xcod;
    }

    // Adiciona os parâmetros UTM apenas se eles existirem e forem diferentes dos atuais
    Object.entries(utmParams).forEach(([key, value]) => {
      if (value && (!leadData[key] || leadData[key] !== value)) {
        updateData[key] = value;
      }
    });

    // Atualiza o lead no banco de dados usando o ID do registro encontrado
    const { data: updateResult, error: updateError } = await supabase
      .from('leads')
      .update(updateData)
      .eq('id', leadData.id);

    if (updateError) {
      console.error('❌ Erro ao atualizar lead no Supabase:', updateError.message);
      return res.status(500).json({ message: 'Erro ao atualizar lead no Supabase' });
    }

    // Enviar evento para o GTM Server-Side (Facebook CAPI)
    try {
      const gtmPayload = {
        event: 'LeadUpdate',
        email,
        name,
        plan,
        status: newStatus,
        xcod, // Inclui o código do afiliado no evento
        ...utmParams
      };
      await fetch('https://gtm.newauralife.com/collect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(gtmPayload),
      });
    } catch (err) {
      console.error('Erro ao enviar evento para GTM Server-Side:', err);
    }

    return res.status(200).json({
      message: `Lead atualizado com sucesso. Status: ${newStatus}`,
      name,
      email,
      plan,
      xcod,
    });

  } catch (error) {
    console.error('❌ Erro ao processar dados do Supabase:', error);
    return res.status(500).json({ message: 'Erro ao processar atualização no banco' });
  }
}
