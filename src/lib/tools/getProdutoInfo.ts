import { getListaProdutosV5, getTabelaPrecosV2 } from '../catalogService';
import { ToolResult } from './types';

export async function getProdutoInfo(args: any, _vendedorCode?: number | null): Promise<ToolResult> {
  const { produto, quantidade } = args;
  if (!produto) return { error: 'Nome ou código do produto não fornecido.' };

  let prices: any = {};
  try {
    prices = await getTabelaPrecosV2();
  } catch (e) {
    console.error('Erro ao buscar preços em getProdutoInfo', e);
  }

  let catalog: Record<string, any[]> = {};
  try {
    catalog = await getListaProdutosV5();
  } catch (e) {
    console.error('Erro ao buscar catálogo em getProdutoInfo', e);
  }

  const allProducts = [
    ...(catalog.Dentscare || []),
    ...(catalog.Home_Care || []),
    ...(catalog.Whiteness || []),
    ...(catalog.Inbox || []),
  ];

  const productMatch = allProducts.find((i: any) =>
    String(i.codigo) === String(produto) ||
    String(i.material).toLowerCase().includes(String(produto).toLowerCase())
  );

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

  if (productMatch.promotionName && productMatch.promotionIsActive) {
    resp.promocao_ativa = productMatch.promotionName;
  }

  if (quantidade && quantidade > 0 && precoDental > 0) {
    resp.quantidade = quantidade;
    resp.preco_total = `R$ ${(precoDental * quantidade).toFixed(2)}`;
  }
  return resp;
}
