import { getProdutoInfo } from './getProdutoInfo';
import { getStatusMeta } from './getStatusMeta';
import { getProdutosTendencia } from './getProdutosTendencia';
import { getComparativoAnoPassado } from './getComparativoAnoPassado';
import { getMelhorPiorMes } from './getMelhorPiorMes';
import { getFaturamentoAcumuladoAno } from './getFaturamentoAcumuladoAno';
import { getMetaProjecaoDiaria } from './getMetaProjecaoDiaria';
import { getClientesLacunaProduto } from './getClientesLacunaProduto';
import { getClientesLinhaUnica } from './getClientesLinhaUnica';
import { getSugestaoProdutosCliente } from './getSugestaoProdutosCliente';
import { getClientesRiscoChurn } from './getClientesRiscoChurn';
import { getClientesEmQueda } from './getClientesEmQueda';
import { getFocoVendas } from './getFocoVendas';
import { getClienteDiasSemCompra } from './getClienteDiasSemCompra';
import { getSegregadosInfo } from './getSegregadosInfo';
import { getSegregadosAlertas } from './getSegregadosAlertas';
import { getAgendaVisita } from './getAgendaVisita';
import { ToolHandler } from './types';

export const toolsRegistry: Record<string, ToolHandler> = {
  get_produto_info: getProdutoInfo,
  get_status_meta: getStatusMeta,
  get_produtos_tendencia: getProdutosTendencia,
  get_comparativo_ano_passado: getComparativoAnoPassado,
  get_melhor_pior_mes: getMelhorPiorMes,
  get_faturamento_acumulado_ano: getFaturamentoAcumuladoAno,
  get_meta_projecao_diaria: getMetaProjecaoDiaria,
  get_clientes_lacuna_produto: getClientesLacunaProduto,
  get_clientes_linha_unica: getClientesLinhaUnica,
  get_sugestao_produtos_cliente: getSugestaoProdutosCliente,
  get_clientes_risco_churn: getClientesRiscoChurn,
  get_clientes_em_queda: getClientesEmQueda,
  get_foco_vendas: getFocoVendas,
  get_cliente_dias_sem_compra: getClienteDiasSemCompra,
  get_segregados_info: getSegregadosInfo,
  get_segregados_alertas: getSegregadosAlertas,
  get_agenda_visita: getAgendaVisita,
};
