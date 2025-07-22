import { getAuth } from 'firebase-admin/auth';
import { initializeFirebase } from '../../lib/firebase-admin'; // ajuste conforme seu caminho

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  try {
    await initializeFirebase();
    const { idToken, senhaAtual, novaSenha } = req.body;

    if (!idToken || !senhaAtual || !novaSenha) {
      return res.status(400).json({ message: 'Campos obrigatórios faltando.' });
    }

    const auth = getAuth();
    const decoded = await auth.verifyIdToken(idToken);
    const user = await auth.getUser(decoded.uid);

    // Aqui você teria que autenticar com Firebase Client SDK no frontend.
    // O backend não tem acesso à senha atual do usuário.

    return res.status(400).json({ message: 'A alteração de senha deve ser feita no frontend com reautenticação.' });
  } catch (error) {
    console.error('Erro ao alterar senha:', error);
    return res.status(500).json({ message: 'Erro interno ao tentar alterar senha.' });
  }
}
