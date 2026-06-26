import { NextApiRequest, NextApiResponse } from 'next';
import { supabase } from '@/lib/supabase';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  // Verifica token (se aplicável na API)
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const token = authHeader.replace('Bearer ', '');
  const { data: user, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const { data, error } = await supabase
      .from('vw_produto_bu')
      .select('produto_codigo, texto_breve_material, data_vencimento, quantidade_estoque, business_unit, categoria')
      .order('data_vencimento', { ascending: true });

    if (error) throw error;

    // Agrupa por business_unit
    const grouped: Record<string, any[]> = {
      Dentscare: [],
      Whiteness: [],
      Home_Care: []
    };

    if (data) {
      for (const item of data) {
        const bu = item.business_unit || 'Outros';
        if (grouped[bu]) {
          grouped[bu].push(item);
        } else {
          // Fallback if there's any 'Outros'
          if (!grouped['Outros']) grouped['Outros'] = [];
          grouped['Outros'].push(item);
        }
      }
    }

    return res.status(200).json(grouped);
  } catch (err: any) {
    console.error('Error fetching segregados:', err);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}
