export default async function handler(req, res) {
    if (req.method !== 'POST') {
      return res.status(405).json({ message: 'Method not allowed' });
    }
  
    const payload = req.body;
    console.log('Received webhook:', payload);
  
    const email = payload?.buyer?.email;
    const purchaseStatus = payload?.purchase_status;
  
    if (!email) {
      return res.status(400).json({ message: 'Email not found' });
    }
  
    let newStatus = 'Aguardando';
  
    if (purchaseStatus === 'APPROVED') {
      newStatus = 'Comprou';
    } else if (purchaseStatus === 'BILLET_PRINTED') {
      newStatus = 'Boleto Gerado';
    } else if (purchaseStatus === 'CART_ABANDONED') {
      newStatus = 'Abandonou Checkout';
    }
  
    try {
      const supabaseUrl = 'https://YOUR_PROJECT_ID.supabase.co';
      const apiKey = 'YOUR_SUPABASE_API_KEY';
      const updateUrl = `${supabaseUrl}/rest/v1/leads?email=eq.${encodeURIComponent(email)}`;
  
      const response = await fetch(updateUrl, {
        method: 'PATCH',
        headers: {
          'apikey': apiKey,
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=representation'
        },
        body: JSON.stringify({ status: newStatus })
      });
  
      if (!response.ok) {
        throw new Error('Failed to update Supabase');
      }
  
      return res.status(200).json({ message: 'Status updated' });
    } catch (error) {
      console.error('Error updating Supabase:', error);
      return res.status(500).json({ message: 'Internal server error' });
    }
  }
  