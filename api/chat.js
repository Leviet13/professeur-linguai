import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    let body = req.body;
    if (typeof body === 'string') body = JSON.parse(body);

    // Sauvegarder le message si utilisateur connecté
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (token && body.save_history) {
      const { data: { user } } = await supabase.auth.getUser(token);
      if (user) {
        await supabase.from('chat_history').insert([
          { user_id: user.id, role: 'user', content: body.messages[0].content, direction: body.direction },
        ]);
      }
    }

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        max_tokens: 1000,
        messages: [
          { role: 'system', content: body.system },
          { role: 'user', content: body.messages[0].content }
        ]
      }),
    });

    const data = await response.json();
    const aiResponse = data.choices[0].message.content;

    // Sauvegarder la réponse IA si utilisateur connecté
    if (token && body.save_history) {
      const { data: { user } } = await supabase.auth.getUser(token);
      if (user) {
        await supabase.from('chat_history').insert([
          { user_id: user.id, role: 'assistant', content: aiResponse, direction: body.direction },
        ]);
      }
    }

    return res.status(200).json({
      content: [{ text: aiResponse }]
    });

  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
