export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  // LOGAR o JSON recebido no console da Vercel
  console.log("🔥 Payload recebido da Hotmart:", JSON.stringify(req.body, null, 2));

  // Responder sempre 200 OK temporariamente (SEM validar nada por enquanto)
  return res.status(200).json({ message: "Webhook recebido com sucesso" });
}
