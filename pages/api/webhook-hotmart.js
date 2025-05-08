export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  // Validação do token do header
  const token = req.headers['x-hotmart-hottok'];
  if (token !== process.env.HOTMART_TOKEN) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  const payload = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  console.log('🔥 Payload recebido da Hotmart:', JSON.stringify(payload, null, 2));

  const email = payload.data?.buyer?.email;
  const name = payload.data?.buyer?.name;
  const purchaseStatus = payload.data?.purchase?.status; // <-- ALTERADO
  const event = payload.event; // <-- novo campo para identificar o evento

  if (!email || !name) {
    return res.status(400).json({ message: 'Email or name not found' });
  }

  let newStatus = 'Aguardando';

  // Mapear pelo status ou evento
  if (purchaseStatus === 'APPROVED' || event === 'PURCHASE_APPROVED') {
    newStatus = 'Comprou';
  } else if (purchaseStatus === 'BILLET_PRINTED') {
    newStatus = 'Boleto Gerado';
  } else if (event === 'PURCHASE_OUT_OF_SHOPPING_CART') {
    newStatus = 'Abandonou Checkout';
  }

  return res.status(200).json({
    message: `Status updated: ${newStatus}`,
    name: name,
    email: email
  });
}
