/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextApiRequest, NextApiResponse } from 'next';
import fs from "fs";
import path from "path";
import { supabase } from '@/lib/supabase';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

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
    // 1. Fetch direct from f_shelf_life table instead of the view
    const { data: shelfLifeData, error } = await supabase
      .from('f_shelf_life')
      .select('produto_codigo, texto_breve_material, data_vencimento, quantidade_estoque')
      .not('data_vencimento', 'is', null)
      .order('data_vencimento', { ascending: true });

    if (error) throw error;

    // 2. Load JSONs to map product code to BU
    const dataDir = path.join(process.cwd(), "data");
    const buMap = new Map<string, string>();

    const mapJSON = (fileName: string, buName: string) => {
      const filePath = path.join(dataDir, fileName);
      if (fs.existsSync(filePath)) {
        const items = JSON.parse(fs.readFileSync(filePath, "utf-8"));
        items.forEach((item: any) => {
          buMap.set(String(item.codigo).trim(), buName);
        });
      }
    };

    mapJSON("Dentscare.json", "Dentscare");
    mapJSON("Whiteness.json", "Whiteness");
    mapJSON("Home_Care.json", "Home_Care");

    // 3. Group by BU based on product code
    const grouped: Record<string, any[]> = {
      Dentscare: [],
      Whiteness: [],
      Home_Care: [],
      Outros: []
    };

    if (shelfLifeData) {
      for (const item of shelfLifeData) {
        const code = String(item.produto_codigo).trim();
        const bu = buMap.get(code) || 'Outros';
        
        const mappedItem = {
          produto_codigo: item.produto_codigo,
          texto_breve_material: item.texto_breve_material,
          data_vencimento: item.data_vencimento,
          quantidade_estoque: item.quantidade_estoque,
          business_unit: bu,
          categoria: 'Geral'
        };

        if (grouped[bu]) {
          grouped[bu].push(mappedItem);
        } else {
          grouped['Outros'].push(mappedItem);
        }
      }
    }

    return res.status(200).json(grouped);
  } catch (err: any) {
    console.error('Error fetching segregados:', err);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}
