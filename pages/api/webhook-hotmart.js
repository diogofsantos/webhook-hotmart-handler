export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  // ADICIONAR ESTA LINHA PARA PARSE DO JSON:
  const payload = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;

  console.log('Received webhook:', payload);

  const email = payload?.buyer?.email;
  const name = payload?.buyer?.name;
  const purchaseStatus = payload?.purchase_status;

  if (!email || !name) {
    return res.status(400).json({ message: 'Email or name not found' });
  }

  let newStatus = 'Aguardando';

  if (purchaseStatus === 'APPROVED') {
    newStatus = 'Comprou';
  } else if (purchaseStatus === 'BILLET_PRINTED') {
    newStatus = 'Boleto Gerado';
  } else if (purchaseStatus === 'CART_ABANDONED') {
    newStatus = 'Abandonou Checkout';
  }

  return res.status(200).json({
    message: `Status updated: ${newStatus}`,
    name: name,
    email: email
  });
}
