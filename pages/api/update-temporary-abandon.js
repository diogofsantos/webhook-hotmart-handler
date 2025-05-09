const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

export const config = {
  runtime: 'nodejs',
};

export default async function handler(req, res) {
  const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from('leads')
    .update({ status: 'Abandono Temporário' })
    .lte('created_at', twoHoursAgo)
    .eq('status', 'Aguardando');

  if (error) {
    console.error('❌ Erro atualizando abandonos temporários:', error);
    return res.status(500).json({ message: 'Erro ao atualizar', error });
  }

  console.log('✅ Abandonos temporários atualizados:', data);
  return res.status(200).json({ message: 'Abandonos temporários atualizados', updated: data });
}
