import fs from 'fs';
import path from 'path';
import { getCachedData } from '../redis';
import { ToolResult } from './types';

async function readJsonFile(filePath: string) {
  const content = await fs.promises.readFile(filePath, 'utf-8');
  return JSON.parse(content);
}

export async function getProdutoInfo(args: any, _vendedorCode?: number | null): Promise<ToolResult> {
  const { produto, quantidade } = args;
  if (!produto) return { error: 'Nome ou código do produto não fornecido.' };

  let prices: any = {};
  try {
    prices = await getCachedData('tabela_precos_v2', async () => ({}), 86400);
  } catch (e) {}

  const dataDir = path.join(process.cwd(), 'data');
  const jsonFiles = ['Dentscare.json', 'Home_Care.json', 'Whiteness.json'];
  let productMatch = null;

  for (const file of jsonFiles) {
    const p = path.join(dataDir, file);
    if (fs.existsSync(p)) {
      const items = await readJsonFile(p);
      const match = items.find((i: any) =>
        String(i.codigo) === String(produto) ||
        String(i.material).toLowerCase().includes(String(produto).toLowerCase())
      );
      if (match) {
        productMatch = match;
        break;
      }
    }
  }

  if (!productMatch) return { error: 'Produto não encontrado ou indisponível para venda na tabela oficial.' };

  const cod = String(productMatch.codigo);
  const precoTabela = prices[cod] || 0;
  const desconto = Number(productMatch.segmentacao) || 0;
  const precoDental = precoTabela > 0 ? precoTabela * (1 - desconto / 100) : 0;

  const resp: ToolResult = {
    codigo: cod,
    produto: productMatch.material,
    preco_tabela: precoTabela > 0 ? `R$ ${precoTabela.toFixed(2)}` : 'Indisponível',
    desconto_segmentacao: `${desconto}%`,
    preco_dental: precoDental > 0 ? `R$ ${precoDental.toFixed(2)}` : 'Indisponível',
  };
  if (quantidade && quantidade > 0 && precoDental > 0) {
    resp.quantidade = quantidade;
    resp.preco_total = `R$ ${(precoDental * quantidade).toFixed(2)}`;
  }
  return resp;
}
